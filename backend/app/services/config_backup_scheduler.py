from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal
from app.core.logging import setup_logging
from app.models.database import ConfigBackupRun, ConfigBackupSchedule
from app.services.nornir import NornirManager
from app.services.config_snapshot_service import save_running_config_snapshots

logger = setup_logging(__name__)


class ConfigBackupScheduler:
    """
    进程内调度器（interval）。

    说明：
    - 这是开发/单进程模式的最小实现；多进程/多实例部署需要外部调度（如 Celery/Quartz/K8s CronJob）。
    - 通过 DB 的 next_run_at 来保证“至少一次”触发；为避免并发争抢，这里用 advisory lock 兜底。
    """

    def __init__(self, nornir_manager: NornirManager):
        self._nornir_manager = nornir_manager
        self._task: Optional[asyncio.Task[None]] = None
        self._stop = asyncio.Event()

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run_loop(), name="config-backup-scheduler")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self) -> None:
        # 轮询周期：5s（足够轻量）
        poll_seconds = 5
        logger.info(f"配置备份调度器启动（poll={poll_seconds}s）")

        while not self._stop.is_set():
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                logger.error(f"调度器 tick 失败: {e}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=poll_seconds)
            except asyncio.TimeoutError:
                pass

        logger.info("配置备份调度器停止")

    async def _tick(self) -> None:
        now = datetime.now(timezone.utc)

        async with AsyncSessionLocal() as session:
            # advisory lock：防止多实例同时跑（单机多进程时尤为重要）
            # key 任取一个常量 int64
            locked = await session.scalar(text("SELECT pg_try_advisory_lock(86402021)"))
            if not locked:
                return

            try:
                stmt = (
                    select(ConfigBackupSchedule)
                    .where(ConfigBackupSchedule.enabled.is_(True))
                    .where(ConfigBackupSchedule.next_run_at.is_not(None))
                    .where(ConfigBackupSchedule.next_run_at <= now)
                    .order_by(ConfigBackupSchedule.next_run_at.asc(), ConfigBackupSchedule.id.asc())
                    .limit(10)
                )
                schedules = (await session.execute(stmt)).scalars().all()
                if not schedules:
                    return

                for schedule in schedules:
                    await self._run_one(session, schedule_id=schedule.id)
            finally:
                await session.execute(text("SELECT pg_advisory_unlock(86402021)"))

    async def _run_one(self, session, *, schedule_id: int) -> None:
        schedule = await session.get(ConfigBackupSchedule, schedule_id)
        if not schedule or not schedule.enabled:
            return

        now = datetime.now(timezone.utc)
        run = ConfigBackupRun(schedule_id=schedule.id, status="running", results={})
        session.add(run)
        await session.commit()

        try:
            devices = list(schedule.devices or [])
            results = await save_running_config_snapshots(
                session,
                self._nornir_manager,
                device_names=devices,
                command=schedule.command,
                timeout=schedule.timeout,
                created_by=schedule.created_by or "scheduler",
            )

            ok = sum(1 for _, r in results.items() if isinstance(r, dict) and r.get("failed") is False)
            failed = sum(1 for _, r in results.items() if not (isinstance(r, dict) and r.get("failed") is False))

            run.status = "completed" if failed == 0 else "failed"
            run.results = results
            run.completed_at = now

            schedule.last_run_at = now
            schedule.last_status = run.status
            schedule.last_error = None
            schedule.next_run_at = now + timedelta(minutes=int(schedule.interval_minutes))

            await session.commit()
            logger.info(
                f"备份计划完成: schedule_id={schedule.id} name={schedule.name} ok={ok} failed={failed} "
                f"next={schedule.next_run_at.isoformat() if schedule.next_run_at else None}"
            )

        except Exception as e:  # noqa: BLE001
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = now

            schedule.last_run_at = now
            schedule.last_status = "failed"
            schedule.last_error = str(e)
            schedule.next_run_at = now + timedelta(minutes=int(schedule.interval_minutes))

            await session.commit()
            logger.error(f"备份计划失败: schedule_id={schedule.id} name={schedule.name} err={e}")
