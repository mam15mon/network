# Scrapli Community 完整平台支持列表

## 🌍 概述

Scrapli Community 是一个社区驱动的项目，扩展了 Scrapli 的设备支持范围。目前支持 **78 个平台**，涵盖主流网络设备厂商。

---

## 🏢 按厂商分类

### 华为 Huawei (3个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `huawei` | 华为交换机/路由器 | 华为设备通用平台 |
| `huawei_vrp` | 华为 VRP 平台 | **推荐使用** - 华为 VRP 系统平台 |
| `huawei_smartax` | 华为 SmartAX | 华为接入网设备 |

### H3C/HP (3个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `h3c` | H3C 通用设备 | H3C 设备通用平台 |
| `h3c_comware` | H3C Comware | **推荐使用** - H3C Comware 系统 |
| `hp_comware` | HP Comware | HP 品牌的 Comware 系统 |

### Cisco (5个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `cisco_iosxe` | Cisco IOS XE | Cisco IOS XE 系列设备 |
| `cisco_iosxr` | Cisco IOS XR | Cisco IOS XR 系列设备 |
| `cisco_asa` | Cisco ASA | Cisco 防火墙设备 |
| `cisco_ftd` | Cisco Firepower | Cisco Firepower 防火墙 |
| `cisco_s300` | Cisco SMB 300 | Cisco 小型企业 300 系列 |

### Juniper (2个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `juniper` | Juniper 通用 | Juniper 设备通用平台 |
| `juniper_screenos` | Juniper ScreenOS | Juniper ScreenOS 防火墙 |

### Aruba (4个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `aruba_os` | ArubaOS-CX | Aruba CX 交换机 |
| `aruba_cx` | Aruba CX | Aruba CX 交换机 (别名) |
| `aruba_osswitch` | ArubaOS-Switch | Aruba OS 交换机 |
| `aruba_switch` | Aruba Switch | Aruba 交换机 (别名) |

### Palo Alto (2个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `paloalto_panos` | Palo Alto PAN-OS | **推荐使用** - Palo Alto 防火墙 |
| `paloalto` | Palo Alto 通用 | Palo Alto 通用平台 |

### Mikrotik (2个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `mikrotik_routeros` | Mikrotik RouterOS | **推荐使用** - Mikrotik 路由器系统 |
| `mikrotik` | Mikrotik 通用 | Mikrotik 通用平台 |

### Nokia (2个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `nokia_sros` | Nokia SR OS | **推荐使用** - Nokia 服务路由器系统 |
| `nokia` | Nokia 通用 | Nokia 通用平台 |

### Dell (4个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `dell_os10` | Dell OS10 | Dell OS10 系统 |
| `dell_os9` | Dell OS9 | Dell OS9 系统 |
| `dell_os6` | Dell OS6 | Dell OS6 系统 |
| `dell_force10` | Dell Force10 | Dell Force10 交换机 |

### Extreme (4个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `extreme_exos` | Extreme EXOS | Extreme EXOS 交换机 |
| `extreme_netiron` | Extreme NetIron | Extreme NetIron 路由器 |
| `extreme_slx` | Extreme SLX | Extreme SLX 交换机 |
| `extreme_vsp` | Extreme VSP | Extreme VSP 交换机 |

### Ubiquiti (4个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `ubiquiti_edgeos` | Ubiquiti EdgeOS | **推荐使用** - Ubiquiti EdgeRouter |
| `ubiquiti_unifi` | Ubiquiti UniFi | Ubiquiti UniFi 交换机 |
| `ubiquiti_airos` | Ubiquiti AirOS | Ubiquiti AirMax 设备 |
| `ubiquiti` | Ubiquiti 通用 | Ubiquiti 通用平台 |

### Ruckus (4个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `ruckus_fastiron` | Ruckus FastIron | Ruckus FastIron 交换机 |
| `ruckus_smartzone` | Ruckus SmartZone | Ruckus SmartZone 控制器 |
| `ruckus_wireless` | Ruckus 无线 | Ruckus 无线设备 |
| `ruckus` | Ruckus 通用 | Ruckus 通用平台 |

### F5 Networks (2个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `bigip` | F5 BIG-IP | **推荐使用** - F5 BIG-IP 负载均衡器 |
| `f5_tmsh` | F5 TM Shell | F5 TM Shell 接口 |

### Linux (3个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `linux` | 通用 Linux | 通用 Linux 系统 |
| `linux_ssh` | Linux via SSH | 通过 SSH 连接的 Linux |
| `ovs_linux` | OVS Linux | Open vSwitch Linux |

### VyOS (1个平台)
| 平台名称 | 适用设备 | 说明 |
|---------|---------|------|
| `vyos` | VyOS | VyOS 路由器系统 |

---

## 🔧 其他厂商平台

