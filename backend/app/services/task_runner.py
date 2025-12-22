from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import delete

from app.core.database import AsyncSessionLocal
from app.core.logging import setup_logging
from app.models.database import Task, TaskLog
from app.services import config_snapshot_service
from app.services.nornir import NornirManager

logger = setup_logging(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _truncate_text(value: str, limit: int = 20000) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "\n...<truncated>..."


class TaskRunner:
    """
    进程内任务执行器（最小实现）。

    约束：
    - 适合开发/单实例；多实例需外部队列（Celery/RQ/Kafka）或 DB-based lock/claim。
    - 任务持久化在 DB，但队列本身在内存中；服务重启后不会自动恢复 pending 任务。
    """

    def __init__(self, nornir_manager: NornirManager, *, workers: int = 1):
        self._nornir_manager = nornir_manager
        self._workers = max(1, int(workers))
        self._queue: asyncio.Queue[int] = asyncio.Queue()
        self._stop = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []

    def start(self) -> None:
        if self._tasks and any(not t.done() for t in self._tasks):
            return
        self._stop.clear()
        self._tasks = [
            asyncio.create_task(self._worker(i), name=f"task-runner-{i}") for i in range(self._workers)
        ]
        logger.info(f"任务执行器启动: workers={self._workers}")

    async def stop(self) -> None:
        self._stop.set()
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except asyncio.CancelledError:
                pass
        self._tasks = []
        logger.info("任务执行器停止")

    def submit(self, task_id: int) -> None:
        self._queue.put_nowait(int(task_id))

    async def _worker(self, idx: int) -> None:
        while not self._stop.is_set():
            try:
                task_id = await self._queue.get()
            except asyncio.CancelledError:
                raise
            try:
                await self._execute_task(task_id)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                logger.error(f"任务执行失败: id={task_id} err={e}")
            finally:
                self._queue.task_done()

    async def _execute_task(self, task_id: int) -> None:
        async with AsyncSessionLocal() as session:
            task = await session.get(Task, task_id)
            if not task:
                return

            if task.status != "pending":
                return

            # 清理同任务旧日志（如果重跑/重复提交）
            await session.execute(delete(TaskLog).where(TaskLog.task_id == task.id))

            task.status = "running"
            task.started_at = _utc_now()
            task.completed_at = None
            task.error_message = None
            task.results = {}
            await session.commit()

            try:
                results = await self._run_payload(session, task)
                task.results = results

                failed = any(bool((r or {}).get("failed")) for r in (results or {}).values() if isinstance(r, dict))
                task.status = "failed" if failed else "completed"
                task.completed_at = _utc_now()
                await session.commit()

                await self._persist_task_logs(session, task_id=task.id, results=results)
                await session.commit()

            except Exception as e:  # noqa: BLE001
                task.status = "failed"
                task.error_message = str(e)
                task.completed_at = _utc_now()
                await session.commit()
                raise

    async def _run_payload(self, session, task: Task) -> Dict[str, Any]:
        task_type = (task.task_type or "").lower()
        targets = list(task.targets or [])
        params = dict(task.parameters or {})

        if task_type == "command":
            timeout = params.get("timeout")
            return await self._nornir_manager.send_command(hosts=targets, command=task.command or "", timeout=timeout)

        if task_type == "config":
            timeout = params.get("timeout")
            dry_run = bool(params.get("dry_run", False))
            # task.config 允许是一段文本，也可传 parameters.configs(list[str])
            configs = params.get("configs")
            if not configs:
                cfg = (task.config or "").strip()
                if not cfg:
                    raise ValueError("config 不能为空")
                configs = [ln for ln in cfg.splitlines() if ln.strip()]
            return await self._nornir_manager.send_config(hosts=targets, commands=configs, dry_run=dry_run, timeout=timeout)

        if task_type == "connectivity":
            return self._nornir_manager.test_connectivity(targets)

        if task_type == "scrapli":
            task_name = params.get("task")
            if not isinstance(task_name, str) or not task_name.strip():
                raise ValueError("scrapli 任务需要 parameters.task")
            inner_params = params.get("params") or {}
            if not isinstance(inner_params, dict):
                raise ValueError("scrapli 任务需要 parameters.params(dict)")
            return await self._nornir_manager.run_scrapli_task(hosts=targets, task_name=task_name, params=inner_params)

        if task_type in {"running_config", "running-config", "running_config_snapshot"}:
            command = params.get("command")
            timeout = params.get("timeout")
            created_by = task.created_by
            return await config_snapshot_service.save_running_config_snapshots(
                db=session,
                nornir_manager=self._nornir_manager,
                device_names=targets,
                command=command,
                timeout=timeout,
                created_by=created_by,
            )

        raise ValueError(f"不支持的 task_type: {task.task_type}")

    async def _persist_task_logs(self, session, *, task_id: int, results: Dict[str, Any]) -> None:
        for device_name, r in (results or {}).items():
            if not isinstance(r, dict):
                continue
            failed = bool(r.get("failed"))
            status = "failed" if failed else "success"
            exception = r.get("exception")
            raw = r.get("result")
            raw_text = raw if isinstance(raw, str) else None
            if raw_text is not None:
                raw_text = _truncate_text(raw_text)

            session.add(
                TaskLog(
                    task_id=task_id,
                    device_name=str(device_name),
                    status=status,
                    result={k: v for k, v in r.items() if k not in {"result"}},  # 避免重复存储巨大正文
                    raw_output=raw_text,
                    error_message=str(exception) if exception else None,
                )
            )
