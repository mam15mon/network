"""TOTP helper utilities."""
from __future__ import annotations

import secrets
from dataclasses import dataclass

import pyotp

from core.config import get_settings


def generate_totp_secret() -> str:
    # 32 characters base32 secret
    return pyotp.random_base32()


def get_totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    totp = get_totp(secret)
    try:
        return totp.verify(code, valid_window=1)
    except Exception:  # noqa: BLE001 - pyotp may raise on invalid input length
        return False


def build_provisioning_uri(username: str, secret: str) -> str:
    settings = get_settings()
    issuer = settings.totp_issuer
    totp = get_totp(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)

