# 库存管理指南

## 数据库表结构

### 1. devices 表 (设备主表)

```sql
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,           -- 设备名称 (Nornir 主机名)
    hostname VARCHAR(255) NOT NULL,              -- IP 地址或域名
    platform VARCHAR(50) DEFAULT 'cisco_ios',    -- 设备平台
    port INTEGER DEFAULT 22,                     -- 连接端口
    username VARCHAR(100),                       -- 用户名
    password VARCHAR(255),                       -- 密码
    timeout INTEGER DEFAULT 30,                  -- 超时时间
    group_name VARCHAR(100),                     -- 所属组
    data JSONB DEFAULT '{}',                     -- 扩展数据
    connection_options JSONB DEFAULT '{}',       -- 连接选项
    is_active BOOLEAN DEFAULT TRUE,              -- 是否启用
    description TEXT,                            -- 描述
    vendor VARCHAR(100),                         -- 厂商
    model VARCHAR(100),                          -- 型号
    os_version VARCHAR(100),                     -- 操作系统版本
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_connected TIMESTAMP WITH TIME ZONE
);
```

### 2. device_groups 表 (设备组)

```sql
CREATE TABLE device_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,           -- 组名
    description TEXT,                            -- 组描述
    username VARCHAR(100),                       -- 组默认用户名
    password VARCHAR(255),                       -- 组默认密码
    platform VARCHAR(50),                        -- 组默认平台
    port INTEGER,                                -- 组默认端口
    timeout INTEGER,                             -- 组默认超时
    data JSONB DEFAULT '{}',                     -- 组扩展数据
    connection_options JSONB DEFAULT '{}',       -- 组连接选项
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. device_defaults 表 (默认配置)

```sql
CREATE TABLE device_defaults (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) DEFAULT 'default' UNIQUE, -- 配置名称
    username VARCHAR(100),                       -- 默认用户名
    password VARCHAR(255),                       -- 默认密码
    platform VARCHAR(50),                        -- 默认平台
    port INTEGER,                                -- 默认端口
    timeout INTEGER DEFAULT 30,                 -- 默认超时
    data JSONB DEFAULT '{}',                     -- 默认扩展数据
    connection_options JSONB DEFAULT '{}',       -- 默认连接选项
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📝 库存数据示例

### 1. 基础设备数据

```sql
-- 插入默认配置
INSERT INTO device_defaults (name, username, password, platform, port, timeout, connection_options) VALUES
('default', 'admin', 'password', 'cisco_ios', 22, 30, '{
    "scrapli": {
        "auth_strict_key": false,
        "timeout_socket": 5,
        "timeout_transport": 10,
        "timeout_ops": 30
    }
}');

说明：
- 本项目从 `device_defaults/device_groups/devices` 的 `connection_options.scrapli` 读取 Scrapli 参数，并作为 Scrapli 的 `extras` 传入。
- `connection_options` 会按层级合并：`defaults < group < device`（同名 key 后者覆盖前者），避免“只改一个参数导致其它默认超时丢失”。

-- 插入设备组
INSERT INTO device_groups (name, description, platform, port, data, connection_options) VALUES
('switches', '网络交换机组', 'cisco_ios', 22, '{"role": "switch", "site": "main"}', '{
    "scrapli": {
        "auth_strict_key": false,
        "timeout_socket": 5
    }
}'),
('routers', '路由器组', 'cisco_ios', 22, '{"role": "router", "site": "main"}', '{
    "scrapli": {
        "auth_strict_key": false,
        "timeout_socket": 5
    }
}'),
('firewalls', '防火墙组', 'fortinet', 443, '{"role": "firewall", "site": "main"}', '{
    "scrapli": {
        "auth_strict_key": false,
        "timeout_socket": 5
    }
}');
```

## 🕒 按命令设置超时（DB 驱动）

对于回显很慢的命令，可以在 DB 的 `data.command_timeouts` 里配置 `timeout_ops`（单位：秒）。

优先级：`devices.data` > `device_groups.data` > `device_defaults.data`。

支持两种匹配：
- 精确匹配：`"display version": 120`
- 前缀匹配（以 `*` 结尾）：`"show tech*": 300`

示例（设置默认兜底 + 覆盖某个组）：

