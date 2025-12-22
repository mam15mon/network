"""Application configuration helpers."""
from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.secret_key = os.environ.get("AUTH_SECRET_KEY", "change-me-please")
        self.access_token_expire_minutes = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        self.token_algorithm = os.environ.get("AUTH_TOKEN_ALGORITHM", "HS256")
        self.totp_issuer = os.environ.get("TOTP_ISSUER", "Nornir VSR")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
