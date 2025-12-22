# SNMP 监控模块使用说明

## 功能概述

SNMP 监控模块提供了完整的网络设备监控解决方案，支持：

- SNMP 指标配置与管理
- OID 测试与值解析
- 批量监控任务创建
- 自动化数据采集
- 实时监控仪表板
- 历史数据图表展示
- 告警配置（预留功能）

## 系统要求

### 后端依赖

```bash
# 安装 net-snmp 工具
# Ubuntu/Debian
sudo apt-get install snmp snmp-mibs-downloader

# CentOS/RHEL
sudo yum install net-snmp net-snmp-utils

# 验证安装
snmpwalk -v 2c -c public localhost
```

### Python 依赖

```bash
pip install apscheduler
```

## 数据库初始化

运行数据库迁移脚本来创建 SNMP 相关表和初始化内置指标：

```bash
cd /app/nornir-vsr/backend
python scripts/init_snmp.py
```

这将创建以下表：
- `snmp_metrics` - SNMP 监控指标配置
- `snmp_monitor_tasks` - 监控任务
- `snmp_data_points` - 采集的数据点
- `snmp_alerts` - 告警配置

并初始化内置指标：
- CPU使用率
- 内存使用率
- 设备运行时间
- 设备描述

## 使用流程

### 1. 配置主机 SNMP 信息

在主机管理页面，为每个需要监控的设备配置 SNMP 参数：

- **SNMP 版本**: v1, v2c, v3（目前主要支持 v1 和 v2c）
- **SNMP 团体字**: 通常为 `public` 或自定义团体字
- **SNMP 端口**: 默认 161

### 2. 配置监控指标

访问 **SNMP 配置页面**：

#### 使用内置指标
- 页面上方显示所有内置指标
- 点击任意内置指标芯片即可快速使用

#### 自定义指标
1. 点击 "添加指标" 按钮
2. 填写指标信息：
   - **指标名称**: 如 "CPU使用率"
   - **OID**: SNMP OID，如 `1.3.6.1.4.1.25506.2.6.1.1.1.1.6`
   - **描述**: 指标说明
   - **值类型**:
     - `gauge`: 瞬时值（如 CPU、内存使用率）
     - `counter`: 计数器（如流量统计）
     - `string`: 字符串（如设备描述）
   - **单位**: 如 `%`, `Mbps`, `个`
   - **值解析器**:
     - `regex:pattern`: 使用正则表达式提取值
     - `last_integer`: 提取最后一个整数
     - `last_word`: 提取最后一个单词

#### 采集配置（可选）
- 指标的 `collector_config` 字段支持 JSON 格式，用于覆盖默认的单 OID 采集参数。
- 支持的配置项包括：
  - `oid`: 覆盖指标主 OID，例如指定带索引的完整路径
  - `value_parser`: 优先于指标字段的解析器
  - `snmp_version` / `snmp_community`: 按需覆盖主机默认值
  - `timeout`: 超时时间（秒）
  - `domain_base_oid`: 若监控域在线用户数，可结合主机 `ppp_auth_mode` 自动拼接域名 ASCII 尾缀，例如 `1.3.6.1.4.1.25506.2.46.2.4.1.9`
    - 可配合 `domain_host_field` 指定使用的主机字段（默认 `ppp_auth_mode`）
    - 若需自定义正则，可提供 `domain_regex`（可使用命名分组 `domain`）
    - `domain_fallback` 提供无法从主机字段解析时的兜底域名
- 示例：`{"oid": "1.3.6.1.4.1.25506.2.46.2.4.1.9.3.105.109.99", "value_parser": "regex:Gauge32:\\s*(\\d+)"}`
  - 自动域名示例：`{"domain_base_oid":"1.3.6.1.4.1.25506.2.46.2.4.1.9","value_parser":"regex:Gauge32:\\s*(\\d+)","domain_fallback":"imc"}`

#### 测试 OID

使用 "OID 测试" 标签页：
1. 选择一个主机
2. 输入 OID
3. 点击 "测试" 按钮
4. 查看返回的所有值和解析结果
5. 根据需要选择合适的值解析器

### 3. 创建监控任务

访问 **SNMP 任务管理页面**：

#### 单个任务创建
1. 点击 "添加任务" 按钮
2. 选择主机和监控指标
3. 设置采集间隔（秒）
4. 启用/禁用监控
5. 任务名称会自动生成

#### 批量任务创建
1. 点击 "批量添加" 按钮
2. 选择多个主机（支持多选）
3. 选择多个指标（支持多选）
4. 设置统一的采集间隔
5. 系统会为每个主机和指标组合创建监控任务

#### 任务批量操作
- 在任务列表中勾选多个条目后，可通过 "批量删除" 一次性移除监控任务，系统会同时清理其历史数据点和告警配置。

**示例**: 选择 10 个主机和 3 个指标，将创建 30 个监控任务

### 4. 监控仪表板

访问 **SNMP 监控仪表板**：

#### 功能特性

1. **统计概览**
   - 总任务数、活动任务数、失败任务数
   - 监控主机数、监控指标数

2. **设备卡片**
   - 按主机分组显示所有监控指标
   - 实时显示最新采集值
   - 颜色编码：
     - 绿色：正常（< 60%）
     - 黄色：警告（60-80%）
     - 红色：危险（> 80%）
   - 显示采集状态和最后采集时间

