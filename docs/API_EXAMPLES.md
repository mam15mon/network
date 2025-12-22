# API 使用示例

## 概述

本文档提供了 Nornir Network Management System API 的详细使用示例，包括各种常见场景的请求和响应。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API 版本**: `v1`
- **认证方式**: Bearer Token (未来实现)
- **内容类型**: `application/json`

## 设备管理 API

### 1. 获取设备列表

```bash
curl -X GET "http://localhost:8000/api/v1/devices" \
  -H "accept: application/json"
```

**响应示例**:
```json
[
  "switch-01",
  "switch-02",
  "router-01"
]
```

### 2. 按条件过滤设备

```bash
# 按组过滤
curl -X GET "http://localhost:8000/api/v1/devices?group=switches" \
  -H "accept: application/json"

# 按平台过滤
curl -X GET "http://localhost:8000/api/v1/devices?platform=cisco_ios" \
  -H "accept: application/json"

# 按站点过滤
curl -X GET "http://localhost:8000/api/v1/devices?site=main" \
  -H "accept: application/json"
```

### 3. 获取设备详情

```bash
curl -X GET "http://localhost:8000/api/v1/devices/switch-01" \
  -H "accept: application/json"
```

**响应示例**:
```json
{
  "name": "switch-01",
  "hostname": "192.168.1.10",
  "platform": "cisco_ios",
  "port": 22,
  "username": "admin",
  "group": "switches",
  "data": {
    "site": "main",
    "floor": "1"
  }
}
```

### 4. 执行命令

```bash
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["switch-01", "switch-02"],
    "command": "show version",
    "enable": true,
    "timeout": 30
  }'
```

**响应示例**:
```json
{
  "switch-01": {
    "status": "success",
    "result": "Cisco IOS Software, C2960 Software...\nModel number                 : WS-C2960-24TT-L\n...",
    "failed": false,
    "exception": null,
    "diff": null,
    "changed": false
  },
  "switch-02": {
    "status": "success",
    "result": "Cisco IOS Software, C2960 Software...\nModel number                 : WS-C2960-24TT-L\n...",
    "failed": false,
    "exception": null,
    "diff": null,
    "changed": false
  }
}
```

### 5. 配置设备

```bash
curl -X POST "http://localhost:8000/api/v1/devices/config" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["switch-01"],
    "commands": [
      "interface GigabitEthernet0/1",
      "description Uplink to Core Switch",
      "switchport mode trunk",
      "switchport trunk allowed vlan 10,20,30"
    ],
    "dry_run": false,
    "timeout": 60
  }'
```

**响应示例**:
```json
{
  "switch-01": {
    "status": "success",
    "result": "Configuration applied successfully",
    "failed": false,
    "exception": null,
    "diff": "+ interface GigabitEthernet0/1\n+ description Uplink to Core Switch\n+ switchport mode trunk\n+ switchport trunk allowed vlan 10,20,30",
    "changed": true
  }
}
```

### 6. 连接测试

```bash
curl -X POST "http://localhost:8000/api/v1/devices/connectivity-test" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["switch-01", "switch-02", "router-01"]
  }'
```

### 7. 获取设备事实信息

```bash
curl -X GET "http://localhost:8000/api/v1/devices/switch-01/facts" \
  -H "accept: application/json"
```

**响应示例**:
```json
{
  "basic": {
    "hostname": "switch-01",
    "vendor": "Cisco",
    "model": "Catalyst 2960",
    "os_version": "15.2(2)E7",
    "serial_number": "FCW1932D0LB",
    "uptime": "2 weeks, 3 days, 4 hours"
  },
  "detailed": {
    "version_output": "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.2(2)E7, RELEASE SOFTWARE (fc1)..."
  }
}
```

## 任务管理 API

### 1. 获取任务列表

