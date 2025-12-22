"""配置快照（running-config）与备份计划 API 路由"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import setup_logging
from app.models.database import ConfigBackupRun, ConfigBackupSchedule
from app.services.nornir import NornirManager
from app.services import config_snapshot_service

logger = setup_logging(__name__)
router = APIRouter()


def get_nornir_manager(request: Request) -> NornirManager:
    manager = getattr(request.app.state, "nornir_manager", None)
    if not manager:
        raise HTTPException(status_code=503, detail="NornirManager 未初始化")
    return manager


class SaveRunningConfigRequest(BaseModel):
    devices: List[str] = Field(min_length=1)
    command: Optional[str] = None
    timeout: Optional[int] = None


class SnapshotListItem(BaseModel):
    id: int
    device_name: str
    config_type: str
    bytes: int
    sha256: Optional[str]
    collected_at: datetime
    created_by: Optional[str]


class BackupScheduleCreate(BaseModel):
    name: str = Field(min_length=1)
    devices: List[str] = Field(min_length=1)
    interval_minutes: int = Field(ge=1, le=7 * 24 * 60, default=60)
    enabled: bool = True
    run_immediately: bool = True
    command: Optional[str] = None
    timeout: Optional[int] = None


class BackupScheduleUpdate(BaseModel):
    name: Optional[str] = None
    devices: Optional[List[str]] = None
    interval_minutes: Optional[int] = Field(default=None, ge=1, le=7 * 24 * 60)
    enabled: Optional[bool] = None
    run_immediately: Optional[bool] = None
    command: Optional[str] = None
    timeout: Optional[int] = None


class BackupScheduleResponse(BaseModel):
    id: int
    name: str
    enabled: bool
    devices: List[str]
    interval_minutes: int
    command: Optional[str]
    timeout: Optional[int]
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    last_status: Optional[str]
    last_error: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class BackupRunResponse(BaseModel):
    id: int
    schedule_id: int
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    results: Optional[Dict[str, Any]]
    error_message: Optional[str]


@router.post("/snapshots")
async def save_running_config(
    payload: SaveRunningConfigRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    采集并存储 running-config（可一次多台设备）。

    说明：
    - command 为空则按 platform 选择默认命令
    - timeout 映射到 scrapli timeout_ops；为空则按命令规则或默认 180s
    - 默认不返回配置正文（避免前端/网络压力）
    """
    created_by = request.headers.get("X-Dev-User") or request.headers.get("x-dev-user")
    try:
        results = await config_snapshot_service.save_running_config_snapshots(
            db,
            nornir_manager,
            device_names=payload.devices,
            command=payload.command,
            timeout=payload.timeout,
            created_by=created_by,
        )
        return {"results": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"保存 running-config 失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存 running-config 失败: {str(e)}")


