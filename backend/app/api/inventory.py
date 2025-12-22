"""库存管理 API 路由"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import setup_logging
from app.core.database import get_db
from app.services.nornir import NornirManager
from app.services import inventory_service

logger = setup_logging(__name__)
router = APIRouter()

def get_nornir_manager(request: Request) -> NornirManager:
    manager = getattr(request.app.state, "nornir_manager", None)
    if not manager:
        raise HTTPException(status_code=503, detail="NornirManager 未初始化")
    return manager


# Pydantic 模型
class DeviceCreate(BaseModel):
    name: str
    hostname: str
    site: Optional[str] = None
    device_type: Optional[str] = None
    platform: str = "cisco_ios"
    port: int = 22
    username: Optional[str] = None
    password: Optional[str] = None
    timeout: Optional[int] = None
    group_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    connection_options: Optional[Dict[str, Any]] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True


class DeviceUpdate(BaseModel):
    hostname: Optional[str] = None
    site: Optional[str] = None
    device_type: Optional[str] = None
    platform: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    timeout: Optional[int] = None
    group_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    connection_options: Optional[Dict[str, Any]] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    hostname: str
    site: Optional[str]
    device_type: Optional[str]
    platform: str
    port: int
    username: Optional[str]
    timeout: Optional[int]
    group_name: Optional[str]
    data: Optional[Dict[str, Any]]
    connection_options: Optional[Dict[str, Any]]
    vendor: Optional[str]
    model: Optional[str]
    os_version: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    last_connected: Optional[datetime]


class BulkUpsertError(BaseModel):
    index: int
    name: Optional[str] = None
    error: str


class BulkUpsertResponse(BaseModel):
    created: int
    updated: int
    failed: int
    errors: List[BulkUpsertError]

class BulkDeleteRequest(BaseModel):
    names: List[str]
    confirm: bool = False


class BulkDeleteResponse(BaseModel):
    deleted: int
    not_found: List[str]
    failed: int
    errors: List[Dict[str, Any]]


class ConnectivityTestOptions(BaseModel):
    force_refresh: bool = False
    refresh_if_missing: bool = True


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    platform: Optional[str] = None
    port: Optional[int] = None
    timeout: Optional[int] = None
    data: Optional[Dict[str, Any]] = None
    connection_options: Optional[Dict[str, Any]] = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    username: Optional[str]
    password: Optional[str]
    platform: Optional[str]
    port: Optional[int]
    timeout: Optional[int]
    data: Optional[Dict[str, Any]]
    connection_options: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime]
    devices_count: int


@router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(
    group: Optional[str] = Query(None, description="按组过滤"),
    site: Optional[str] = Query(None, description="按站点过滤"),
    device_type: Optional[str] = Query(None, description="按设备类型过滤"),
    platform: Optional[str] = Query(None, description="按平台过滤"),
    vendor: Optional[str] = Query(None, description="按厂商过滤"),
    is_active: Optional[bool] = Query(None, description="按活跃状态过滤"),
    search: Optional[str] = Query(None, description="搜索设备名称或主机名"),
    limit: int = Query(50, ge=1, le=1000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量")
    ,
    db: AsyncSession = Depends(get_db),
) -> List[DeviceResponse]:
    """
    获取设备列表
    """
    try:
        rows = await inventory_service.list_devices(
            db,
            group=group,
            site=site,
            device_type=device_type,
            platform=platform,
            vendor=vendor,
            is_active=is_active,
            search=search,
            limit=limit,
            offset=offset,
        )
        return [DeviceResponse(**row) for row in rows]

    except Exception as e:
        logger.error(f"获取设备列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备列表失败: {str(e)}")


@router.post("/devices", response_model=DeviceResponse)
async def create_device(device: DeviceCreate, db: AsyncSession = Depends(get_db)) -> DeviceResponse:
    """
    创建新设备
    """
    try:
        row = await inventory_service.create_device(db, payload=device.model_dump())
        return DeviceResponse(**row)

    except Exception as e:
        logger.error(f"创建设备失败: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"创建设备失败: {str(e)}")


@router.get("/devices/{device_name}", response_model=DeviceResponse)
async def get_device(device_name: str, db: AsyncSession = Depends(get_db)) -> DeviceResponse:
    """
    获取设备详情
    """
    try:
        row = await inventory_service.get_device(db, device_name=device_name)
        return DeviceResponse(**row)

    except Exception as e:
        logger.error(f"获取设备详情失败: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"获取设备详情失败: {str(e)}")


@router.post("/devices/{device_name}/connectivity-test")
async def test_device_connectivity(
    device_name: str,
    options: ConnectivityTestOptions = ConnectivityTestOptions(),
    db: AsyncSession = Depends(get_db),
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    测试单台设备连接性（验证用户名/密码/SSH/Scrapli 是否可用）。

    注意：NornirManager 会缓存库存；如果刚新增/导入设备，建议刷新库存。
    本端点默认在设备未加载时自动刷新。
    """
    # 先校验设备在 DB 中存在
    try:
        await inventory_service.get_device(db, device_name=device_name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询设备失败: {str(e)}")

    if options.force_refresh:
        await nornir_manager.cleanup()
        await nornir_manager.initialize()
    elif options.refresh_if_missing:
        try:
            loaded_hosts = set(nornir_manager.get_inventory_hosts())
        except Exception:
            loaded_hosts = set()
        if device_name not in loaded_hosts:
            await nornir_manager.cleanup()
            await nornir_manager.initialize()

    try:
        results = nornir_manager.test_connectivity([device_name])
        return results.get(device_name, {"failed": True, "exception": "未返回结果"})
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"连接测试失败: {str(e)}")


