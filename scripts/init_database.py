#!/usr/bin/env python3
"""
数据库初始化脚本
创建数据库表和初始数据
"""

import asyncio
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径（使 `app.*` 可导入）
project_root = Path(__file__).resolve().parent.parent
backend_root = project_root / "backend"
sys.path.insert(0, str(backend_root))

from sqlalchemy import select
from app.core.config import settings
from app.core.database import init_db
from app.models.database import Device, DeviceGroup, DeviceDefaults


async def create_database():
    """创建数据库（如果不存在）"""
    import asyncpg

    # 连接到管理库 postgres，再创建目标数据库
    db_url_parts = settings.database_url_sync.rsplit("/", 1)
    url_prefix = db_url_parts[0]
    db_name = db_url_parts[1]
    admin_url = f"{url_prefix}/postgres"

    try:
        conn = await asyncpg.connect(admin_url)

        # 检查数据库是否存在
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )

        if not exists:
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"✅ 数据库 '{db_name}' 创建成功")
        else:
            print(f"✅ 数据库 '{db_name}' 已存在")

        await conn.close()

    except Exception as e:
        print(f"❌ 创建数据库失败: {e}")
        raise


async def init_default_data():
    """初始化默认数据"""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        try:
            # 默认配置：存在则更新，不存在则创建（幂等）
            default_payload = {
                "username": "admin",
                "password": "password",
                "platform": "cisco_ios",
                "port": 22,
                "timeout": 30,
                "data": {},
                "connection_options": {
                    "scrapli": {
                        "auth_strict_key": False,
                        "timeout_socket": 5,
                        "timeout_transport": 10,
                        "timeout_ops": 30,
                    }
                },
            }
            default_config = await session.scalar(
                select(DeviceDefaults).where(DeviceDefaults.name == "default")
            )
            if default_config:
                for key, value in default_payload.items():
                    setattr(default_config, key, value)
            else:
                session.add(DeviceDefaults(name="default", **default_payload))

            # 创建示例设备组
            group_payloads = [
                {
                    "name": "switches",
                    "description": "网络交换机组",
                    "platform": "cisco_ios",
                    "port": 22,
                    "data": {},
                    "connection_options": {"scrapli": {"auth_strict_key": False}},
                },
                {
                    "name": "routers",
                    "description": "路由器组",
                    "platform": "cisco_ios",
                    "port": 22,
                    "data": {},
                    "connection_options": {"scrapli": {"auth_strict_key": False}},
                },
                {
                    "name": "firewalls",
                    "description": "防火墙组",
                    "platform": "fortinet",
                    "port": 443,
                    "data": {},
                    "connection_options": {"scrapli": {"auth_strict_key": False}},
                },
                {
                    "name": "huawei_switches",
                    "description": "华为交换机组",
                    "platform": "huawei_vrp",
                    "port": 22,
                    "data": {},
                    "connection_options": {
                        "scrapli": {
                            "auth_strict_key": False,
                            "timeout_socket": 10,
                            "timeout_transport": 15,
                            "timeout_ops": 60,
                        }
                    },
                },
                {
                    "name": "h3c_switches",
                    "description": "H3C交换机组",
                    "platform": "h3c_comware",
                    "port": 22,
                    "data": {},
                    "connection_options": {
                        "scrapli": {
                            "auth_strict_key": False,
                            "timeout_socket": 10,
                            "timeout_transport": 15,
                            "timeout_ops": 60,
                        }
                    },
                },
            ]
            for payload in group_payloads:
                existing = await session.scalar(
                    select(DeviceGroup).where(DeviceGroup.name == payload["name"])
                )
                if existing:
                    for key, value in payload.items():
                        if key != "name":
                            setattr(existing, key, value)
                else:
                    session.add(DeviceGroup(**payload))

            # 创建示例设备
            device_payloads = [
                {
                    "name": "switch-01",
                    "hostname": "192.168.1.10",
                    "site": "main",
                    "device_type": "switch",
                    "platform": "cisco_ios",
                    "port": 22,
                    "username": "admin",
                    "password": "password",
                    "group_name": "switches",
                    "vendor": "Cisco",
                    "model": "Catalyst 2960",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "switch-02",
                    "hostname": "192.168.1.11",
                    "site": "main",
                    "device_type": "switch",
                    "platform": "cisco_ios",
                    "port": 22,
                    "username": "admin",
                    "password": "password",
                    "group_name": "switches",
                    "vendor": "Cisco",
                    "model": "Catalyst 2960",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "router-01",
                    "hostname": "192.168.1.1",
                    "site": "main",
                    "device_type": "router",
                    "platform": "cisco_ios",
                    "port": 22,
                    "username": "admin",
                    "password": "password",
                    "group_name": "routers",
                    "vendor": "Cisco",
                    "model": "ISR 4331",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "huawei-sw-01",
                    "hostname": "192.168.2.10",
                    "site": "main",
                    "device_type": "switch",
                    "platform": "huawei_vrp",
                    "port": 22,
                    "username": "admin",
                    "password": "Admin@123",
                    "group_name": "huawei_switches",
                    "vendor": "Huawei",
                    "model": "S5735S-L24P4S-A",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "huawei-sw-core-01",
                    "hostname": "192.168.2.1",
                    "site": "main",
                    "device_type": "switch",
                    "platform": "huawei_vrp",
                    "port": 22,
                    "username": "admin",
                    "password": "Admin@123",
                    "group_name": "huawei_switches",
                    "vendor": "Huawei",
                    "model": "S6730-H48X6C",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "h3c-sw-01",
                    "hostname": "192.168.3.10",
                    "site": "branch",
                    "device_type": "switch",
                    "platform": "h3c_comware",
                    "port": 22,
                    "username": "admin",
                    "password": "Admin@123",
                    "group_name": "h3c_switches",
                    "vendor": "H3C",
                    "model": "S5130S-28P-EI",
                    "data": {},
                    "is_active": True,
                },
                {
                    "name": "h3c-sw-core-01",
                    "hostname": "192.168.3.1",
                    "site": "branch",
                    "device_type": "switch",
                    "platform": "h3c_comware",
                    "port": 22,
                    "username": "admin",
                    "password": "Admin@123",
                    "group_name": "h3c_switches",
                    "vendor": "H3C",
                    "model": "S6850-56HF",
                    "data": {},
                    "is_active": True,
                },
            ]
            for payload in device_payloads:
                existing = await session.scalar(
                    select(Device).where(Device.name == payload["name"])
                )
                if existing:
                    for key, value in payload.items():
                        if key != "name":
                            setattr(existing, key, value)
                else:
                    session.add(Device(**payload))

            await session.commit()
            print("✅ 默认数据初始化成功")

        except Exception as e:
            await session.rollback()
            print(f"❌ 初始化默认数据失败: {e}")
            raise


