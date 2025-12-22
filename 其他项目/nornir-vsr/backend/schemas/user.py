from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_active: bool
    is_superuser: bool
    totp_enabled: bool
    totp_required: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    is_superuser: bool = False
    is_active: bool = True
    totp_required: bool = False


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    is_superuser: Optional[bool] = None
    is_active: Optional[bool] = None
    totp_required: Optional[bool] = None


class ResetTotpRequest(BaseModel):
    confirm: bool = Field(..., description="确认重置二次认证，必须为 True")
