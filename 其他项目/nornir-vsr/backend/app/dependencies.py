"""FastAPI 依赖项。"""
from typing import Generator

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.db.database import Database


def get_db() -> Generator[Session, None, None]:
    try:
        session = Database().get_session()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    try:
        yield session
    finally:
        session.close()