@router.get("/snapshots", response_model=List[SnapshotListItem])
async def list_snapshots(
    device_name: Optional[str] = Query(None, description="按设备名称过滤"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[SnapshotListItem]:
    items = await config_snapshot_service.list_snapshots(db, device_name=device_name, limit=limit, offset=offset)
    return [SnapshotListItem(**item.__dict__) for item in items]


@router.get("/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    item = await config_snapshot_service.get_snapshot(db, snapshot_id=snapshot_id)
    if not item:
        raise HTTPException(status_code=404, detail="快照不存在")
    # datetime 让 FastAPI 自动序列化
    return item


@router.get("/schedules", response_model=List[BackupScheduleResponse])
async def list_schedules(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[BackupScheduleResponse]:
    rows = (
        await db.execute(
            select(ConfigBackupSchedule).order_by(desc(ConfigBackupSchedule.id)).limit(limit).offset(offset)
        )
    ).scalars().all()
    return [
        BackupScheduleResponse(
            id=r.id,
            name=r.name,
            enabled=r.enabled,
            devices=list(r.devices or []),
            interval_minutes=r.interval_minutes,
            command=r.command,
            timeout=r.timeout,
            last_run_at=r.last_run_at,
            next_run_at=r.next_run_at,
            last_status=r.last_status,
            last_error=r.last_error,
            created_by=r.created_by,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/schedules", response_model=BackupScheduleResponse)
async def create_schedule(
    payload: BackupScheduleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse:
    created_by = request.headers.get("X-Dev-User") or request.headers.get("x-dev-user")
    now = datetime.now(timezone.utc)

    existing = await db.scalar(
        select(ConfigBackupSchedule)
        .where(ConfigBackupSchedule.name == payload.name)
        .where(ConfigBackupSchedule.created_by == created_by)
        .limit(1)
    )

    if existing:
        schedule = existing
        schedule.devices = payload.devices
        schedule.interval_minutes = payload.interval_minutes
        schedule.command = payload.command
        schedule.timeout = payload.timeout
        schedule.enabled = payload.enabled
    else:
        schedule = ConfigBackupSchedule(
            name=payload.name,
            devices=payload.devices,
            interval_minutes=payload.interval_minutes,
            command=payload.command,
            timeout=payload.timeout,
            enabled=payload.enabled,
            created_by=created_by,
        )
        db.add(schedule)

    if schedule.enabled:
        schedule.next_run_at = now if payload.run_immediately else now + timedelta(minutes=int(schedule.interval_minutes))
    else:
        schedule.next_run_at = None

    await db.commit()
    await db.refresh(schedule)

    return BackupScheduleResponse(
        id=schedule.id,
        name=schedule.name,
        enabled=schedule.enabled,
        devices=list(schedule.devices or []),
        interval_minutes=schedule.interval_minutes,
        command=schedule.command,
        timeout=schedule.timeout,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        last_status=schedule.last_status,
        last_error=schedule.last_error,
        created_by=schedule.created_by,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.put("/schedules/{schedule_id}", response_model=BackupScheduleResponse)
async def update_schedule(
    schedule_id: int,
    payload: BackupScheduleUpdate,
    db: AsyncSession = Depends(get_db),
) -> BackupScheduleResponse:
    schedule = await db.get(ConfigBackupSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="计划不存在")

    if payload.name is not None:
        schedule.name = payload.name
    if payload.devices is not None:
        schedule.devices = payload.devices
    if payload.interval_minutes is not None:
        schedule.interval_minutes = payload.interval_minutes
    if payload.command is not None:
        schedule.command = payload.command
    if payload.timeout is not None:
        schedule.timeout = payload.timeout
    if payload.enabled is not None:
        schedule.enabled = payload.enabled

    now = datetime.now(timezone.utc)
    if schedule.enabled:
        if payload.run_immediately:
            schedule.next_run_at = now
        elif schedule.next_run_at is None:
            schedule.next_run_at = now + timedelta(minutes=int(schedule.interval_minutes))
    else:
        schedule.next_run_at = None

    await db.commit()
    await db.refresh(schedule)
    return BackupScheduleResponse(
        id=schedule.id,
        name=schedule.name,
        enabled=schedule.enabled,
        devices=list(schedule.devices or []),
        interval_minutes=schedule.interval_minutes,
        command=schedule.command,
        timeout=schedule.timeout,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        last_status=schedule.last_status,
        last_error=schedule.last_error,
        created_by=schedule.created_by,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.post("/schedules/{schedule_id}/run-now")
async def run_schedule_now(schedule_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    schedule = await db.get(ConfigBackupSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="计划不存在")
    if not schedule.enabled:
        raise HTTPException(status_code=400, detail="计划未启用")
    schedule.next_run_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "已触发，调度器将尽快执行"}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    schedule = await db.get(ConfigBackupSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="计划不存在")
    await db.delete(schedule)
    await db.commit()
    return {"message": "删除成功"}


@router.get("/schedules/{schedule_id}/runs", response_model=List[BackupRunResponse])
async def list_runs(
    schedule_id: int,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[BackupRunResponse]:
    rows = (
        await db.execute(
            select(ConfigBackupRun)
            .where(ConfigBackupRun.schedule_id == schedule_id)
            .order_by(desc(ConfigBackupRun.started_at), desc(ConfigBackupRun.id))
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return [
        BackupRunResponse(
            id=r.id,
            schedule_id=r.schedule_id,
            started_at=r.started_at,
            completed_at=r.completed_at,
            status=r.status,
            results=r.results,
            error_message=r.error_message,
        )
        for r in rows
    ]
