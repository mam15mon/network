from __future__ import annotations

from pydantic import BaseModel, Field

from schemas.user import UserOut


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    otp: str | None = Field(default=None, description="TOTP 验证码，可选")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    require_totp: bool = False
    expires_in: int


class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class AdminPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class DisableTotpRequest(BaseModel):
    password: str
