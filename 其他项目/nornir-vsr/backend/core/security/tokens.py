"""JWT token utilities."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt

from core.config import get_settings


def create_access_token(subject: str, expires_delta: timedelta | None = None, extra_claims: Dict[str, Any] | None = None) -> str:
    settings = get_settings()
    to_encode: Dict[str, Any] = {"sub": subject}
    if extra_claims:
        to_encode.update(extra_claims)
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.token_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.token_algorithm])
    return payload


class TokenError(Exception):
    """Raised when token validation fails."""

    def __init__(self, message: str, *, original: Exception | None = None) -> None:
        super().__init__(message)
        self.original = original


def get_token_subject(token: str) -> str:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject or not isinstance(subject, str):
            raise TokenError("Invalid token payload")
        return subject
    except JWTError as exc:  # noqa: B904
        raise TokenError("Token validation failed") from exc