### 网络设备厂商
| 平台名称 | 厂商 | 设备类型 |
|---------|------|---------|
| `calix` | Calix | 光纤接入设备 |
| `ciena_saos` | Ciena | SAOS 系统 |
| `citrix_netscaler` | Citrix | NetScaler 负载均衡器 |
| `coriant` | Coriant | 光传输设备 |
| `enterasys` | Enterasys | 网络交换机 |
| `fiberdriver` | Fiberdriver | 光网络设备 |
| `flexvnf` | 未知 | FlexVNF 虚拟网络功能 |
| `force10` | Dell Force10 | Force10 交换机 |
| `fs` | Fiberstore | 光网络设备 |
| `ipinfusion` | IP Infusion | OcNOS 系统 |
| `mellanox_mlnxos` | Mellanox | MLNX-OS 系统 |
| `mrv` | MRV | 光通信设备 |
| `netgear` | Netgear | 网络设备 |
| `netscaler` | Citrix | NetScaler (别名) |
| `nexus` | Cisco | Nexus 交换机 (社区版) |
| `opengear` | Opengear | 控制台服务器 |
| `pluribus` | Pluribus | 网络虚拟化 |
| `quanta_mesh` | Quanta | 网格网络 |
| `radware` | Radware | 应用交付控制器 |
| `radwin` | Radwin | 无线宽带 |
| `raisecom` | Raisecom | 网络设备 |
| `redback` | Redback | 路由器 |
| `riverbed` | Riverbed | 网络优化 |
| `samsung` | Samsung | 网络设备 |
| `sangoma` | Sangoma | 通信设备 |
| `silverpeak` | Silverpeak | SD-WAN |
| `tplink` | TP-Link | 网络设备 |
| `vsrx` | Juniper | vSRX 虚拟防火墙 |
| `vyatta` | Vyatta | 网络操作系统 |
| `watchguard` | WatchGuard | 防火墙 |
| `zte` | ZTE | 网络设备 |

---

## 🎯 推荐使用

### 国内常用设备
| 厂商 | 推荐平台 | 适用场景 |
|------|---------|---------|
| 华为 | `huawei_vrp` | 交换机、路由器、防火墙 |
| H3C | `h3c_comware` | 交换机、路由器 |
| 中兴 | `zte` | 交换机、路由器 |

### 国外常用设备
| 厂商 | 推荐平台 | 适用场景 |
|------|---------|---------|
| Cisco | `cisco_iosxe` | 交换机、路由器 |
| Juniper | `juniper_junos` | 交换机、路由器、防火墙 |
| Aruba | `aruba_os` | 无线控制器、交换机 |
| Palo Alto | `paloalto_panos` | 防火墙 |
| F5 | `bigip` | 负载均衡器 |

### 开源/虚拟化
| 平台 | 推荐平台 | 适用场景 |
|------|---------|---------|
| VyOS | `vyos` | 软件路由器 |
| Linux | `linux` | 服务器网络管理 |
| Open vSwitch | `ovs_linux` | 虚拟交换机 |

---

## 📝 使用示例

### 华为设备
```sql
INSERT INTO devices (name, hostname, platform, username, password, vendor, model)
VALUES ('huawei-sw-01', '192.168.1.10', 'huawei_vrp', 'admin', 'Admin@123', 'Huawei', 'S5735S');
```

### H3C 设备
```sql
INSERT INTO devices (name, hostname, platform, username, password, vendor, model)
VALUES ('h3c-sw-01', '192.168.1.20', 'h3c_comware', 'admin', 'Admin@123', 'H3C', 'S5130S');
```

### 其他厂商设备
```sql
-- Mikrotik
INSERT INTO devices (name, hostname, platform, username, password, vendor, model)
VALUES ('mikrotik-01', '192.168.1.30', 'mikrotik_routeros', 'admin', 'password', 'Mikrotik', 'RB4011');

-- Palo Alto
INSERT INTO devices (name, hostname, platform, username, password, vendor, model)
VALUES ('paloalto-01', '192.168.1.40', 'paloalto_panos', 'admin', 'password', 'Palo Alto', 'PA-220');
```

---

## ⚠️ 注意事项

### 1. 平台名称大小写
- 平台名称**区分大小写**
- 必须使用上面列表中的确切名称
- 例如：`huawei_vrp` 而不是 `Huawei_VRP`

### 2. 功能支持差异
- 不同平台的功能支持程度不同
- 有些平台可能只支持基本命令执行
- 建议先在测试环境验证功能

### 3. 版本兼容性
- 确保使用最新版本的 scrapli-community
- 新平台支持会不断添加
- 查看官方文档获取最新信息

### 4. 驱动选择
- 系统会根据平台名称自动选择正确的驱动
- 无需手动导入驱动模块
- Nornir 会处理驱动加载

### 5. 连接参数
- 不同平台的默认连接参数可能不同
- 可以在设备的 `connection_options` 中覆盖默认值
- 参考特定平台的最佳实践配置

---

## 🔍 验证平台支持

运行以下命令验证特定平台的支持：

```bash
# 检查所有平台
python scripts/list_all_platforms.py

# 验证特定平台连接
curl -X POST "http://localhost:8000/api/v1/devices/connectivity-test" \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["your-device-name"]}'
```

---

## 📚 参考资源

- [Scrapli Community 官方文档](https://scrapli.github.io/scrapli_community/)
- [Scrapli Community GitHub](https://github.com/scrapli/scrapli_community)
- [平台支持状态](https://github.com/scrapli/scrapli_community#platforms)