"""Scrapli/Nornir 任务 API（透出 nornir-scrapli 内置 tasks）"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.logging import setup_logging
from app.services.nornir import NornirManager, SCRAPLI_MUTATING_TASKS

logger = setup_logging(__name__)
router = APIRouter()


def get_nornir_manager(request: Request) -> NornirManager:
    manager = getattr(request.app.state, "nornir_manager", None)
    if not manager:
        raise HTTPException(status_code=503, detail="NornirManager 未初始化")
    return manager


class ScrapliRunRequest(BaseModel):
    hosts: List[str] = Field(min_length=1)
    task: str
    params: Dict[str, Any] = Field(default_factory=dict)
    confirm: bool = False


@router.get("/tasks")
async def list_tasks() -> Dict[str, Any]:
    """
    返回后端允许调用的 nornir-scrapli tasks 列表。

    说明：
    - tasks 是第三方库“能力集合”，不会自动变成 HTTP API；
    - 本端点仅列出本项目允许对外暴露的 task 名称。
    """
    return NornirManager.list_scrapli_tasks()


@router.post("/run")
async def run_task(
    request: ScrapliRunRequest,
    nornir_manager: NornirManager = Depends(get_nornir_manager),
) -> Dict[str, Any]:
    """
    通用执行入口：按 task 名称调用 nornir-scrapli 内置任务。

    安全约束（KISS）：
    - 对会修改设备状态的 task（如 send_config/cfg_load_config/netconf_edit_config 等）要求 confirm=true。
    """
    try:
        if request.task in SCRAPLI_MUTATING_TASKS and not request.confirm:
            raise HTTPException(
                status_code=400,
                detail=f"task {request.task} 属于修改类操作，需要 confirm=true 才允许执行",
            )

        return await nornir_manager.run_scrapli_task(
            hosts=request.hosts,
            task_name=request.task,
            params=request.params,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("执行 scrapli task 失败: %s", e)
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")
