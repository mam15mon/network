# 设备平台支持指南

## ✅ 正确的配置方式

感谢您的提醒！Scrapli 确实需要社区插件来支持不同的设备平台。以下是正确的配置方法：

## 📦 必要的依赖

### 1. 基础包
```bash
# Scrapli 核心包
scrapli>=2023.7.30

# Nornir Scrapli 集成
nornir-scrapli>=3.0.0
```

### 2. 社区插件包 ⭐
```bash
# 关键！这个包提供了华为、H3C 等厂商的支持
scrapli-community>=2025.1.30
```

## 🌏 支持的平台

### 华为设备
| 平台名称 | scrapli-community 驱动 | 适用设备 |
|---------|----------------------|---------|
| `huawei` | HuaweiVRPDriver | 华为交换机、路由器 |
| `huawei_vrp` | HuaweiVRPDriver | 华为 VRP 平台设备 |

### H3C 设备
| 平台名称 | scrapli-community 驱动 | 适用设备 |
|---------|----------------------|---------|
| `h3c_comware` | H3CComwareDriver | H3C Comware 平台 |
| `hp_comware` | H3CComwareDriver | HP Comware 平台 |

### 其他厂商
| 平台名称 | scrapli-community 驱动 | 适用设备 |
|---------|----------------------|---------|
| `aruba_os` | ArubaOSCXDriver | Aruba 交换机 |
| `mikrotik_routeros` | MikrotikRouterOsDriver | Mikrotik 路由器 |
| `paloalto_panos` | PaloAltoPanosDriver | Palo Alto 防火墙 |
| `ubiquiti_edgeos` | UbiquitiEdgeOSDriver | Ubiquiti EdgeRouter |

## 🔧 配置步骤

### 1. 安装依赖
```bash
# 使用 uv 安装
uv pip install scrapli-community>=2025.1.30

# 或者安装所有依赖
uv pip install -e .
```

### 2. 验证安装
```bash
# 运行检查脚本
python scripts/check_platforms.py
```

### 3. 数据库配置

在 `devices` 表中使用正确的平台名称：

```sql
-- 华为交换机
INSERT INTO devices (
    name, hostname, platform, username, password, vendor, model
) VALUES (
    'huawei-sw-01',
    '192.168.1.10',
    'huawei_vrp',           -- ← 正确的平台名称
    'admin',
    'Admin@123',
    'Huawei',
    'S5735S-L24P4S-A'
);

-- H3C 交换机
INSERT INTO devices (
    name, hostname, platform, username, password, vendor, model
) VALUES (
    'h3c-sw-01',
    '192.168.1.20',
    'h3c_comware',          -- ← 正确的平台名称
    'admin',
    'Admin@123',
    'H3C',
    'S5130S-28P-EI'
);
```

## 📝 使用示例

### 1. API 调用
```bash
# 华为设备执行命令
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["huawei-sw-01"],
    "command": "display version"
  }'

# H3C 设备执行命令
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["h3c-sw-01"],
    "command": "display version"
  }'
```

### 2. Python 代码
```python
from scrapli_community.driver import HuaweiVRPDriver
from scrapli_community.driver import H3CComwareDriver

# 华为设备连接
huawei_device = {
    "host": "192.168.1.10",
    "platform": "huawei_vrp",  # 关键：使用正确的平台名称
    "username": "admin",
    "password": "Admin@123"
}

# H3C 设备连接
h3c_device = {
    "host": "192.168.1.20",
    "platform": "h3c_comware",  # 关键：使用正确的平台名称
    "username": "admin",
    "password": "Admin@123"
}
```

## ⚠️ 常见错误

### 1. 错误的平台名称
```python
# ❌ 错误 - 这些平台名称不存在
platform = "huawei_switch"
platform = "h3c_firewall"

# ✅ 正确 - 使用 scrapli-community 支持的名称
platform = "huawei_vrp"
platform = "h3c_comware"
```

### 2. 缺少社区插件
```
错误信息：ValueError: Platform "huawei_vrp" is not a valid scrapli platform

解决方法：安装 scrapli-community
uv pip install scrapli-community>=2025.1.30
```

### 3. 版本不兼容
```bash
# ❌ 错误 - 版本太旧
pip install scrapli-community==2022.1.1

# ✅ 正确 - 使用最新版本
uv pip install scrapli-community>=2025.1.30
```

## 🧪 测试连接

### 1. 测试脚本
```python
#!/usr/bin/env python3
import asyncio
from scrapli_community.driver import HuaweiVRPDriver, H3CComwareDriver

async def test_huawei():
    device = HuaweiVRPDriver(
        host="192.168.1.10",
        username="admin",
        password="Admin@123"
    )

    try:
        await device.open()
        response = await device.send_command("display version")
        print(f"Huawei 设备响应: {response.result}")
        await device.close()
    except Exception as e:
        print(f"华为设备连接失败: {e}")

async def test_h3c():
    device = H3CComwareDriver(
        host="192.168.1.20",
        username="admin",
        password="Admin@123"
    )

    try:
        await device.open()
        response = await device.send_command("display version")
        print(f"H3C 设备响应: {response.result}")
        await device.close()
    except Exception as e:
        print(f"H3C 设备连接失败: {e}")

if __name__ == "__main__":
    asyncio.run(test_huawei())
    asyncio.run(test_h3c())
```

## 📋 完整平台列表

运行以下代码获取所有支持的平台：

```python
from scrapli import Scrapli
from scrapli.helper import ScrapliHelper

# 获取所有内置平台
builtin_platforms = ScrapliHelper().get_platforms()
print("Scrapli 内置平台:", builtin_platforms)

# 社区平台需要手动导入检查
from scrapli_community.driver import (
    HuaweiVRPDriver,
    H3CComwareDriver,
    ArubaOSCXDriver,
    MikrotikRouterOsDriver
)

print("Scrapli Community 支持的主要平台:")
print("- huawei / huawei_vrp")
print("- h3c_comware / hp_comware")
print("- aruba_os")
print("- mikrotik_routeros")
```

## 🎯 总结

1. **必须安装** `scrapli-community>=2025.1.30`
2. **使用正确的平台名称**：`huawei_vrp`、`h3c_comware`
3. **在数据库的 platform 字段中使用这些名称**
4. **scrapli 会自动根据平台名称选择正确的驱动**

谢谢您的提醒！这样配置就能正确支持华为和 H3C 设备了。