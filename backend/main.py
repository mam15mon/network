#!/usr/bin/env python3
"""
Nornir Network Management System API
基于 FastAPI + Nornir + Scrapli + PostgreSQL 的网络自动化管理平台
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import apply_dev_migrations
from app.core.request_logging import RequestLoggingMiddleware
from app.api import devices, tasks, inventory, scrapli, configs
from app.services.nornir import NornirManager
from app.services.config_backup_scheduler import ConfigBackupScheduler
from app.services.task_runner import TaskRunner


logger = setup_logging(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("启动 Nornir Network Management System")

    # DEBUG=true 时，执行必要的 schema 兜底迁移（幂等）
    await apply_dev_migrations()

    # 初始化 Nornir Manager
    nornir_manager = NornirManager()
    await nornir_manager.initialize()
    app.state.nornir_manager = nornir_manager

    # 后台任务执行器（命令/配置/采集等）
    task_runner = TaskRunner(nornir_manager, workers=1)
    task_runner.start()
    app.state.task_runner = task_runner

    # 后端定时备份调度器（进程内 interval）
    scheduler = ConfigBackupScheduler(nornir_manager)
    scheduler.start()
    app.state.config_backup_scheduler = scheduler

    yield

    logger.info("关闭 Nornir Network Management System")
    await task_runner.stop()
    await scheduler.stop()
    await nornir_manager.cleanup()


def create_application() -> FastAPI:
    """创建 FastAPI 应用"""

    app = FastAPI(
        title="Nornir Network Management System",
        description="基于 Nornir + Scrapli + PostgreSQL 的网络自动化管理平台",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # CORS 配置
    #
    # 开发模式（DEBUG=true）下，允许任意 Origin，避免本地 Vite 端口变化导致的预检请求失败。
    # 生产模式下，必须显式配置 ALLOWED_HOSTS。
    allow_origins = ["*"] if settings.DEBUG else settings.ALLOWED_HOSTS
    allow_credentials = False if settings.DEBUG else True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 开发模式下打印请求信息（含预检 OPTIONS），请求体仅在 LOG_LEVEL=DEBUG 时输出
    if settings.DEBUG:
        app.add_middleware(RequestLoggingMiddleware)

    # 注册路由
    app.include_router(devices.router, prefix="/api/v1/devices", tags=["设备管理"])
    app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["任务管理"])
    app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["库存管理"])
    app.include_router(scrapli.router, prefix="/api/v1/scrapli", tags=["Scrapli Tasks"])
    app.include_router(configs.router, prefix="/api/v1/configs", tags=["配置快照"])

    # 健康检查
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "nornir-api"}

    return app


app = create_application()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
