# 华为和 H3C 设备支持指南

## 🌏 支持的设备平台

### 华为设备

| 平台名称 | 设备类型 | 适用型号 | 说明 |
|---------|---------|---------|------|
| `huawei_vrp` | 交换机/路由器 | S系列、NE系列、AR系列 | VRP 平台设备 |
| `huawei_usg` | 防火墙 | USG6300/USG6500/USG6600系列 | 防火墙设备 |

### H3C 设备

| 平台名称 | 设备类型 | 适用型号 | 说明 |
|---------|---------|---------|------|
| `h3c_comware` | 交换机/路由器 | S5xxx、S6xxx、MSR系列 | Comware 平台设备 |
| `h3c_firesc` | 防火墙 | F1000、F5000系列 | 防火墙设备 |

## 🔧 配置特点

### 华为设备配置

#### 1. 连接参数
```yaml
huawei_vrp:
  port: 22
  timeout: 45
  connection_options:
    scrapli:
      auth_strict_key: false
      timeout_socket: 10      # TCP连接超时 (较长)
      timeout_transport: 15   # SSH会话建立超时
      timeout_ops: 60         # 命令执行超时 (较长)
```

#### 2. SSH 配置要求
```bash
# 华为设备 SSH 配置示例
[Huawei] ssh server enable
[Huawei] ssh user admin authentication-type password
[Huawei] ssh user admin service-type stelnet
[Huawei] local-user admin
[Huawei-localuser-admin] password cipher YourPassword
[Huawei-localuser-admin] service-type ssh
[Huawei-localuser-admin] level 3
```

#### 3. 常用命令
```bash
# 查看版本
display version

# 查看配置
display current-configuration

# 查看接口
display interface brief

# 保存配置
save
```

### H3C 设备配置

#### 1. 连接参数
```yaml
h3c_comware:
  port: 22
  timeout: 45
  connection_options:
    scrapli:
      auth_strict_key: false
      timeout_socket: 10
      timeout_transport: 15
      timeout_ops: 60
```

#### 2. SSH 配置要求
```bash
# H3C 设备 SSH 配置示例
[H3C] ssh server enable
[H3C] local-user admin
[H3C-luser-admin] password cipher YourPassword
[H3C-luser-admin] service-type ssh
[H3C-luser-admin] authorization-attribute level 3
[H3C] line vty 0 63
[H3C-line-vty0-63] authentication-mode scheme
[H3C-line-vty0-63] protocol inbound ssh
```

#### 3. 常用命令
```bash
# 查看版本
display version

# 查看配置
display current-configuration

# 查看接口
display interface brief

# 保存配置
save force
```

## 📊 库存数据示例

### 华为交换机

```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'huawei-sw-01',
    '192.168.2.10',
    'huawei_vrp',
    22,
    'admin',
    'Admin@123',
    'huawei_switches',
    'Huawei',
    'S5735S-L24P4S-A',
    '华为接入交换机',
    '{
        "site": "main",
        "floor": "3",
        "role": "access",
        "stack_id": "1",
        "management_vlan": "100"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 10,
            "timeout_transport": 15,
            "timeout_ops": 60
        }
    }',
    true
);
```

### 华为防火墙

```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'huawei-fw-01',
    '192.168.2.254',
    'huawei_usg',
    22,
    'admin',
    'Admin@123',
    'huawei_firewalls',
    'Huawei',
    'USG6310S',
    '华为下一代防火墙',
    '{
        "site": "main",
        "role": "edge",
        "vsys": "root",
        "ha_mode": "active-passive"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 15,
            "timeout_transport": 20,
            "timeout_ops": 90
        }
    }',
    true
);
```

### H3C 交换机

```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'h3c-sw-01',
    '192.168.3.10',
    'h3c_comware',
    22,
    'admin',
    'Admin@123',
    'h3c_switches',
    'H3C',
    'S5130S-28P-EI',
    'H3C接入交换机',
    '{
        "site": "branch",
        "floor": "1",
        "role": "access",
        "irf_port": "1"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 10,
            "timeout_transport": 15,
            "timeout_ops": 60
        }
    }',
    true
);
```

### H3C 防火墙

```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'h3c-fw-01',
    '192.168.3.254',
    'h3c_firesc',
    22,
    'admin',
    'Admin@123',
    'h3c_firewalls',
    'H3C',
    'F1000-E-SI',
    'H3C下一代防火墙',
    '{
        "site": "branch",
        "role": "edge",
        "vsys": "root",
        "license_status": "valid"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 15,
            "timeout_transport": 20,
            "timeout_ops": 90
        }
    }',
    true
);
```

## 🛠️ API 使用示例

### 1. 获取华为设备信息

```bash
# 获取华为交换机版本信息
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["huawei-sw-01"],
    "command": "display version",
    "enable": true
  }'
```