```sql
-- 默认兜底：display version 慢，给 120s
UPDATE device_defaults
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{command_timeouts}',
  '{"display version": 120, "show tech*": 300}'::jsonb,
  true
)
WHERE name = 'default';

-- 华为组更慢：display version 给 180s
UPDATE device_groups
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{command_timeouts}',
  '{"display version": 180}'::jsonb,
  true
)
WHERE name = 'huawei_switches';
```

### 2. 具体设备示例

#### Cisco 交换机
```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, is_active
) VALUES
(
    'sw-core-01',                    -- 设备名称 (Nornir 主机名)
    '192.168.1.10',                  -- IP 地址
    'cisco_ios',                      -- 平台
    22,                              -- SSH 端口
    'admin',                         -- 用户名
    'cisco_password',                -- 密码
    'switches',                      -- 所属组
    'Cisco',                         -- 厂商
    'Catalyst 9300',                 -- 型号
    '核心交换机 - 机房A',             -- 描述
    '{                               -- 扩展数据 (JSON)
        "site": "datacenter-a",
        "floor": "3",
        "rack": "A01",
        "role": "core",
        "management_vlan": "100",
        "interfaces": {
            "GigabitEthernet1/0/1": "uplink-to-router",
            "GigabitEthernet1/0/24": "uplink-to-sw-02"
        }
    }',
    true                             -- 是否启用
);
```

#### Cisco 路由器
```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'router-edge-01',
    '192.168.1.1',
    'cisco_ios',
    22,
    'admin',
    'router_password',
    'routers',
    'Cisco',
    'ISR 4331',
    '边界路由器',
    '{
        "site": "datacenter-a",
        "role": "edge",
        "wan_circuit": "100Mbps",
        "isp": "ChinaTelecom"
    }',
    '{                                   -- 自定义连接选项
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 10,        -- 边界路由器可能响应慢
            "timeout_transport": 15,
            "timeout_ops": 60           -- 复杂命令需要更长时间
        }
    }',
    true
);
```

#### Fortinet 防火墙
```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, connection_options, is_active
) VALUES
(
    'fw-main-01',
    '192.168.1.254',
    'fortinet',
    443,                                 -- FortiGate 使用 HTTPS
    'admin',
    'fortinet_password',
    'firewalls',
    'Fortinet',
    'FortiGate 200E',
    '主防火墙',
    '{
        "site": "datacenter-a",
        "role": "main",
        "vdom": "root",
        "license_status": "valid"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 10,
            "timeout_transport": 15,
            "timeout_ops": 45
        }
    }',
    true
);
```

#### Juniper 交换机
```sql
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, vendor, model, description, data, is_active
) VALUES
(
    'sw-juniper-01',
    '192.168.2.10',
    'juniper_junos',
    22,
    'admin',
    'juniper_password',
    'switches',
    'Juniper',
    'EX4300',
    '接入交换机 - 办公区',
    '{
        "site": "office",
        "floor": "5",
        "role": "access"
    }',
    true
);
```

## 🔧 高级配置示例

### 1. 带特殊连接参数的设备

```sql
-- 通过跳板机连接的设备
INSERT INTO devices (
    name, hostname, platform, port, username, password,
    group_name, description, data, connection_options, is_active
) VALUES
(
    'sw-remote-01',
    '10.0.1.100',
    'cisco_ios',
    22,
    'admin',
    'password',
    'switches',
    '远程站点交换机',
    '{
        "site": "remote-site-1",
        "via_jump_host": "jump.company.com"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "timeout_socket": 15,        -- 远程连接延迟高
            "timeout_transport": 20,
            "timeout_ops": 60,
            "transport_options": {
                "jump_host": "jump.company.com",
                "jump_username": "jump_user"
            }
        }
    }',
    true
);
```

### 2. 使用 SSH 密钥认证的设备

```sql
INSERT INTO devices (
    name, hostname, platform, port, username,
    group_name, description, data, connection_options, is_active
) VALUES
(
    'sw-key-auth-01',
    '192.168.3.10',
    'cisco_ios',
    22,
    'network_admin',
    'switches',
    'SSH密钥认证交换机',
    '{
        "site": "datacenter-b",
        "auth_type": "ssh_key"
    }',
    '{
        "scrapli": {
            "auth_strict_key": false,
            "auth_private_key": "/home/user/.ssh/network_key",
            "auth_private_key_passphrase": "key_password"
        }
    }',
    true
);
```

## 📊 数据查询示例