async def main():
    """主函数"""
    print("🚀 开始初始化数据库...")

    try:
        # 1. 创建数据库
        await create_database()

        # 2. 创建表结构
        print("📝 创建数据库表结构...")
        await init_db()
        print("✅ 数据库表结构创建成功")

        # 2.1 轻量迁移（幂等）：新增 columns / 回填数据
        # 注意：本项目未引入 Alembic，这里采用最小化迁移逻辑，保证开发环境可持续迭代。
        try:
            import asyncpg

            conn = await asyncpg.connect(settings.database_url_sync)
            try:
                await conn.execute('ALTER TABLE devices ADD COLUMN IF NOT EXISTS site VARCHAR(100)')
                await conn.execute('ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(50)')
                await conn.execute(
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
                await conn.execute('CREATE INDEX IF NOT EXISTS idx_config_snapshot_device_time ON config_snapshots(device_id, collected_at)')
                await conn.execute('CREATE INDEX IF NOT EXISTS idx_config_snapshot_collected_at ON config_snapshots(collected_at)')
                await conn.execute(
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
                await conn.execute(
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
                await conn.execute(
                    'CREATE INDEX IF NOT EXISTS idx_config_backup_schedule_enabled_next ON config_backup_schedules(enabled, next_run_at)'
                )
                await conn.execute('CREATE INDEX IF NOT EXISTS idx_config_backup_run_schedule_time ON config_backup_runs(schedule_id, started_at)')
                await conn.execute(
                    """
                    UPDATE devices
                    SET site = data->>'site'
                    WHERE site IS NULL AND data IS NOT NULL AND (data ? 'site')
                    """
                )
                await conn.execute(
                    """
                    UPDATE devices
                    SET device_type = COALESCE(data->>'device_type', data->>'role')
                    WHERE device_type IS NULL AND data IS NOT NULL AND ((data ? 'device_type') OR (data ? 'role'))
                    """
                )
            finally:
                await conn.close()
        except Exception as e:
            print(f"⚠️  数据库迁移步骤失败（可忽略于全新库）: {e}")

        # 3. 初始化默认数据
        print("📊 初始化默认数据...")
        await init_default_data()

        print("🎉 数据库初始化完成！")

    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