```bash
curl -X GET "http://localhost:8000/api/v1/tasks" \
  -H "accept: application/json"
```

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "Show Version Check",
    "task_type": "command",
    "status": "completed",
    "targets_count": 3,
    "created_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:32:15Z"
  },
  {
    "id": 2,
    "name": "Interface Configuration",
    "task_type": "config",
    "status": "running",
    "targets_count": 2,
    "created_at": "2024-01-15T11:00:00Z",
    "completed_at": null
  }
]
```

### 2. 创建任务

```bash
curl -X POST "http://localhost:8000/api/v1/tasks" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backup Configuration",
    "description": "Backup running configuration for all switches",
    "task_type": "command",
    "targets": ["switch-01", "switch-02"],
    "command": "show running-config",
    "parameters": {
      "save_to_file": true,
      "backup_path": "/backups/configs/"
    }
  }'
```

### 3. 获取任务详情

```bash
curl -X GET "http://localhost:8000/api/v1/tasks/1" \
  -H "accept: application/json"
```

**响应示例**:
```json
{
  "id": 1,
  "name": "Show Version Check",
  "description": "Check device versions",
  "task_type": "command",
  "status": "completed",
  "targets": ["switch-01", "switch-02", "router-01"],
  "command": "show version",
  "results": {
    "switch-01": {
      "status": "success",
      "result": "Cisco IOS Software, C2960 Software...",
      "failed": false
    },
    "switch-02": {
      "status": "success",
      "result": "Cisco IOS Software, C2960 Software...",
      "failed": false
    },
    "router-01": {
      "status": "success",
      "result": "Cisco IOS Software, ISR Software...",
      "failed": false
    }
  },
  "created_at": "2024-01-15T10:30:00Z",
  "started_at": "2024-01-15T10:30:05Z",
  "completed_at": "2024-01-15T10:32:15Z",
  "created_by": "admin"
}
```

### 4. 取消任务

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/2/cancel" \
  -H "accept: application/json"
```

### 5. 获取任务日志

```bash
curl -X GET "http://localhost:8000/api/v1/tasks/1/logs" \
  -H "accept: application/json"
```

## 库存管理 API

### 1. 获取库存设备列表

```bash
curl -X GET "http://localhost:8000/api/v1/inventory/devices" \
  -H "accept: application/json"
```

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "switch-01",
    "hostname": "192.168.1.10",
    "platform": "cisco_ios",
    "port": 22,
    "username": "admin",
    "group_name": "switches",
    "vendor": "Cisco",
    "model": "Catalyst 2960",
    "os_version": "15.2(2)E7",
    "description": "Main Floor 1 Switch",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "last_connected": "2024-01-15T10:30:00Z"
  }
]
```

### 2. 添加新设备

```bash
curl -X POST "http://localhost:8000/api/v1/inventory/devices" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "switch-03",
    "hostname": "192.168.1.12",
    "platform": "cisco_ios",
    "port": 22,
    "username": "admin",
    "password": "password",
    "group_name": "switches",
    "data": {
      "site": "main",
      "floor": "3"
    },
    "vendor": "Cisco",
    "model": "Catalyst 2960",
    "description": "Main Floor 3 Switch"
  }'
```

### 3. 更新设备信息

```bash
curl -X PUT "http://localhost:8000/api/v1/inventory/devices/switch-01" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description for switch-01",
    "data": {
      "site": "main",
      "floor": "1",
      "role": "access"
    }
  }'
```

### 4. 删除设备

```bash
curl -X DELETE "http://localhost:8000/api/v1/inventory/devices/switch-03" \
  -H "accept: application/json"
```

### 5. 获取设备组列表

```bash
curl -X GET "http://localhost:8000/api/v1/inventory/groups" \
  -H "accept: application/json"
```

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "switches",
    "description": "网络交换机组",
    "platform": "cisco_ios",
    "port": 22,
    "devices_count": 2,
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "name": "routers",
    "description": "路由器组",
    "platform": "cisco_ios",
    "port": 22,
    "devices_count": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### 6. 创建设备组

```bash
curl -X POST "http://localhost:8000/api/v1/inventory/groups" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "firewalls",
    "description": "防火墙组",
    "platform": "fortinet",
    "port": 443,
    "data": {
      "role": "security"
    }
  }'
