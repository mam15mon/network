"""安装引导相关接口。"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from core.db.database import Database
from schemas.install import (
    DatabaseConfigPayload,
    InstallActionResponse,
    InstallStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/install", tags=["install"])


def _resolve_db_url(payload: DatabaseConfigPayload) -> str:
    if payload.connection_url:
        return payload.connection_url.strip()

    required_fields = {
        "host": payload.host,
        "username": payload.username,
        "password": payload.password,
        "database": payload.database,
    }
    missing = [key for key, value in required_fields.items() if not value]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"缺少数据库连接信息: {', '.join(missing)}",
        )

    port = payload.port or 5432
    ssl_mode: Optional[str] = payload.ssl_mode or None
    return Database.build_connection_url(
        host=payload.host or "",
        port=port,
        username=payload.username or "",
        password=payload.password or "",
        database=payload.database or "",
        ssl_mode=ssl_mode,
    )


@router.get("/status", response_model=InstallStatus)
def get_install_status() -> InstallStatus:
    """返回当前后端是否处于安装模式。"""
    db = Database()
    return InstallStatus(
        install_mode=db.install_mode,
        database_configured=not db.install_mode,
    )


@router.post("/database/test", response_model=InstallActionResponse)
def test_database_connection(payload: DatabaseConfigPayload) -> InstallActionResponse:
    """测试数据库连接是否可用。"""
    db_url = _resolve_db_url(payload)
    try:
        Database.test_connection(db_url)
    except SQLAlchemyError as exc:  # noqa: BLE001
        logger.warning("数据库连接测试失败: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("数据库连接测试异常: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return InstallActionResponse(success=True, message="数据库连接成功")


@router.post("/database/apply", response_model=InstallActionResponse)
def apply_database_configuration(payload: DatabaseConfigPayload) -> InstallActionResponse:
    """保存数据库配置并初始化默认数据。"""
    db = Database()
    if not db.install_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="数据库已配置，无需重复安装",
        )

    db_url = _resolve_db_url(payload)
    try:
        db.configure(db_url)
    except SQLAlchemyError as exc:  # noqa: BLE001
        logger.error("保存数据库配置失败: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("初始化数据库失败: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return InstallActionResponse(success=True, message="数据库配置已保存")
