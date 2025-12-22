#!/usr/bin/env python3
"""
快速华为设备连接测试
使用原生 Scrapli
"""

import asyncio
from scrapli import Scrapli


async def test_huawei_device(hostname, username, password, description):
    """测试华为设备连接"""
    print(f"\n🔧 测试设备: {description}")
    print(f"   地址: {hostname}")
    print(f"   用户: {username}")

    # 使用原生 Scrapli 测试
    device = Scrapli(
        host=hostname,
        auth_username=username,
        auth_password=password,
        platform="huawei_vrp",  # 使用 scrapli-community 的华为平台
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

        # 测试基本命令
        print("   📋 执行 'display version'...")
        response = device.send_command("display version")

        if not response.failed:
            print("   ✅ 命令执行成功!")
            # 显示前几行版本信息
            lines = response.result.split('\n')[:15]
            for line in lines:
                if line.strip():
                    print(f"      {line}")
        else:
            print("   ❌ 命令执行失败")

        # 测试设备信息命令
        print("   📋 执行 'display device'...")
        response2 = device.send_command("display device")

        if not response2.failed:
            print("   ✅ 'display device' 命令执行成功!")
            lines = response2.result.split('\n')[:10]
            for line in lines:
                if line.strip():
                    print(f"      {line}")
        else:
            print("   ❌ 'display device' 命令执行失败")

        device.close()
        return True

    except Exception as e:
        print(f"   ❌ 连接或执行失败: {e}")
        try:
            device.close()
        except:
            pass
        return False


async def test_other_platform(hostname, username, password, description):
    """测试其他平台名称"""
    print(f"\n🔄 尝试其他平台名称: {description}")

    # 尝试使用 'huawei' 平台名称
    device = Scrapli(
        host=hostname,
        auth_username=username,
        auth_password=password,
        platform="huawei",  # 尝试不同的平台名称
        port=22,
        timeout_socket=15,
        timeout_transport=20,
        timeout_ops=90,
        auth_strict_key=False,
    )

    try:
        print("   📡 正在连接...")
        device.open()
        print("   ✅ 使用 'huawei' 平台连接成功!")

        response = device.send_command("display version")
        if not response.failed:
            print("   ✅ 命令执行成功!")
            lines = response.result.split('\n')[:5]
            for line in lines:
                if line.strip():
                    print(f"      {line}")

        device.close()
        return True

    except Exception as e:
        print(f"   ❌ 'huawei' 平台连接失败: {e}")
        try:
            device.close()
        except:
            pass
        return False


async def main():
    """主函数"""
    print("🧪 华为设备快速连接测试")
    print("=" * 50)

    # 设备信息
    devices = [
        {
            "hostname": "172.19.29.20",
            "username": "zongbuweihu",
            "password": "TIETA@only160",
            "description": "华为 VRP 8.x 设备 (172.19.29.20)"
        },
        {
            "hostname": "172.19.29.33",
            "username": "zongbuweihu",
            "password": "TIETA@only160",
            "description": "华为 VRP 5.x 设备 (172.19.29.33)"
        }
    ]

    success_count = 0
    total_count = len(devices)

    for device_info in devices:
        # 测试1: 使用 huawei_vrp 平台
        success1 = await test_huawei_device(**device_info)

        # 测试2: 尝试其他平台名称
        if not success1:
            success2 = await test_other_platform(**device_info)
            if success2:
                success_count += 1
        else:
            success_count += 1

    print(f"\n📊 测试总结:")
    print(f"   成功: {success_count}/{total_count}")
    print(f"   失败: {total_count - success_count}/{total_count}")

    if success_count > 0:
        print("\n💡 测试结果建议:")
        print("   1. 华为设备可以使用 platform='huawei_vrp'")
        print("   2. VRP 5.x 和 VRP 8.x 都可以使用相同的平台名称")
        print("   3. 可以在数据库中使用这些配置:")
        print("      platform: 'huawei_vrp'")
        print("      timeout_ops: 90 (华为设备建议较长时间)")
        print("      timeout_socket: 15")
        print("      timeout_transport: 20")
    else:
        print("\n❌ 建议:")
        print("   1. 检查网络连接和防火墙设置")
        print("   2. 验证 SSH 配置")
        print("   3. 确认用户名和密码正确")
        print("   4. 检查设备是否允许 SSH 连接")


if __name__ == "__main__":
    asyncio.run(main())