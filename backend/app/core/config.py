"""应用配置设置"""

from functools import lru_cache
import json
from typing import List, Optional, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用设置"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # 应用配置
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    SECRET_KEY: str

    # 数据库配置
    DATABASE_URL: Optional[str] = None
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "nornir_db"
    DATABASE_USER: str = "nornir_user"
    DATABASE_PASSWORD: str = "nornir_password"
    SQLALCHEMY_ECHO: bool = False

    # Nornir 配置
    NORNIR_CONFIG_PATH: str = "config/nornir_config.yml"
    INVENTORY_PLUGIN_PATH: str = "backend/inventory_plugin"
    NORNIR_NUM_WORKERS: int = 100

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # CORS 配置
    # - React(Vite) 默认 5173
    # - 预留 3000（例如 Next.js/CRA）
    ALLOWED_HOSTS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 项目元数据
    PROJECT_NAME: str = "Nornir Network Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    @field_validator("ALLOWED_HOSTS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            value = v.strip()
            if not value:
                return []
            if value.startswith("["):
                parsed = json.loads(value)
                if not isinstance(parsed, list):
                    raise ValueError("ALLOWED_HOSTS 必须是列表或可解析为列表的 JSON 字符串")
                return [str(item) for item in parsed]
            return [item.strip() for item in value.split(",") if item.strip()]
        raise ValueError("ALLOWED_HOSTS 必须是字符串或字符串列表")

    @property
    def database_url_sync(self) -> str:
        """同步数据库 URL"""
        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        return (
            f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}@"
            f"{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )

    @property
    def database_url_async(self) -> str:
        """异步数据库 URL"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}@"
            f"{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )

@lru_cache()
def get_settings() -> Settings:
    """获取缓存的设置实例"""
    return Settings()


settings = get_settings()
