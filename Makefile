.PHONY: help install dev test lint format clean start stop init-db

# 默认目标
help:
	@echo "Nornir Network Management System - 可用命令:"
	@echo ""
	@echo "  install     - 安装项目依赖"
	@echo "  dev         - 设置开发环境"
	@echo "  test        - 运行测试"
	@echo "  lint        - 代码检查"
	@echo "  format      - 代码格式化"
	@echo "  clean       - 清理临时文件"
	@echo "  start       - 启动服务"
	@echo "  stop        - 停止服务"
	@echo "  init-db     - 初始化数据库"
	@echo "  docs        - 生成文档"

# 安装依赖
install:
	@if [ ! -d ".venv" ]; then \
		echo "创建虚拟环境..."; \
		uv venv; \
	fi
	@echo "激活虚拟环境并安装依赖..."
	@source .venv/bin/activate && uv pip install -e .
	@echo "安装开发依赖..."
	@source .venv/bin/activate && uv pip install -e ".[dev]"
	@echo "安装 pre-commit hooks..."
	@source .venv/bin/activate && pre-commit install

# 开发环境设置
dev: install
	@if [ ! -f ".env" ]; then \
		echo "复制环境变量模板..."; \
		cp .env.example .env; \
		echo "请编辑 .env 文件配置数据库连接信息"; \
	fi
	@mkdir -p logs
	@echo "开发环境设置完成"

# 运行测试
test:
	@echo "运行测试..."
	@source .venv/bin/activate && pytest -v --cov=backend --cov-report=html --cov-report=term-missing

# 代码检查
lint:
	@echo "运行代码检查..."
	@source .venv/bin/activate && ruff check backend/ scripts/
	@source .venv/bin/activate && mypy backend/

# 代码格式化
format:
	@echo "格式化代码..."
	@source .venv/bin/activate && black backend/ scripts/
	@source .venv/bin/activate && ruff format backend/ scripts/

# 清理临时文件
clean:
	@echo "清理临时文件..."
	@find . -type f -name "*.pyc" -delete
	@find . -type d -name "__pycache__" -delete
	@find . -type d -name "*.egg-info" -exec rm -rf {} +
	@find . -type d -name ".pytest_cache" -exec rm -rf {} +
	@find . -type d -name ".mypy_cache" -exec rm -rf {} +
	@find . -type d -name ".coverage" -exec rm -rf {} +
	@find . -type f -name ".coverage" -delete
	@rm -rf htmlcov/
	@rm -rf dist/
	@rm -rf build/

# 启动服务
start:
	@echo "启动服务..."
	@./scripts/start.sh

# 停止服务
stop:
	@echo "停止服务..."
	@./scripts/stop.sh

# 初始化数据库
init-db:
	@echo "初始化数据库..."
	@source .venv/bin/activate && python3 scripts/init_database.py

# 生成文档
docs:
	@echo "生成 API 文档..."
	@mkdir -p docs
	@source .venv/bin/activate && PYTHONPATH=\"backend\" python3 -c "
import json
from backend.main import app
from fastapi.openapi.utils import get_openapi

openapi_schema = get_openapi(
    title=app.title,
    version=app.version,
    description=app.description,
    routes=app.routes,
)

with open('docs/openapi.json', 'w') as f:
    json.dump(openapi_schema, f, indent=2)

print('API 文档已生成到 docs/openapi.json')
"

# 开发服务器 (开发模式)
dev-server:
	@echo "启动开发服务器..."
	@source .venv/bin/activate && PYTHONPATH=\"backend\" uvicorn --app-dir backend main:app --reload --host 0.0.0.0 --port 8000

# 数据库迁移
migrate:
	@echo "运行数据库迁移..."
	@source .venv/bin/activate && alembic upgrade head

# 创建新的数据库迁移
migration:
	@echo "创建新的数据库迁移..."
	@source .venv/bin/activate && alembic revision --autogenerate -m "$(MSG)"

# 检查依赖更新
deps-update:
	@echo "检查依赖更新..."
	@source .venv/bin/activate && uv pip list --outdated

# 检查平台支持
check-platforms:
	@echo "检查 Scrapli 平台支持..."
	@source .venv/bin/activate && python3 scripts/check_platforms.py

# 安装社区插件
install-community:
	@echo "安装 Scrapli Community 插件..."
	@source .venv/bin/activate && uv pip install scrapli-community>=2025.1.30
	@echo "验证安装..."
	@make check-platforms

# 列出所有支持的平台
list-platforms:
	@echo "Scrapli Community 支持的所有平台:"
	@source .venv/bin/activate && python3 scripts/list_all_platforms.py
