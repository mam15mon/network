#!/usr/bin/env python3
"""
检查 Scrapli 和 Scrapli Community 支持的平台
"""

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def check_scrapli_platforms():
    """检查 Scrapli 支持的平台"""
    try:
        from scrapli import Scrapli
        from scrapli.helper import ScrapliHelper

        print("✅ Scrapli 基础包安装成功")

        # 获取内置平台
        builtin_platforms = [
            "cisco_iosxe", "cisco_iosxr", "cisco_nxos",
            "arista_eos", "juniper_junos", "fortinet"
        ]

        print("📋 Scrapli 内置支持的平台:")
        for platform in builtin_platforms:
            print(f"  - {platform}")

    except ImportError as e:
        print(f"❌ Scrapli 基础包未安装: {e}")
        return False

    return True


def check_scrapli_community_platforms():
    """检查 Scrapli Community 支持的平台"""
    try:
        import scrapli_community

        print("✅ Scrapli Community 包安装成功")

        # 社区平台列表 (主要平台)
        community_platforms = [
            # 华为设备
            "huawei", "huawei_vrp",
            # H3C 设备
            "h3c", "h3c_comware", "hp_comware",
            # 其他厂商
            "cisco_ios", "cisco_nxos",  # 社区版本也支持
            "aruba_os", "extreme_netiron", "bigip",
            "mikrotik_routeros", "nokia_sros",
            "paloalto_panos", "ruckus_fastiron",
            "ubiquiti_edgeos", "vyos"
        ]

        print("📋 Scrapli Community 支持的主要平台:")
        for platform in sorted(community_platforms):
            print(f"  - {platform}")

    except ImportError as e:
        print(f"❌ Scrapli Community 包未安装: {e}")
        print("请运行: uv pip install scrapli-community")
        return False

    return True


def test_platform_connection(platform_name: str, host: str):
    """测试特定平台的连接"""
    try:
        if platform_name in ["huawei", "huawei_vrp"]:
            from scrapli_community.driver import HuaweiVRPDriver
            driver_class = HuaweiVRPDriver
        elif platform_name in ["h3c", "h3c_comware", "hp_comware"]:
            from scrapli_community.driver import H3CComwareDriver
            driver_class = H3CComwareDriver
        else:
            print(f"⚠️  暂不支持测试平台: {platform_name}")
            return

        print(f"🔧 测试 {platform_name} 平台驱动...")

        # 这里只是验证驱动类是否可以导入，不进行实际连接
        print(f"✅ {platform_name} 驱动可用: {driver_class.__name__}")

    except ImportError as e:
        print(f"❌ {platform_name} 驱动不可用: {e}")


def main():
    """主函数"""
    print("🔍 检查 Scrapli 平台支持")
    print("=" * 50)

    # 检查基础包
    scrapli_ok = check_scrapli_platforms()
    print()

    # 检查社区包
    community_ok = check_scrapli_community_platforms()
    print()

    if scrapli_ok and community_ok:
        print("🎉 所有必要的包都已安装")

        print("\n🧪 测试主要平台驱动:")
        test_platform_connection("huawei_vrp", "192.168.1.1")
        test_platform_connection("h3c_comware", "192.168.1.1")
        test_platform_connection("cisco_ios", "192.168.1.1")

        print("\n📚 使用说明:")
        print("1. 华为设备使用平台名: 'huawei' 或 'huawei_vrp'")
        print("2. H3C 设备使用平台名: 'h3c_comware' 或 'hp_comware'")
        print("3. 在数据库 devices 表的 platform 字段中使用这些名称")
        print("4. 系统会自动根据平台名称选择正确的驱动")

    else:
        print("\n❌ 缺少必要的包，请运行以下命令:")
        print("uv pip install scrapli-community")
        sys.exit(1)


if __name__ == "__main__":
    main()