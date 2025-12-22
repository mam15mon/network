# Nornir VSR

一个基于 FastAPI + Nornir + React (Ant Design) 的全栈示例。

## 目录结构

- `backend/`：FastAPI 后端
  - `main.py`：应用入口 (`uvicorn backend.main:app --reload`)
  - `core/`：数据库、配置与基础设施
  - `routers/`：REST 接口
  - `services/nornir/`：Nornir 集成
- `frontend/`：Vite + React + Ant Design 前端
  - `src/`：前端源码

## 快速开始

### 全局环境变量

在仓库根目录按需创建 `.env`（可复制 `.env.example` 并修改）：

```bash
cp .env.example .env
```

如果缺省 `NORNIR_VSR_DB_URL`，后端会在启动时进入“安装模式”，通过 `/install` API 或前端安装向导填写数据库信息后，会自动写回 `.env`。该文件同时被前后端共享：
- 后端通过 `python-dotenv` 自动加载（如 `BACKEND_CORS_ORIGINS`、`AUTH_SECRET_KEY`、`NORNIR_VSR_DB_URL` 等）
- 前端的 Vite 通过 `envDir` 指向仓库根目录，仅暴露 `VITE_` 前缀的变量（如 `VITE_API_BASE`）

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows 使用 .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认前端运行在 `http://localhost:3000`，通过 Vite 代理访问后端 `http://localhost:8000`。

## 数据库配置

项目使用 PostgreSQL 数据库，默认连接信息如下：

| 项目 | 值 |
| --- | --- |
| 主机 | `localhost` |
| 端口 | `5432` |
| 数据库 | `nornir_vsr` |
| 用户 | `nornir_app` |
| 密码 | `nornir_pass_2025!` |

后端通过环境变量 `NORNIR_VSR_DB_URL` 读取数据库配置。若环境变量缺失，API 会以安装模式启动，通过以下接口完成初始化并自动创建所有表、默认管理员和内置 SNMP 指标：

1. `GET /install/status`：确认当前是否处于安装模式；
2. `POST /install/database/test`：测试数据库连接；
3. `POST /install/database/apply`：保存连接串、创建表结构、写入默认数据。

安装成功后会向 `.env` 追加 `NORNIR_VSR_DB_URL`，随后的启动流程会直接进入正常模式。

## 生产部署

使用 PM2 进行进程管理：

```bash
# 安装 PM2
npm install -g pm2

# 首次启动将进入安装模式，完成安装后即可正常运行（使用 --update-env 确保加载最新 .env）
pm2 start ecosystem.config.js --update-env

# 查看状态
pm2 status

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all
```

PM2 配置文件 `ecosystem.config.js` 包含了前后端服务的完整配置，包括环境变量和端口设置。

## 实时终端（WebSocket）与粘贴延迟

- 前端组件 `frontend/src/components/HostTerminalModal.tsx` 通过 WebSocket 连接后端 `backend/routers/terminal.py`，后端将 WebSocket 与远端 SSH 会话桥接，实现双向实时交互。
- 当向终端一次性粘贴大量配置时，某些网络设备（如部分 H3C/Comware）可能因缓冲区过载而卡住。为此，终端弹窗右上角提供“粘贴延迟”设置：
  - 开关：启用后，对粘贴内容按“行”进行节流发送；
  - 延迟（ms）：行与行之间的等待时间（默认 50ms，可调 0–2000ms）；
  - 分块（chars）：长行按该大小切分发送（默认 512，可调 32–4096）。
- 建议对批量配置启用粘贴延迟，以模拟人工输入的节奏，避免冲击设备缓冲区。

## 许可证管理界面

- “许可证状态”表格默认读取数据库中的快照数据，点击“刷新许可证状态”会实时连接设备获取 `display license` 信息并写回数据库。
- 许可证状态列提供两层视觉提示：
  - 主标签会高亮“永久授权”（绿色）或“非永久授权”（黄色），并附带成功/警告图标帮助快速识别。
  - 个别许可证 Tag 会根据实际状态着色（永久=绿色、即将到期=橙色/火山橙、过期=红色），鼠标悬浮可查看剩余天数与文件名。
- 顶部筛选条的“全部授权 / 永久授权 / 非永久”切换直接控制表格数据，结合手动主机选择时会以选定主机列表发送请求，避免造成筛选与刷新之间的状态跳变。
- 预览 DID/AK 文件时弹窗背景、字体与边框会随浅/深色主题自适应，保证暗色模式的可读性。
- “许可证数据库”表格展示已保存的 DID/AK 文件，点击文件名即可预览具体内容。
