"""默认配置接口。"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.security import get_current_active_user
from core.db.models import Defaults
from schemas.defaults import DefaultsOut, DefaultsUpdate

router = APIRouter(
    prefix="/defaults",
    tags=["defaults"],
    dependencies=[Depends(get_current_active_user)],
)


@router.get("", response_model=DefaultsOut)
def get_defaults(db: Session = Depends(get_db)) -> DefaultsOut:
    defaults = db.query(Defaults).first()
    if not defaults:
        defaults = Defaults()
        db.add(defaults)
        db.commit()
        db.refresh(defaults)
    return DefaultsOut(
        timeout=defaults.timeout,
        global_delay_factor=defaults.global_delay_factor,
        fast_cli=defaults.fast_cli,
        read_timeout=defaults.read_timeout,
        num_workers=defaults.num_workers,
        license_module_enabled=defaults.license_module_enabled,
    )


@router.put("", response_model=DefaultsOut)
def update_defaults(payload: DefaultsUpdate, db: Session = Depends(get_db)) -> DefaultsOut:
    defaults = db.query(Defaults).first()
    if not defaults:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Defaults not initialized")

    for key, value in payload.model_dump().items():
        setattr(defaults, key, value)

    db.commit()
    db.refresh(defaults)
    return DefaultsOut(
        timeout=defaults.timeout,
        global_delay_factor=defaults.global_delay_factor,
        fast_cli=defaults.fast_cli,
        read_timeout=defaults.read_timeout,
        num_workers=defaults.num_workers,
        license_module_enabled=defaults.license_module_enabled,
    )