@router.put("/devices/{device_name}", response_model=DeviceResponse)
async def update_device(
    device_name: str,
    device_update: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """
    更新设备信息
    """
    try:
        logger.info(f"更新设备: {device_name}")

        # 更新字段
        payload = device_update.model_dump(exclude_unset=True)
        row = await inventory_service.update_device(db, device_name=device_name, payload=payload)
        return DeviceResponse(**row)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新设备失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新设备失败: {str(e)}")


@router.delete("/devices/{device_name}")
async def delete_device(device_name: str, db: AsyncSession = Depends(get_db)) -> Dict[str, str]:
    """
    删除设备
    """
    try:
        logger.info(f"删除设备: {device_name}")
        await inventory_service.delete_device(db, device_name=device_name)

        return {"message": f"设备 {device_name} 删除成功"}

    except Exception as e:
        logger.error(f"删除设备失败: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"删除设备失败: {str(e)}")


@router.post("/devices/bulk", response_model=BulkUpsertResponse)
async def bulk_upsert_devices(
    devices: List[DeviceCreate],
    db: AsyncSession = Depends(get_db),
) -> BulkUpsertResponse:
    """
    批量 upsert 设备（用于 XLSX 导入）。

    - name 存在则更新（仅覆盖非空字段，password None 不覆盖）
    - name 不存在则创建
    """
    created, updated, errors = await inventory_service.bulk_upsert_devices(
        db,
        items=[d.model_dump() for d in devices],
    )
    return BulkUpsertResponse(
        created=created,
        updated=updated,
        failed=len(errors),
        errors=[BulkUpsertError(**e) for e in errors],
    )


@router.post("/devices/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_devices(
    request: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
) -> BulkDeleteResponse:
    deleted, not_found, errors = await inventory_service.bulk_delete_devices(
        db,
        names=request.names,
        confirm=request.confirm,
    )
    return BulkDeleteResponse(
        deleted=deleted,
        not_found=not_found,
        failed=len(errors),
        errors=errors,
    )


@router.get("/groups", response_model=List[GroupResponse])
async def list_groups(db: AsyncSession = Depends(get_db)) -> List[GroupResponse]:
    """
    获取设备组列表
    """
    try:
        logger.info("获取设备组列表")
        rows = await inventory_service.list_groups(db)
        return [GroupResponse(**row) for row in rows]

    except Exception as e:
        logger.error(f"获取设备组列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备组列表失败: {str(e)}")


@router.post("/groups", response_model=GroupResponse)
async def create_group(group: GroupCreate, db: AsyncSession = Depends(get_db)) -> GroupResponse:
    """
    创建设备组
    """
    try:
        logger.info(f"创建设备组: {group.name}")
        row = await inventory_service.create_group(db, payload=group.model_dump())
        return GroupResponse(**row)

    except Exception as e:
        logger.error(f"创建设备组失败: {e}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"创建设备组失败: {str(e)}")


@router.post("/refresh")
async def refresh_inventory(
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, str]:
    """
    刷新库存缓存
    """
    try:
        logger.info("刷新库存缓存")

        await nornir_manager.cleanup()
        await nornir_manager.initialize()

        return {"message": "库存缓存刷新成功"}

    except Exception as e:
        logger.error(f"刷新库存缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"刷新库存缓存失败: {str(e)}")


@router.get("/stats")
async def get_inventory_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    获取库存统计信息
    """
    try:
        logger.info("获取库存统计信息")
        return await inventory_service.get_inventory_stats(db)

    except Exception as e:
        logger.error(f"获取库存统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取库存统计失败: {str(e)}")
