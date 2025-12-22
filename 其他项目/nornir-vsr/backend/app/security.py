from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.dependencies import get_db
from core.db.models import User
from core.security.password import verify_password
from core.security.tokens import TokenError, create_access_token, get_token_subject
from core.security.totp import verify_totp
from schemas.user import UserOut

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_access_token(user: User) -> tuple[str, int]:
    from core.config import get_settings

    settings = get_settings()
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token(str(user.id), expires_delta=expires_delta)
    expires_in = int(expires_delta.total_seconds())
    return token, expires_in


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        subject = get_token_subject(token)
    except TokenError as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.id == int(subject)).first()
    if not user:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    if current_user.totp_required and not current_user.totp_enabled:
        raise HTTPException(status_code=status.HTTP_428_PRECONDITION_REQUIRED, detail="需要完成二次认证")
    return current_user


def get_current_active_user_allowing_totp_pending(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    return current_user


def require_superuser(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要超级管理员权限")
    return current_user


def verify_user_totp(user: User, code: str | None) -> None:
    if not user.totp_enabled:
        return
    if not code or not verify_totp(user.totp_secret or "", code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="二次认证失败")


def update_last_login(db: Session, user: User) -> None:
    user.last_login_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)


def user_to_schema(user: User) -> UserOut:
    return UserOut.model_validate(user)
