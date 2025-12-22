"""安装向导相关模型。"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class InstallStatus(BaseModel):
    install_mode: bool = Field(description="后端是否处于安装模式")
    database_configured: bool = Field(description="数据库是否已配置")


class DatabaseConfigPayload(BaseModel):
    connection_url: Optional[str] = Field(
        default=None,
        description="完整的数据库连接串，可选（postgresql+psycopg://...）",
    )
    host: Optional[str] = Field(default=None, description="数据库主机名或地址")
    port: Optional[int] = Field(default=5432, description="数据库端口")
    username: Optional[str] = Field(default=None, description="数据库用户名")
    password: Optional[str] = Field(default=None, description="数据库密码")
    database: Optional[str] = Field(default=None, description="数据库名称")
    ssl_mode: Optional[str] = Field(
        default="prefer",
        description="PostgreSQL sslmode 参数，可选 disable/allow/prefer/require/verify-ca/verify-full",
    )


class InstallActionResponse(BaseModel):
    success: bool
    message: str
