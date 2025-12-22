#!/bin/bash

# 启动脚本 - Nornir Network Management System

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}🚀 启动 Nornir Network Management System${NC}"

# 检查 uv 是否安装
if ! command -v uv &> /dev/null; then
    echo -e "${RED}错误: uv 包管理器未安装${NC}"
    echo "请先安装 uv: https://github.com/astral-sh/uv"
    exit 1
fi

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}创建虚拟环境...${NC}"
    uv venv
fi

# 激活虚拟环境
echo -e "${YELLOW}激活虚拟环境...${NC}"
source .venv/bin/activate

# 检查虚拟环境 Python 版本
echo -e "${YELLOW}检查 Python 版本...${NC}"
python_version=$(".venv/bin/python" --version 2>&1 | cut -d' ' -f2)
required_version="3.14.2"

if ! ".venv/bin/python" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 14, 2) else 1)"; then
    echo -e "${RED}错误: 需要 Python $required_version 或更高版本，当前虚拟环境版本: $python_version${NC}"
    exit 1
fi

# 安装依赖
echo -e "${YELLOW}安装项目依赖...${NC}"
uv pip install -e .

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}复制环境变量模板...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}请编辑 .env 文件配置数据库连接信息${NC}"
fi

# 创建日志目录
mkdir -p logs

# 确保 `app.*` 可导入（backend 目录作为应用根）
export PYTHONPATH="$PROJECT_ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"

# 检查数据库连接
echo -e "${YELLOW}检查数据库连接...${NC}"
if ! python3 -c "
import asyncio
from app.core.config import settings
import asyncpg

async def check_db():
    try:
        # asyncpg 只接受 postgresql:// DSN（不支持 SQLAlchemy 的 postgresql+asyncpg://）
        conn = await asyncpg.connect(settings.database_url_sync)
        await conn.close()
        print('✅ 数据库连接成功')
    except Exception as e:
        print(f'❌ 数据库连接失败: {e}')
        exit(1)

asyncio.run(check_db())
" 2>/dev/null; then
    echo -e "${YELLOW}数据库连接失败，请先初始化数据库:${NC}"
    echo "python3 scripts/init_database.py"
    echo ""
    read -p "是否现在初始化数据库? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python3 scripts/init_database.py
    fi
fi

# 启动服务
echo -e "${GREEN}🎯 启动 FastAPI 服务...${NC}"
echo -e "${GREEN}API 文档: http://localhost:8000/docs${NC}"
echo -e "${GREEN}ReDoc: http://localhost:8000/redoc${NC}"
echo ""

# 使用 uvicorn 启动服务
if command -v uvicorn &> /dev/null; then
    uvicorn --app-dir backend main:app \
        --host ${HOST:-0.0.0.0} \
        --port ${PORT:-8000} \
        --reload \
        --log-level info
else
    python3 backend/main.py
fi
