from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.security import (
    authenticate_user,
    get_current_active_user,
    get_current_active_user_allowing_totp_pending,
    issue_access_token,
    update_last_login,
    user_to_schema,
    verify_user_totp,
)
from core.db.models import User
from core.security.password import get_password_hash, verify_password
from core.security.totp import build_provisioning_uri, generate_totp_secret, verify_totp
from schemas.auth import (
    DisableTotpRequest,
    LoginRequest,
    PasswordChangeRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    TokenResponse,
)
from schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")

    if user.totp_enabled and not payload.otp:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="需要二次验证码",
        )
    verify_user_totp(user, payload.otp)
    update_last_login(db, user)

    access_token, expires_in = issue_access_token(user)
    require_totp = user.totp_required and not user.totp_enabled
    return TokenResponse(
        access_token=access_token,
        user=user_to_schema(user),
        require_totp=require_totp,
        expires_in=expires_in,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(current_user: User = Depends(get_current_active_user)) -> TokenResponse:
    access_token, expires_in = issue_access_token(current_user)
    return TokenResponse(
        access_token=access_token,
        user=user_to_schema(current_user),
        require_totp=False,
        expires_in=expires_in,
    )


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_active_user_allowing_totp_pending)) -> UserOut:
    return user_to_schema(current_user)


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user.id)
    if not user or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码不正确")
    user.password_hash = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.post("/totp/setup", response_model=TOTPSetupResponse)
def setup_totp(
    current_user: User = Depends(get_current_active_user_allowing_totp_pending),
    db: Session = Depends(get_db),
) -> TOTPSetupResponse:
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    secret = generate_totp_secret()
    user.totp_secret = secret
    user.totp_enabled = False
    db.add(user)
    db.commit()
    provisioning_uri = build_provisioning_uri(user.username, secret)
    return TOTPSetupResponse(secret=secret, provisioning_uri=provisioning_uri)


@router.post("/totp/verify")
def verify_totp_setup(
    payload: TOTPVerifyRequest,
    current_user: User = Depends(get_current_active_user_allowing_totp_pending),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user.id)
    if not user or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="尚未初始化二次认证")
    if not verify_totp(user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码无效")
    user.totp_enabled = True
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.post("/totp/disable")
def disable_totp(
    payload: DisableTotpRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.totp_required:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="管理员已要求启用二次认证，无法关闭")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码不正确")
    user.totp_secret = None
    user.totp_enabled = False
    db.add(user)
    db.commit()
    return {"status": "ok"}
