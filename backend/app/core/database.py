"""数据库连接和会话管理"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# 创建异步数据库引擎
engine = create_async_engine(
    settings.database_url_async,
    echo=settings.SQLALCHEMY_ECHO,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# 创建异步会话工厂
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    获取数据库会话

    Yields:
        AsyncSession: 数据库会话
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """初始化数据库"""
    async with engine.begin() as conn:
        # 导入所有模型以确保它们被注册
        from app.models.database import Base
        await conn.run_sync(Base.metadata.create_all)


async def apply_dev_migrations() -> None:
    """
    开发环境轻量迁移（幂等）。

    说明：本项目未引入 Alembic；为避免“代码已新增字段但库里缺列”导致启动/请求失败，
    在 DEBUG=true 时执行必要的 ALTER TABLE 兜底。
    """
    if not settings.DEBUG:
        return

    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS site VARCHAR(100)"))
        await conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(50)"))

        # tasks / task_logs（幂等，避免“已启用 tasks API 但库缺表”）
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    task_type VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    targets JSON NOT NULL,
                    command TEXT,
                    config TEXT,
                    parameters JSON,
                    results JSON,
                    error_message TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    created_by VARCHAR(100)
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS task_logs (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    device_name VARCHAR(100) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    result JSON,
                    raw_output TEXT,
                    error_message TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_task_device ON task_logs(task_id, device_name)"))

        # running-config 快照表（幂等）
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS config_snapshots (
                    id SERIAL PRIMARY KEY,
                    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                    config_type VARCHAR(20) NOT NULL DEFAULT 'running',
                    content TEXT NOT NULL,
                    content_sha256 VARCHAR(64),
                    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    created_by VARCHAR(100)
                )
                """
            )
        )
        await conn.execute(text("ALTER TABLE config_snapshots ADD COLUMN IF NOT EXISTS content_sha256 VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE config_snapshots ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)"))
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_config_snapshot_device_time ON config_snapshots(device_id, collected_at)")
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_config_snapshot_collected_at ON config_snapshots(collected_at)"))

        # 备份计划与运行记录（幂等）
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS config_backup_schedules (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    devices JSON NOT NULL,
                    interval_minutes INTEGER NOT NULL DEFAULT 60,
                    command TEXT,
                    timeout INTEGER,
                    last_run_at TIMESTAMPTZ,
                    next_run_at TIMESTAMPTZ,
                    last_status VARCHAR(20),
                    last_error TEXT,
                    created_by VARCHAR(100),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS config_backup_runs (
                    id SERIAL PRIMARY KEY,
                    schedule_id INTEGER NOT NULL REFERENCES config_backup_schedules(id) ON DELETE CASCADE,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    completed_at TIMESTAMPTZ,
                    status VARCHAR(20) NOT NULL DEFAULT 'running',
                    results JSON,
                    error_message TEXT
                )
                """
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_config_backup_schedule_enabled_next ON config_backup_schedules(enabled, next_run_at)"
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_config_backup_schedule_next ON config_backup_schedules(next_run_at)"))
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_config_backup_run_schedule_time ON config_backup_runs(schedule_id, started_at)")
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_config_backup_run_started_at ON config_backup_runs(started_at)"))


async def close_db() -> None:
    """关闭数据库连接"""
    await engine.dispose()
