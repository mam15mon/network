"""设备管理 API 路由"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.core.logging import setup_logging
from app.services.nornir import NornirManager

logger = setup_logging(__name__)
router = APIRouter()


def get_nornir_manager(request: Request) -> NornirManager:
    manager = getattr(request.app.state, "nornir_manager", None)
    if not manager:
        raise HTTPException(status_code=503, detail="NornirManager 未初始化")
    return manager


# Pydantic 模型
class DeviceInfo(BaseModel):
    name: str
    hostname: str
    platform: str
    port: Optional[int] = None
    username: Optional[str] = None
    group: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class CommandRequest(BaseModel):
    hosts: List[str]
    command: str
    enable: bool = False
    timeout: Optional[int] = None


class ConfigRequest(BaseModel):
    hosts: List[str]
    commands: List[str]
    dry_run: bool = False
    timeout: Optional[int] = None


class ConnectivityTestRequest(BaseModel):
    hosts: List[str]


@router.get("/", response_model=List[str])
async def list_devices(
    group: Optional[str] = Query(None, description="按组过滤"),
    platform: Optional[str] = Query(None, description="按平台过滤"),
    site: Optional[str] = Query(None, description="按站点过滤"),
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> List[str]:
    """
    获取设备列表
    """
    try:
        filters: Dict[str, Any] = {}
        if group:
            filters["group"] = group
        if platform:
            filters["platform"] = platform
        if site:
            filters["site"] = site

        return nornir_manager.get_inventory_hosts(filters=filters or None)

    except Exception as e:
        logger.error(f"获取设备列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备列表失败: {str(e)}")


@router.get("/{device_name}", response_model=DeviceInfo)
async def get_device(
    device_name: str,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> DeviceInfo:
    """
    获取设备详细信息
    """
    try:
        details = nornir_manager.get_host_details(device_name)
        if not details:
            raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")

        groups = details.get("groups") or []
        return DeviceInfo(
            name=details["name"],
            hostname=details["hostname"],
            platform=details["platform"],
            port=details.get("port"),
            username=details.get("username"),
            group=groups[0] if groups else None,
            data=details.get("data"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取设备信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备信息失败: {str(e)}")


@router.post("/command")
async def send_command(
    request: CommandRequest,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    在设备上执行命令
    """
    try:
        logger.info(f"在设备 {request.hosts} 上执行命令: {request.command}")
        return await nornir_manager.send_command(
            hosts=request.hosts,
            command=request.command,
            enable=request.enable,
            timeout=request.timeout,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"执行命令失败: {e}")
        raise HTTPException(status_code=500, detail=f"执行命令失败: {str(e)}")


@router.post("/config")
async def send_config(
    request: ConfigRequest,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    在设备上配置命令
    """
    try:
        logger.info(f"在设备 {request.hosts} 上配置: {request.commands}")
        return await nornir_manager.send_config(
            hosts=request.hosts,
            commands=request.commands,
            dry_run=request.dry_run,
            timeout=request.timeout,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"配置失败: {str(e)}")


@router.post("/connectivity-test")
async def test_connectivity(
    request: ConnectivityTestRequest,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    测试设备连接性
    """
    try:
        logger.info(f"测试设备连接性: {request.hosts}")
        return nornir_manager.test_connectivity(request.hosts)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"连接测试失败: {e}")
        raise HTTPException(status_code=500, detail=f"连接测试失败: {str(e)}")


@router.get("/{device_name}/facts")
async def get_device_facts(
    device_name: str,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    获取设备事实信息
    """
    try:
        logger.info(f"获取设备 {device_name} 的事实信息")
        result = await nornir_manager.get_facts([device_name])
        host_result = result.get(device_name)
        if host_result is None:
            raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")
        return host_result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取设备事实信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备事实信息失败: {str(e)}")


@router.get("/{device_name}/interfaces")
async def get_device_interfaces(
    device_name: str,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    获取设备接口信息
    """
    try:
        logger.info(f"获取设备 {device_name} 的接口信息")
        result = await nornir_manager.get_interfaces([device_name])
        host_result = result.get(device_name)
        if host_result is None:
            raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")
        return host_result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取设备接口信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取设备接口信息失败: {str(e)}")