**响应示例**:
```json
{
  "huawei-sw-01": {
    "status": "success",
    "result": "Huawei Versatile Routing Platform Software\nVRP (R) software, Version 8.180 (S5735S-L24P4S-A)\n...",
    "failed": false
  }
}
```

### 2. 配置华为设备

```bash
# 配置华为交换机接口
curl -X POST "http://localhost:8000/api/v1/devices/config" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["huawei-sw-01"],
    "commands": [
      "interface GigabitEthernet0/0/1",
      "description Uplink to Core",
      "port link-type trunk",
      "port trunk allow-pass vlan 10 20 30"
    ],
    "dry_run": false
  }'
```

### 3. H3C 设备操作

```bash
# 获取 H3C 防火墙状态
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["h3c-fw-01"],
    "command": "display cpu-usage",
    "enable": true
  }'
```

### 4. 批量操作华为和 H3C 设备

```bash
# 对所有国产设备执行健康检查
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["huawei-sw-01", "huawei-fw-01", "h3c-sw-01", "h3c-fw-01"],
    "command": "display device",
    "enable": true
  }'
```

## 🔍 特殊注意事项

### 1. 命令语法差异

| 功能 | Cisco | 华为 | H3C |
|------|-------|------|------|
| 查看版本 | `show version` | `display version` | `display version` |
| 查看配置 | `show running-config` | `display current-configuration` | `display current-configuration` |
| 查看接口 | `show ip interface brief` | `display interface brief` | `display interface brief` |
| 保存配置 | `write memory` | `save` | `save force` |
| 进入配置模式 | `configure terminal` | `system-view` | `system-view` |

### 2. 权限管理

#### 华为设备权限级别
```bash
# 0级：参观级
# 1级：监控级
# 2级：配置级
# 3级：管理级
local-user admin level 3  # 给予管理权限
```

#### H3C 设备权限级别
```bash
# 0级：参观级
# 1级：监控级
# 2级：系统级
# 3级：管理级
local-user admin authorization-attribute level 3
```

### 3. 超时设置建议

| 设备类型 | 推荐超时设置 | 原因 |
|---------|-------------|------|
| 华为交换机 | timeout_ops: 60s | 命令响应相对较慢 |
| 华为防火墙 | timeout_ops: 90s | 安全策略检查耗时 |
| H3C 交换机 | timeout_ops: 60s | 与华为类似 |
| H3C 防火墙 | timeout_ops: 90s | 安全检查耗时 |

### 4. 常见问题解决

#### 华为设备连接问题
```bash
# 问题：SSH 连接被拒绝
# 解决：检查 SSH 配置
display ssh server status

# 问题：权限不足
# 解决：检查用户权限
display local-user username admin
```

#### H3C 设备连接问题
```bash
# 问题：认证失败
# 解决：检查 AAA 配置
display aaa

# 问题：VTY 线路问题
# 解决：检查 VTY 配置
display line vty
```

## 📈 性能优化建议

### 1. 连接池配置

```yaml
# 针对华为/H3C设备的优化配置
huawei_vrp:
  connection_options:
    scrapli:
      socket_timeout: 10
      transport_timeout: 15
      operation_timeout: 60
      # 华为设备建议使用更大的缓冲区
      buffer_size: 16384
```

### 2. 并发控制

```yaml
# 华为/H3C设备建议降低并发数
runner:
  plugin: threaded
  options:
    num_workers: 20  # 对于国产设备，建议降低并发数
```

### 3. 重试策略

```python
# 在代码中实现重试逻辑
async def execute_with_retry(device_name, command, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = await nornir_manager.send_command([device_name], command)
            if not result[device_name]["failed"]:
                return result
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            await asyncio.sleep(2 ** attempt)  # 指数退避
```

## 🔒 安全配置

### 1. SSH 加密配置

```bash
# 华为设备 SSH 安全配置
[Huawei] ssh server secure-algorithms cipher aes256_ctr aes256_gcm
[Huawei] ssh server secure-algorithms hmac sha2_256 sha2_512
[Huawei] ssh server key-exchange dh_group14_sha256

# H3C 设备 SSH 安全配置
[H3C] ssh server secure-algorithms cipher aes256_ctr aes256_gcm
[H3C] ssh server secure-algorithms hmac sha2_256 sha2_512
[H3C] ssh server key-exchange dh_group14_sha256
```

### 2. 访问控制

```bash
# 华为设备 ACL 限制 SSH 访问
[Huawei] acl 2000
[Huawei-acl-basic-2000] rule permit source 192.168.1.0 0.0.0.255
[Huawei-acl-basic-2000] quit
[Huawei] user-interface vty 0 4
[Huawei-ui-vty0-4] acl 2000 inbound
```

通过以上配置和说明，您的系统现在完全支持华为和 H3C 的交换机和防火墙设备了！