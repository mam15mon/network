#!/usr/bin/env python3
"""
测试华为 VRP 5.x 和 8.x 设备连接
"""

import asyncio
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径（使 `app.*` 可导入）
project_root = Path(__file__).resolve().parent.parent
backend_root = project_root / "backend"
sys.path.insert(0, str(backend_root))

from app.core.config import settings
from app.core.database import init_db
from app.models.database import Device, DeviceGroup
from sqlalchemy.orm import sessionmaker
from app.services.nornir import NornirManager
import asyncpg


async def add_test_devices():
    """添加测试设备到数据库"""

    # 数据库连接
    conn = await asyncpg.connect(settings.database_url_sync)

    try:
        # 删除已存在的测试设备
        await conn.execute("DELETE FROM devices WHERE name LIKE 'test-huawei%'")

        # 创建华为 VRP 8.x 组
        await conn.execute("""
            INSERT INTO device_groups (name, description, platform, data)
            VALUES ('test_huawei_v8', '华为 VRP 8.x 测试组', 'huawei_vrp', '{"vrp_version": "8.x", "test": true}')
            ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            data = EXCLUDED.data
        """)

        # 创建华为 VRP 5.x 组
        await conn.execute("""
            INSERT INTO device_groups (name, description, platform, data)
            VALUES ('test_huawei_v5', '华为 VRP 5.x 测试组', 'huawei_vrp', '{"vrp_version": "5.x", "test": true}')
            ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            data = EXCLUDED.data
        """)

        # 添加 VRP 8.x 设备
        await conn.execute("""
            INSERT INTO devices (
                name, hostname, platform, port, username, password,
                group_name, vendor, model, description, data,
                connection_options, is_active
            ) VALUES (
                'test-huawei-v8-01',
                '172.19.29.20',
                'huawei_vrp',
                22,
                'zongbuweihu',
                'TIETA@only160',
                'test_huawei_v8',
                'Huawei',
                'Unknown',
                '华为 VRP 8.x 测试设备',
                '{"vrp_version": "8.210", "version_type": "modern", "test": true}',
                '{
                    "scrapli": {
                        "auth_strict_key": false,
                        "timeout_socket": 10,
                        "timeout_transport": 15,
                        "timeout_ops": 60
                    }
                }',
                true
            )
            ON CONFLICT (name) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            platform = EXCLUDED.platform,
            username = EXCLUDED.username,
            password = EXCLUDED.password,
            group_name = EXCLUDED.group_name,
            data = EXCLUDED.data,
            connection_options = EXCLUDED.connection_options
        """)

        # 添加 VRP 5.x 设备
        await conn.execute("""
            INSERT INTO devices (
                name, hostname, platform, port, username, password,
                group_name, vendor, model, description, data,
                connection_options, is_active
            ) VALUES (
                'test-huawei-v5-01',
                '172.19.29.33',
                'huawei_vrp',
                22,
                'zongbuweihu',
                'TIETA@only160',
                'test_huawei_v5',
                'Huawei',
                'Unknown',
                '华为 VRP 5.x 测试设备',
                '{"vrp_version": "5.170", "version_type": "legacy", "test": true}',
                '{
                    "scrapli": {
                        "auth_strict_key": false,
                        "timeout_socket": 15,
                        "timeout_transport": 20,
                        "timeout_ops": 90
                    }
                }',
                true
            )
            ON CONFLICT (name) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            platform = EXCLUDED.platform,
            username = EXCLUDED.username,
            password = EXCLUDED.password,
            group_name = EXCLUDED.group_name,
            data = EXCLUDED.data,
            connection_options = EXCLUDED.connection_options
        """)

        print("✅ 测试设备已添加到数据库")
        print("   - VRP 8.x: 172.19.29.20 (test-huawei-v8-01)")
        print("   - VRP 5.x: 172.19.29.33 (test-huawei-v5-01)")

    finally:
        await conn.close()


async def test_connectivity():
    """测试设备连接"""
    print("\n🔧 初始化 Nornir Manager...")

    nornir_manager = NornirManager()
    await nornir_manager.initialize()

    try:
        print("\n📡 测试设备连接性...")

        # 测试 VRP 8.x 设备
        print("\n--- 测试 VRP 8.x 设备 (172.19.29.20) ---")
        v8_result = nornir_manager.test_connectivity(["test-huawei-v8-01"])
        print("VRP 8.x 连接结果:")
        for host, result in v8_result.items():
            status = "✅ 成功" if not result.get("failed") else "❌ 失败"
            print(f"  {host}: {status}")
            if result.get("result"):
                print(f"    输出: {result['result']}")

        # 测试 VRP 5.x 设备
        print("\n--- 测试 VRP 5.x 设备 (172.19.29.33) ---")
        v5_result = nornir_manager.test_connectivity(["test-huawei-v5-01"])
        print("VRP 5.x 连接结果:")
        for host, result in v5_result.items():
            status = "✅ 成功" if not result.get("failed") else "❌ 失败"
            print(f"  {host}: {status}")
            if result.get("result"):
                print(f"    输出: {result['result']}")

        # 如果连接成功，测试基本命令
        if not v8_result.get("test-huawei-v8-01", {}).get("failed") or not v5_result.get("test-huawei-v5-01", {}).get("failed"):
            print("\n📋 测试基本命令...")
            await test_commands(nornir_manager)

    finally:
        await nornir_manager.cleanup()


async def test_commands(nornir_manager):
    """测试基本命令"""

    # 测试 VRP 8.x 设备命令
    if True:  # 假设设备连接成功
        print("\n--- VRP 8.x 命令测试 ---")
        try:
            result = await nornir_manager.send_command(
                ["test-huawei-v8-01"],
                "display version",
                enable=True
            )

            host_result = result.get("test-huawei-v8-01", {})
            if not host_result.get("failed"):
                print("✅ display version 命令执行成功")
                # 只显示前几行版本信息
                output_lines = host_result.get("result", "").split('\n')[:10]
                for line in output_lines:
                    if line.strip():
                        print(f"    {line}")
            else:
                print("❌ display version 命令执行失败")
                if host_result.get("exception"):
                    print(f"    错误: {host_result['exception']}")

        except Exception as e:
            print(f"❌ 命令测试异常: {e}")

    # 测试 VRP 5.x 设备命令
    if True:  # 假设设备连接成功
        print("\n--- VRP 5.x 命令测试 ---")
        try:
            result = await nornir_manager.send_command(
                ["test-huawei-v5-01"],
                "display version",
                enable=True
            )

            host_result = result.get("test-huawei-v5-01", {})
            if not host_result.get("failed"):
                print("✅ display version 命令执行成功")
                # 只显示前几行版本信息
                output_lines = host_result.get("result", "").split('\n')[:10]
                for line in output_lines:
                    if line.strip():
                        print(f"    {line}")
            else:
                print("❌ display version 命令执行失败")
                if host_result.get("exception"):
                    print(f"    错误: {host_result['exception']}")

        except Exception as e:
            print(f"❌ 命令测试异常: {e}")


async def main():
    """主函数"""
    print("🧪 华为 VRP 5.x 和 8.x 设备连接测试")
    print("=" * 50)

    try:
        # 1. 添加测试设备
        await add_test_devices()

        # 2. 测试连接
        await test_connectivity()

        print("\n📝 测试总结:")
        print("1. 检查以上连接和命令执行结果")
        print("2. 如果连接失败，可能需要调整超时参数")
        print("3. 如果命令执行失败，可能需要调整平台名称")

    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
