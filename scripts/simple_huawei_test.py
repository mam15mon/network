#!/usr/bin/env python3
"""
简化的华为设备连接测试
直接使用 scrapli 测试连接
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from scrapli import Scrapli
    from scrapli_community.huawei.vrp.async_driver import AsyncHuaweiVRPDriver
except ImportError as e:
    print(f"❌ 导入错误: {e}")
    print("请确保已安装 scrapli-community")
    sys.exit(1)


async def test_huawei_device(hostname, username, password, description):
    """测试单个华为设备连接"""
    print(f"\n🔧 测试设备: {description}")
    print(f"   地址: {hostname}")
    print(f"   用户: {username}")

    # 华为设备连接参数
    device = AsyncHuaweiVRPDriver(
        host=hostname,
        auth_username=username,
        auth_password=password,
        port=22,
        timeout_socket=15,
        timeout_transport=20,
        timeout_ops=90,
        auth_strict_key=False,
    )

    try:
        print("   📡 正在连接...")
        await device.open()
        print("   ✅ 连接成功!")

        # 测试基本命令
        print("   📋 执行 'display version' 命令...")
        response = await device.send_command("display version")

        if not response.failed:
            print("   ✅ 命令执行成功!")
            # 显示前几行版本信息
            lines = response.result.split('\n')[:15]
            for line in lines:
                if line.strip():
                    print(f"      {line}")
        else:
            print("   ❌ 命令执行失败")
            if response.exception:
                print(f"      错误: {response.exception}")

        # 测试另一个命令
        print("   📋 执行 'display device' 命令...")
        response2 = await device.send_command("display device")

        if not response2.failed:
            print("   ✅ 'display device' 命令执行成功!")
            # 显示设备信息
            lines = response2.result.split('\n')[:10]
            for line in lines:
                if line.strip():
                    print(f"      {line}")
        else:
            print("   ❌ 'display device' 命令执行失败")

        await device.close()
        print("   🔚 连接已关闭")
        return True

    except Exception as e:
        print(f"   ❌ 连接或执行失败: {e}")
        try:
            await device.close()
        except:
            pass
        return False


async def test_with_scrapli(hostname, username, password, description):
    """使用原生 scrapli 测试"""
    print(f"\n🔧 使用原生 Scrapli 测试: {description}")

    device = Scrapli(
        host=hostname,
        auth_username=username,
        auth_password=password,
        platform="huawei_vrp",  # 使用 scrapli-community 平台
        port=22,
        timeout_socket=15,
        timeout_transport=20,
        timeout_ops=90,
        auth_strict_key=False,
    )

    try:
        print("   📡 正在连接...")
        device.open()
        print("   ✅ 连接成功!")

        # 测试命令
        response = device.send_command("display version")
        print("   ✅ 命令执行成功!")

        # 显示版本信息
        lines = response.result.split('\n')[:10]
        for line in lines:
            if line.strip():
                print(f"      {line}")

        device.close()
        return True

    except Exception as e:
        print(f"   ❌ 测试失败: {e}")
        try:
            device.close()
        except:
            pass
        return False


async def main():
    """主函数"""
    print("🧪 华为 VRP 设备连接测试")
    print("=" * 50)

    # 设备信息
    devices = [
        {
            "hostname": "172.19.29.20",
            "username": "zongbuweihu",
            "password": "TIETA@only160",
            "description": "华为 VRP 8.x 设备"
        },
        {
            "hostname": "172.19.29.33",
            "username": "zongbuweihu",
            "password": "TIETA@only160",
            "description": "华为 VRP 5.x 设备"
        }
    ]

    success_count = 0
    total_count = len(devices)

    for device_info in devices:
        # 测试1: 使用 HuaweiVRPDriver
        success1 = await test_huawei_device(**device_info)

        # 测试2: 使用原生 Scrapli
        success2 = await test_with_scrapli(**device_info)

        if success1 or success2:
            success_count += 1

    print(f"\n📊 测试总结:")
    print(f"   成功: {success_count}/{total_count}")
    print(f"   失败: {total_count - success_count}/{total_count}")

    if success_count > 0:
        print("\n💡 建议:")
        print("   1. 如果连接成功，可以在数据库中使用 platform='huawei_vrp'")
        print("   2. 根据测试结果调整超时参数")
        print("   3. VRP 5.x 和 VRP 8.x 都可以使用相同的平台名称")
    else:
        print("\n❌ 建议:")
        print("   1. 检查网络连接和防火墙设置")
        print("   2. 验证 SSH 配置")
        print("   3. 确认用户名和密码正确")


if __name__ == "__main__":
    asyncio.run(main())