```

### 7. 获取库存统计

```bash
curl -X GET "http://localhost:8000/api/v1/inventory/stats" \
  -H "accept: application/json"
```

**响应示例**:
```json
{
  "total_devices": 25,
  "active_devices": 23,
  "inactive_devices": 2,
  "groups_count": 5,
  "devices_by_platform": {
    "cisco_ios": 15,
    "cisco_nxos": 5,
    "fortinet": 3,
    "juniper": 2
  },
  "devices_by_group": {
    "switches": 15,
    "routers": 6,
    "firewalls": 3,
    "wireless": 1
  },
  "devices_by_vendor": {
    "Cisco": 20,
    "Fortinet": 3,
    "Juniper": 2
  },
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## 错误处理

### 错误响应格式

```json
{
  "detail": "设备 switch-01 不存在"
}
```

### 常见错误码

- `400`: 请求参数错误
- `404`: 资源不存在
- `422`: 数据验证失败
- `500`: 服务器内部错误

## Python 客户端示例

### 使用 requests 库

```python
import requests
import json

# 配置
BASE_URL = "http://localhost:8000"
HEADERS = {
    "accept": "application/json",
    "Content-Type": "application/json"
}

# 获取设备列表
def get_devices():
    response = requests.get(f"{BASE_URL}/api/v1/devices", headers=HEADERS)
    return response.json()

# 执行命令
def execute_command(hosts, command, enable=False):
    payload = {
        "hosts": hosts,
        "command": command,
        "enable": enable
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/devices/command",
        headers=HEADERS,
        json=payload
    )
    return response.json()

# 创建任务
def create_task(name, task_type, targets, command=None):
    payload = {
        "name": name,
        "task_type": task_type,
        "targets": targets
    }
    if command:
        payload["command"] = command

    response = requests.post(
        f"{BASE_URL}/api/v1/tasks",
        headers=HEADERS,
        json=payload
    )
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 获取设备
    devices = get_devices()
    print(f"设备列表: {devices}")

    # 执行命令
    results = execute_command(["switch-01"], "show version")
    print(f"命令执行结果: {json.dumps(results, indent=2, ensure_ascii=False)}")

    # 创建任务
    task = create_task(
        name="检查接口状态",
        task_type="command",
        targets=["switch-01", "switch-02"],
        command="show ip interface brief"
    )
    print(f"创建任务: {task}")
```

### 使用异步客户端 (aiohttp)

```python
import aiohttp
import asyncio
import json

async def async_execute_command(hosts, command):
    async with aiohttp.ClientSession() as session:
        payload = {
            "hosts": hosts,
            "command": command
        }
        async with session.post(
            f"{BASE_URL}/api/v1/devices/command",
            json=payload
        ) as response:
            return await response.json()

# 使用示例
async def main():
    results = await async_execute_command(["switch-01"], "show version")
    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
```

## 最佳实践

### 1. 错误处理

```python
try:
    response = requests.post(url, json=payload)
    response.raise_for_status()
    result = response.json()
except requests.exceptions.HTTPError as e:
    print(f"HTTP 错误: {e}")
    print(f"响应内容: {response.text}")
except requests.exceptions.RequestException as e:
    print(f"请求异常: {e}")
```

### 2. 超时设置

```python
response = requests.post(
    url,
    json=payload,
    timeout=(10, 30)  # 连接超时 10s，读取超时 30s
)
```

### 3. 批量操作

```python
# 分批处理大量设备
devices = get_devices()
batch_size = 10
batches = [devices[i:i + batch_size] for i in range(0, len(devices), batch_size)]

for batch in batches:
    results = execute_command(batch, "show version")
    # 处理结果
```

### 4. 结果验证

```python
def validate_results(results):
    failed_hosts = []
    for host, result in results.items():
        if result.get("failed", False):
            failed_hosts.append(host)

    if failed_hosts:
        print(f"以下设备执行失败: {failed_hosts}")

    return len(failed_hosts) == 0
```