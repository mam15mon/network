"""任务管理 API 路由（落库 + 后台执行）"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import setup_logging
from app.models.database import Task, TaskLog
from app.services.task_runner import TaskRunner

logger = setup_logging(__name__)
router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_task_runner(request: Request) -> TaskRunner:
    runner = getattr(request.app.state, "task_runner", None)
    if not runner:
        raise HTTPException(status_code=503, detail="TaskRunner 未初始化")
    return runner


class TaskCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    task_type: str = Field(min_length=1)  # command/config/connectivity/scrapli/running_config
    targets: List[str] = Field(min_length=1)
    command: Optional[str] = None
    config: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    auto_start: bool = True


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    task_type: str
    status: str
    targets: List[str]
    command: Optional[str]
    config: Optional[str]
    parameters: Dict[str, Any]
    results: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: Optional[str]


class TaskSummary(BaseModel):
    id: int
    name: str
    task_type: str
    status: str
    targets_count: int
    created_at: datetime
    completed_at: Optional[datetime]
    created_by: Optional[str]


class TaskLogItem(BaseModel):
    id: int
    device_name: str
    status: str
    result: Optional[Dict[str, Any]]
    raw_output: Optional[str]
    error_message: Optional[str]
    created_at: datetime


@router.get("", response_model=List[TaskSummary])
async def list_tasks(
    status: Optional[str] = Query(None, description="按状态过滤"),
    task_type: Optional[str] = Query(None, description="按任务类型过滤"),
    limit: int = Query(50, ge=1, le=1000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: AsyncSession = Depends(get_db),
) -> List[TaskSummary]:
    stmt = select(Task).order_by(desc(Task.id)).limit(limit).offset(offset)
    if status:
        stmt = stmt.where(Task.status == status)
    if task_type:
        stmt = stmt.where(Task.task_type == task_type)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        TaskSummary(
            id=r.id,
            name=r.name,
            task_type=r.task_type,
            status=r.status,
            targets_count=len(list(r.targets or [])),
            created_at=r.created_at,
            completed_at=r.completed_at,
            created_by=r.created_by,
        )
        for r in rows
    ]


@router.post("", response_model=TaskResponse)
async def create_task(
    payload: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    runner: TaskRunner = Depends(get_task_runner),
) -> TaskResponse:
    task_type = (payload.task_type or "").strip().lower()
    if task_type == "command" and not (payload.command and payload.command.strip()):
        raise HTTPException(status_code=400, detail="task_type=command 时 command 不能为空")
    if task_type == "config" and not (
        (payload.config and payload.config.strip()) or (payload.parameters or {}).get("configs")
    ):
        raise HTTPException(status_code=400, detail="task_type=config 时 config 或 parameters.configs 不能为空")

    created_by = request.headers.get("X-Dev-User") or request.headers.get("x-dev-user")
    task = Task(
        name=payload.name,
        description=payload.description,
        task_type=payload.task_type,
        status="pending",
        targets=payload.targets,
        command=payload.command,
        config=payload.config,
        parameters=payload.parameters or {},
        results={},
        created_by=created_by,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    if payload.auto_start:
        runner.submit(task.id)

    return TaskResponse(
        id=task.id,
        name=task.name,
        description=task.description,
        task_type=task.task_type,
        status=task.status,
        targets=list(task.targets or []),
        command=task.command,
        config=task.config,
        parameters=dict(task.parameters or {}),
        results=task.results,
        error_message=task.error_message,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_by=task.created_by,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)) -> TaskResponse:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskResponse(
        id=task.id,
        name=task.name,
        description=task.description,
        task_type=task.task_type,
        status=task.status,
        targets=list(task.targets or []),
        command=task.command,
        config=task.config,
        parameters=dict(task.parameters or {}),
        results=task.results,
        error_message=task.error_message,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_by=task.created_by,
    )


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(get_db)) -> TaskResponse:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="仅 pending 状态允许修改名称/描述")

    if payload.name is not None:
        task.name = payload.name
    if payload.description is not None:
        task.description = payload.description
    await db.commit()
    await db.refresh(task)
    return await get_task(task_id, db=db)


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="仅 pending 任务可取消（running 无法强制中断）")
    task.status = "canceled"
    task.error_message = "canceled"
    task.completed_at = _utc_now()
    await db.commit()
    return {"message": "已取消"}


@router.delete("/{task_id}")
async def delete_task(task_id: int) -> Dict[str, Any]:
    raise HTTPException(status_code=405, detail="不支持删除任务（保留审计记录）")


@router.get("/{task_id}/logs", response_model=List[TaskLogItem])
async def get_task_logs(
    task_id: int,
    limit: int = Query(200, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[TaskLogItem]:
    exists = await db.get(Task, task_id)
    if not exists:
        raise HTTPException(status_code=404, detail="任务不存在")
    rows = (
        await db.execute(
            select(TaskLog)
            .where(TaskLog.task_id == task_id)
            .order_by(desc(TaskLog.id))
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return [
        TaskLogItem(
            id=r.id,
            device_name=r.device_name,
            status=r.status,
            result=r.result,
            raw_output=r.raw_output,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in rows
    ]

@router.get("/stats/summary")
async def get_task_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    total = (await db.execute(select(func.count(Task.id)))).scalar_one()

    status_rows = (
        await db.execute(select(Task.status, func.count(Task.id)).group_by(Task.status))
    ).all()
    status_counts = {str(s): int(c) for s, c in status_rows if s is not None}

    type_rows = (await db.execute(select(Task.task_type, func.count(Task.id)).group_by(Task.task_type))).all()
    type_counts = {str(t): int(c) for t, c in type_rows if t is not None}

    completed = status_counts.get("completed", 0)
    failed = status_counts.get("failed", 0)
    denom = completed + failed
    success_rate = (completed / denom * 100.0) if denom else None

    avg_seconds = (
        await db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        Task.completed_at - Task.started_at,
                    )
                )
            ).where(Task.started_at.is_not(None), Task.completed_at.is_not(None))
        )
    ).scalar_one()

    return {
        "total_tasks": int(total),
        "status_counts": status_counts,
        "tasks_by_type": type_counts,
        "success_rate": success_rate,
        "avg_execution_time_seconds": float(avg_seconds) if avg_seconds is not None else None,
    }
