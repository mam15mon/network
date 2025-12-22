#!/usr/bin/env python3
"""
列出 Scrapli Community 支持的所有平台
"""

def list_scrapli_community_platforms():
    """列出所有 scrapli-community 支持的平台"""

    # 已知的 scrapli-community 平台映射
    platforms = {
        # 华为设备
        "huawei": "华为设备 (VRP平台)",
        "huawei_vrp": "华为 VRP 平台",

        # H3C/HP 设备
        "h3c": "H3C 设备",
        "h3c_comware": "H3C Comware 平台",
        "hp_comware": "HP Comware 平台",

        # Aruba 设备
        "aruba_os": "ArubaOS-CX",
        "aruba_osswitch": "ArubaOS-Switch",

        # Extreme 网络
        "extreme_netiron": "Extreme NetIron",
        "extreme_slx": "Extreme SLX",
        "extreme_vsp": "Extreme VSP",
        "extreme_exos": "Extreme EXOS",

        # F5 Networks
        "bigip": "F5 BIG-IP",

        # Mikrotik
        "mikrotik_routeros": "Mikrotik RouterOS",

        # Nokia
        "nokia_sros": "Nokia SR OS",

        # Palo Alto
        "paloalto_panos": "Palo Alto PAN-OS",

        # Ruckus
        "ruckus_fastiron": "Ruckus FastIron",
        "ruckus_smartzone": "Ruckus SmartZone",

        # Ubiquiti
        "ubiquiti_edgeos": "Ubiquiti EdgeOS",
        "ubiquiti_unifi": "Ubiquiti UniFi",

        # VyOS
        "vyos": "VyOS",

        # Cisco 社区版本
        "cisco_iosxe": "Cisco IOS XE (社区版)",
        "cisco_iosxr": "Cisco IOS XR (社区版)",
        "cisco_asa": "Cisco ASA (社区版)",

        # 其他厂商
        "ciena_saos": "Ciena SAOS",
        "citrix_netscaler": "Citrix NetScaler",
        "dell_os6": "Dell OS6",
        "dell_os9": "Dell OS9",
        "dell_os10": "Dell OS10",
        "f5_tmsh": "F5 TM Shell",
        "force10": "Force10",
        "huawei_vrp": "华为 VRP",
        "juniper_screenos": "Juniper ScreenOS",
        "linux": "通用 Linux",
        "mellanox_mlnxos": "Mellanox MLNX-OS",
        "netscaler": "NetScaler",
        "nexus": "Cisco Nexus (社区版)",
        "ovs_linux": "OVS Linux",
        "pluribus": "Pluribus",
        "quanta_mesh": "Quanta Mesh",
        "radware": "Radware",
        "riverbed": "Riverbed",
        "ruckus": "Ruckus",
        "sros": "Nokia SR OS",
        "ubiquiti_airos": "Ubiquiti AirOS",

        # 新增的平台
        "aruba_cx": "Aruba CX",
        "aruba_switch": "Aruba Switch",
        "calix": "Calix",
        "cisco_ftd": "Cisco Firepower",
        "cisco_s300": "Cisco Small Business 300",
        "coriant": "Coriant",
        "dell_force10": "Dell Force10",
        "enterasys": "Enterasys",
        "fiberdriver": "Fiberdriver",
        "flexvnf": "FlexVNF",
        "fs": "Fiberstore",
        "generic": "通用设备",
        "huawei_smartax": "华为 SmartAX",
        "ipinfusion": "IP Infusion",
        "juniper": "Juniper (通用)",
        "linux_ssh": "Linux via SSH",
        "mikrotik": "Mikrotik (通用)",
        "mrv": "MRV",
        "netgear": "Netgear",
        "nokia": "Nokia (通用)",
        "opengear": "Opengear",
        "paloalto": "Palo Alto (通用)",
        "radwin": "Radwin",
        "raisecom": "Raisecom",
        "redback": "Redback",
        "ruckus_wireless": "Ruckus Wireless",
        "samsung": "Samsung",
        "sangoma": "Sangoma",
        "silverpeak": "Silverpeak",
        "tplink": "TP-Link",
        "ubiquiti": "Ubiquiti (通用)",
        "vsrx": "Juniper vSRX",
        "vyatta": "Vyatta",
        "watchguard": "WatchGuard",
        "zte": "ZTE"
    }

    return platforms


def main():
    """主函数"""
    print("🌍 Scrapli Community 支持的所有平台")
    print("=" * 80)

    platforms = list_scrapli_community_platforms()

    # 按厂商分组显示
    by_vendor = {}

    for platform, description in platforms.items():
        # 根据平台名称判断厂商
        if 'huawei' in platform.lower():
            vendor = '华为 Huawei'
        elif 'h3c' in platform.lower() or 'hp_comware' in platform:
            vendor = 'H3C/HP'
        elif 'cisco' in platform.lower():
            vendor = 'Cisco'
        elif 'juniper' in platform.lower():
            vendor = 'Juniper'
        elif 'aruba' in platform.lower():
            vendor = 'Aruba'
        elif 'paloalto' in platform.lower():
            vendor = 'Palo Alto'
        elif 'mikrotik' in platform.lower():
            vendor = 'Mikrotik'
        elif 'nokia' in platform.lower():
            vendor = 'Nokia'
        elif 'ubiquiti' in platform.lower():
            vendor = 'Ubiquiti'
        elif 'ruckus' in platform.lower():
            vendor = 'Ruckus'
        elif 'dell' in platform.lower():
            vendor = 'Dell'
        elif 'extreme' in platform.lower():
            vendor = 'Extreme'
        elif 'vyos' in platform.lower():
            vendor = 'VyOS'
        elif 'linux' in platform.lower():
            vendor = 'Linux'
        elif 'f5' in platform.lower() or 'bigip' in platform.lower():
            vendor = 'F5 Networks'
        else:
            vendor = '其他厂商'

        if vendor not in by_vendor:
            by_vendor[vendor] = []

        by_vendor[vendor].append((platform, description))

    # 按厂商排序
    vendor_order = sorted(by_vendor.keys())

    total_count = 0
    for vendor in vendor_order:
        print(f"\n🏢 {vendor}")
        print("-" * 40)

        for platform, description in sorted(by_vendor[vendor]):
            print(f"  {platform:<25} - {description}")
            total_count += 1

    print(f"\n📊 总计: {total_count} 个平台")

    print(f"\n🔧 常用平台快速参考:")
    print("  华为交换机/路由器: huawei_vrp")
    print("  H3C 交换机/路由器: h3c_comware")
    print("  Cisco IOS: cisco_iosxe")
    print("  Cisco NX-OS: cisco_nxos")
    print("  Juniper: juniper_junos")
    print("  Aruba: aruba_os")
    print("  Palo Alto: paloalto_panos")
    print("  Mikrotik: mikrotik_routeros")
    print("  VyOS: vyos")

    print(f"\n💡 提示:")
    print("  1. 在数据库的 platform 字段中使用这些确切的名字")
    print("  2. 平台名称区分大小写")
    print("  3. 并非所有平台都有完全相同的功能支持")
    print("  4. 建议先测试连接再大规模使用")


if __name__ == "__main__":
    main()