3. **历史数据图表**
   - 点击任意监控项查看历史趋势
   - 显示最近 24 小时的数据
   - 支持时间序列折线图

4. **自动刷新**
   - 每 30 秒自动刷新一次数据
   - 手动刷新按钮

5. **搜索过滤**
   - 按主机名、指标名搜索

## 配置示例

### H3C/HP Comware 设备

```yaml
# CPU 使用率
OID: 1.3.6.1.4.1.25506.2.6.1.1.1.1.6.3
解析器: regex:INTEGER:\s*(\d+)
单位: %

# 内存使用率
OID: 1.3.6.1.4.1.25506.2.6.1.1.1.1.8.3
解析器: regex:INTEGER:\s*(\d+)
单位: %

# 域在线用户数（手动指定完整 OID，例如域名 'imc' 对应的 ASCII 编码）
OID: 1.3.6.1.4.1.25506.2.46.2.4.1.9.3.105.109.99
解析器: regex:Gauge32:\s*(\d+)
单位: 个
```

### 标准 MIB-II

```yaml
# 系统运行时间
OID: 1.3.6.1.2.1.1.3.0
解析器: regex:Timeticks:\s*\((\d+)\)
单位: ticks

# 系统描述
OID: 1.3.6.1.2.1.1.1.0
解析器: regex:STRING:\s*(.+)
单位:
```

## 后台调度机制

SNMP 监控使用 APScheduler 实现自动化数据采集：

- 调度器每 30 秒执行一次扫描
- 检查所有启用的监控任务
- 根据任务的 `interval` 和 `last_poll_at` 判断是否需要采集
- 执行 snmpwalk 命令获取数据
- 解析并保存数据点
- 更新任务状态和最新值

## API 端点

### 监控指标

- `GET /api/snmp/metrics` - 获取所有指标
- `GET /api/snmp/metrics/builtin` - 获取内置指标
- `POST /api/snmp/metrics` - 创建指标
- `PUT /api/snmp/metrics/{id}` - 更新指标
- `DELETE /api/snmp/metrics/{id}` - 删除指标

### OID 测试

- `POST /api/snmp/test` - 测试 SNMP OID

### 监控任务

- `GET /api/snmp/tasks` - 获取所有任务
- `POST /api/snmp/tasks` - 创建任务
- `POST /api/snmp/tasks/batch` - 批量创建任务
- `PUT /api/snmp/tasks/{id}` - 更新任务
- `DELETE /api/snmp/tasks/{id}` - 删除任务

### 数据查询

- `GET /api/snmp/tasks/{id}/data?hours=24` - 获取历史数据

### 统计信息

- `GET /api/snmp/stats` - 获取监控统计

## 故障排查

### SNMP 命令不可用

```bash
# 检查 snmpwalk 是否安装
which snmpwalk

# 测试 SNMP 连接
snmpwalk -v2c -c <community> <hostname> <oid>
```

### 任务一直处于 pending 状态

1. 检查后端日志，确认调度器是否启动
2. 检查主机 SNMP 配置是否正确
3. 检查网络连接和防火墙规则

### 值解析失败

1. 使用 OID 测试功能查看原始返回值
2. 调整值解析器的正则表达式
3. 查看任务的 `last_error` 字段

### 数据点过多导致数据库增长

考虑定期清理历史数据：

```sql
-- 删除 30 天前的数据点
DELETE FROM snmp_data_points
WHERE timestamp < NOW() - INTERVAL '30 days';
```

## 性能优化建议

1. **合理设置采集间隔**
   - CPU/内存: 300 秒（5 分钟）
   - 在线用户数: 600 秒（10 分钟）
   - 设备描述: 3600 秒（1 小时）

2. **设备数量较多时**
   - 考虑调整调度器扫描间隔
   - 使用更长的采集间隔
   - 定期清理历史数据

3. **网络优化**
   - 确保服务器与设备之间网络稳定
   - 使用合适的 SNMP 超时时间

## 扩展功能

### 告警通知（待实现）

当前告警配置已经在数据库中，可以扩展实现：
- 邮件通知
- Webhook 通知
- 钉钉/企业微信通知

### 自定义图表

可以基于历史数据实现：
- 多指标对比图表
- 设备对比图表
- 自定义时间范围

## 技术架构

### 后端
- FastAPI - Web 框架
- SQLAlchemy - ORM
- APScheduler - 定时任务调度
- subprocess - 执行 snmpwalk 命令

### 前端
- React + TypeScript
- Material-UI - UI 组件库
- Recharts - 图表库
- Axios - HTTP 客户端

## 相关文件

### 后端
- `backend/core/db/models.py` - 数据模型
- `backend/schemas/snmp.py` - Pydantic schemas
- `backend/services/snmp.py` - SNMP 服务
- `backend/services/snmp_scheduler.py` - 调度器
- `backend/routers/snmp.py` - API 路由
- `backend/scripts/init_snmp.py` - 数据库初始化

### 前端
- `frontend/src/api/snmp.ts` - API 客户端
- `frontend/src/components/SNMP/SNMPConfigPage.tsx` - 配置页面
- `frontend/src/components/SNMP/SNMPTaskManagementPage.tsx` - 任务管理
- `frontend/src/components/SNMP/SNMPMonitorDashboard.tsx` - 监控仪表板

## 支持

如有问题，请查看：
1. 后端日志：查看 SNMP 调度器和 API 错误
2. 浏览器控制台：查看前端错误
3. 数据库日志：查看数据操作错误
