# 快速开始指南

## 🚀 5 分钟快速部署

### 前置要求

- Python 3.14.2+
- PostgreSQL 12+
- uv 包管理器
- Git

### 1. 克隆和安装

```bash
# 克隆项目
git clone <repository-url>
cd network

# 使用 Make 快速设置
make dev
```

### 2. 配置数据库

```bash
# 编辑环境变量
vim .env

# 设置数据库连接
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/nornir_db

# 初始化数据库
make init-db
```

### 3. 启动服务

```bash
make start
```

### 4. 验证部署

```bash
# 健康检查
curl http://localhost:8000/health

# 获取设备列表
curl http://localhost:8000/api/v1/devices

# 查看 API 文档
# 浏览器访问: http://localhost:8000/docs
```

## 📚 核心概念

### 设备 (Device)

网络中的物理或虚拟设备，包括交换机、路由器、防火墙等。

```json
{
  "name": "switch-01",
  "hostname": "192.168.1.10",
  "platform": "cisco_ios",
  "port": 22,
  "username": "admin"
}
```

### 组 (Group)

设备的逻辑分组，可以继承配置参数。

```json
{
  "name": "switches",
  "description": "网络交换机组",
  "platform": "cisco_ios",
  "port": 22
}
```

### 任务 (Task)

针对一个或多个设备的操作任务。

```json
{
  "name": "备份配置",
  "task_type": "command",
  "targets": ["switch-01", "switch-02"],
  "command": "show running-config"
}
```

## 🎯 常见操作

### 1. 添加设备

```bash
curl -X POST "http://localhost:8000/api/v1/inventory/devices" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-switch",
    "hostname": "192.168.1.100",
    "platform": "cisco_ios",
    "username": "admin",
    "password": "password"
  }'
```

### 2. 执行命令

```bash
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["my-switch"],
    "command": "show version"
  }'
```

### 3. 配置接口

```bash
curl -X POST "http://localhost:8000/api/v1/devices/config" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["my-switch"],
    "commands": [
      "interface GigabitEthernet0/1",
      "description Uplink",
      "no shutdown"
    ]
  }'
```

### 4. 批量操作

```bash
# 对所有交换机执行命令
curl -X GET "http://localhost:8000/api/v1/devices?group=switches"

# 批量重启设备
curl -X POST "http://localhost:8000/api/v1/devices/command" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["switch-01", "switch-02", "switch-03"],
    "command": "reload",
    "enable": true
  }'
```

## 🔧 开发环境

### 1. 本地开发设置

```bash
# 安装开发依赖
make install

# 启动开发服务器 (热重载)
make dev-server

# 运行测试
make test

# 代码检查
make lint

# 代码格式化
make format
```

### 2. 数据库迁移

```bash
# 创建迁移
make migration MSG="添加新字段"

# 应用迁移
make migrate
```

### 3. 项目结构

```
network/
├── backend/                 # 后端代码
│   ├── app/                # 应用核心
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心模块
│   │   ├── models/        # 数据模型
│   │   └── services/      # 业务逻辑
│   ├── inventory_plugin/  # 库存插件
│   └── main.py           # 应用入口
├── config/                # 配置文件
├── scripts/              # 脚本工具
├── docs/                 # 文档
└── tests/                # 测试代码
```

## 📊 监控和调试

### 1. 日志查看

```bash
# 应用日志
tail -f logs/app.log

# 错误日志
tail -f logs/error.log

# Nornir 日志
tail -f logs/nornir.log
```

### 2. 性能监控

```bash
# 获取系统状态
curl http://localhost:8000/health

# 获取任务统计
curl http://localhost:8000/api/v1/tasks/stats/summary

# 获取库存统计
curl http://localhost:8000/api/v1/inventory/stats
```

### 3. 调试模式

```bash
# 启用调试模式
export DEBUG=true
make start

# 使用详细日志
export LOG_LEVEL=DEBUG
make start
```

## 🛠️ 故障排除

### 1. 常见问题

#### 数据库连接失败

```bash
# 检查数据库状态
pg_isready -h localhost -p 5432

# 检查连接字符串
python3 -c "
from app.core.config import settings
print('Database URL:', settings.database_url_async)
"
```

#### 设备连接失败

```bash
# 测试网络连接
ping 192.168.1.10

# 测试 SSH 连接
ssh admin@192.168.1.10

# 检查设备连通性
curl -X POST "http://localhost:8000/api/v1/devices/connectivity-test" \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["switch-01"]}'
```

#### 服务启动失败

```bash
# 检查端口占用
netstat -tulpn | grep 8000

# 停止现有服务
make stop

# 检查配置
python3 -c "from backend.main import app; print('配置正常')"
```

### 2. 日志分析

```bash
# 查看最近的错误
grep -i error logs/app.log | tail -10

# 查看特定设备的日志
grep "switch-01" logs/app.log

# 分析任务执行时间
grep "任务.*完成" logs/app.log
```

### 3. 性能优化

```bash
# 调整并发数
# 编辑 config/nornir_config.yml
runner:
  plugin: threaded
  options:
    num_workers: 50  # 根据系统性能调整

# 数据库连接池
# 编辑 .env
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30
```

## 🔐 安全配置

### 1. 基础安全

```bash
# 设置强密码
export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# 配置防火墙
ufw allow 8000/tcp
ufw enable
```

### 2. SSL/TLS 配置

```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# 启用 HTTPS
uvicorn backend.main:app --ssl-keyfile key.pem --ssl-certfile cert.pem
```

### 3. 访问控制

```bash
# 配置允许的主机
export ALLOWED_HOSTS='["https://your-domain.com"]'

# 启用认证 (未来功能)
# export ENABLE_AUTH=true
# export JWT_SECRET_KEY=your-jwt-secret
```

## 📈 扩展和定制

### 1. 添加新设备平台

```python
# 在 inventory_plugin/postgres_inventory.py 中添加
PLATFORM_DEFAULTS = {
    "cisco_ios": {"port": 22, "username": "admin"},
    "cisco_nxos": {"port": 22, "username": "admin"},
    "fortinet": {"port": 443, "username": "admin"},
    "your_platform": {"port": 1234, "username": "custom"}
}
```

### 2. 自定义任务类型

```python
# 在 app/services/nornir_manager.py 中添加
async def custom_task(self, hosts: List[str], params: Dict[str, Any]):
    # 自定义任务逻辑
    pass
```

### 3. 集成外部系统

```python
# 添加通知插件
async def send_notification(message: str):
    # 发送到 Slack、Teams、邮件等
    pass
```

## 🎓 下一步

1. 阅读 [架构文档](ARCHITECTURE.md) 了解系统设计
2. 查看 [API 示例](API_EXAMPLES.md) 学习高级用法
3. 参与 [贡献指南](../README.md#贡献) 为项目做贡献
4. 加入社区讨论和分享经验

## 📞 获取帮助

- 📖 查看 [完整文档](../README.md)
- 🐛 报告 [问题](https://github.com/your-repo/issues)
- 💬 参与 [讨论](https://github.com/your-repo/discussions)
- 📧 联系维护者