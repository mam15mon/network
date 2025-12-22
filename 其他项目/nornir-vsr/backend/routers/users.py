from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, status, Response
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.security import require_superuser, user_to_schema
from core.db.models import User
from core.security.password import get_password_hash
from schemas.auth import AdminPasswordResetRequest
from schemas.user import ResetTotpRequest, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    users = db.query(User).order_by(User.username).all()
    return [user_to_schema(user) for user in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> UserOut:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        is_active=payload.is_active,
        is_superuser=payload.is_superuser,
        totp_required=payload.totp_required,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_schema(user)


def _ensure_superuser_exists(db: Session, exclude_user_id: int | None = None) -> None:
    query = db.query(User).filter(User.is_superuser.is_(True))
    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)
    if query.count() == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="必须至少保留一个超级管理员")


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    payload: UserUpdate,
    user_id: int = Path(..., ge=1),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if payload.is_superuser is not None and not payload.is_superuser and user.is_superuser:
        _ensure_superuser_exists(db, exclude_user_id=user_id)
    if payload.is_superuser is not None:
        user.is_superuser = payload.is_superuser
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.totp_required is not None:
        user.totp_required = payload.totp_required
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_schema(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int = Path(..., ge=1),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> Response:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.is_superuser:
        _ensure_superuser_exists(db, exclude_user_id=user_id)
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{user_id}/reset-password")
def reset_user_password(
    payload: AdminPasswordResetRequest,
    user_id: int = Path(..., ge=1),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    user.password_hash = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.post("/{user_id}/reset-totp")
def reset_user_totp(
    payload: ResetTotpRequest,
    user_id: int = Path(..., ge=1),
    _: User = Depends(require_superuser),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="需要确认重置")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    user.totp_secret = None
    user.totp_enabled = False
    db.add(user)
    db.commit()
    return {"status": "ok"}