### 1. 查询特定站点的设备

```sql
SELECT name, hostname, platform, vendor, model, data->>'site' as site
FROM devices
WHERE data->>'site' = 'datacenter-a' AND is_active = true;
```

### 2. 查询特定组的设备

```sql
SELECT d.name, d.hostname, d.platform, g.description as group_desc
FROM devices d
LEFT JOIN device_groups g ON d.group_name = g.name
WHERE d.group_name = 'switches' AND d.is_active = true;
```

### 3. 查询需要维护的设备

```sql
SELECT name, hostname, vendor, model, os_version, last_connected
FROM devices
WHERE is_active = true
AND (last_connected < NOW() - INTERVAL '7 days' OR last_connected IS NULL);
```

## 🔄 库存维护

### 1. 批量更新设备

```sql
-- 批量更新密码
UPDATE devices
SET password = 'new_secure_password', updated_at = NOW()
WHERE group_name = 'switches';

-- 批量更新连接参数
UPDATE devices
SET connection_options = jsonb_set(
    connection_options,
    '{scrapli,timeout_ops}',
    '45'::jsonb
)
WHERE platform = 'fortinet';
```

### 2. 设备分组管理

```sql
-- 创建新组
INSERT INTO device_groups (name, description, platform, data) VALUES
('wireless', '无线控制器组', 'cisco_wlc', '{"role": "wireless"}');

-- 移动设备到新组
UPDATE devices
SET group_name = 'wireless', updated_at = NOW()
WHERE name LIKE '%wlc%';
```

### 3. 清理不活跃设备

```sql
-- 软删除 (标记为不活跃)
UPDATE devices
SET is_active = false, updated_at = NOW()
WHERE last_connected < NOW() - INTERVAL '90 days';

-- 硬删除 (谨慎使用)
DELETE FROM devices
WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 year';
```

## 🛠️ 最佳实践

### 1. 命名规范

- **设备名称**: `功能类型-位置-编号` (如: `sw-core-01`, `router-edge-01`)
- **组名称**: 使用小写和连字符 (如: `core-switches`, `edge-routers`)
- **扩展数据**: 使用一致的键名 (如: `site`, `floor`, `rack`, `role`)

### 2. 安全考虑

```sql
-- 敏感信息加密存储
UPDATE devices
SET password = crypt('password', gen_salt('bf'))
WHERE password IS NOT NULL;

-- 使用视图限制敏感字段访问
CREATE VIEW devices_public AS
SELECT id, name, hostname, platform, vendor, model,
       description, data, is_active, created_at
FROM devices;
```

### 3. 性能优化

```sql
-- 创建索引
CREATE INDEX idx_devices_name ON devices(name);
CREATE INDEX idx_devices_hostname ON devices(hostname);
CREATE INDEX idx_devices_group ON devices(group_name);
CREATE INDEX idx_devices_active ON devices(is_active);
CREATE INDEX idx_devices_site ON devices USING GIN ((data->'site'));
```

### 4. 数据验证

```sql
-- 检查重复 IP
SELECT hostname, COUNT(*) as count
FROM devices
GROUP BY hostname
HAVING COUNT(*) > 1;

-- 检查孤立设备 (属于不存在的组)
SELECT d.name, d.group_name
FROM devices d
LEFT JOIN device_groups g ON d.group_name = g.name
WHERE d.group_name IS NOT NULL AND g.name IS NULL;
```

## 📱 通过 API 管理库存

### 1. 添加设备

```bash
curl -X POST "http://localhost:8000/api/v1/inventory/devices" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sw-new-01",
    "hostname": "192.168.1.50",
    "platform": "cisco_ios",
    "username": "admin",
    "password": "password",
    "group_name": "switches",
    "data": {
      "site": "datacenter-a",
      "floor": "2"
    },
    "vendor": "Cisco",
    "model": "Catalyst 2960"
  }'
```

### 2. 更新设备

```bash
curl -X PUT "http://localhost:8000/api/v1/inventory/devices/sw-new-01" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述",
    "data": {
      "site": "datacenter-a",
      "floor": "2",
      "role": "access"
    }
  }'
```

### 3. 获取库存统计

```bash
curl "http://localhost:8000/api/v1/inventory/stats"
```

这个库存系统提供了灵活的设备管理能力，支持各种网络设备和复杂网络拓扑的管理需求。
