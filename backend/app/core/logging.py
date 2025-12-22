"""日志配置"""

import sys
from pathlib import Path
from typing import Any

from loguru import logger

from .config import settings

_CONFIGURED = False


def setup_logging(name: str) -> Any:
    """设置日志配置"""

    global _CONFIGURED
    if not _CONFIGURED:
        # 移除默认处理器（只做一次，避免多模块 import 时反复重置）
        logger.remove()

        # 确保日志目录存在
        log_file_path = Path(settings.LOG_FILE)
        log_file_path.parent.mkdir(parents=True, exist_ok=True)

        # 控制台输出：保持单行、无富格式，避免 uvicorn/watchfiles 下出现乱码/换行
        logger.add(
            sys.stderr,
            level=settings.LOG_LEVEL,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} - {message}",
            colorize=False,
            backtrace=settings.DEBUG,
            diagnose=settings.DEBUG,
        )

        # 文件处理器
        logger.add(
            settings.LOG_FILE,
            level=settings.LOG_LEVEL,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} - {message}",
            rotation="10 MB",
            retention="30 days",
            compression="zip",
            encoding="utf-8",
        )

        # 错误日志单独文件
        error_log_path = log_file_path.parent / "error.log"
        logger.add(
            error_log_path,
            level="ERROR",
            format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} - {message}",
            rotation="10 MB",
            retention="30 days",
            compression="zip",
            encoding="utf-8",
        )

        _CONFIGURED = True

    return logger.bind(name=name)


# 创建全局日志记录器
app_logger = setup_logging("nornir_api")
