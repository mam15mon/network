"""HTTP 请求日志中间件（开发调试用）"""

from __future__ import annotations

import json
import time
from typing import Any, Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from app.core.logging import setup_logging

logger = setup_logging(__name__)

_SENSITIVE_KEYS = {
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for k, v in value.items():
            if isinstance(k, str) and k.lower() in _SENSITIVE_KEYS:
                out[k] = "***"
            else:
                out[k] = _redact(v)
        return out
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    开发模式下记录 HTTP 请求信息。

    - 默认在 INFO 记录：method/path/status/duration/origin/req-id/query
    - 请求体仅在 DEBUG 记录，并对敏感字段做脱敏
    """

    def __init__(self, app: ASGIApp, max_body_bytes: int = 4096) -> None:
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        start = time.perf_counter()

        method = request.method.upper()
        path = request.url.path
        query = request.url.query

        origin = request.headers.get("origin")
        req_id = request.headers.get("x-request-id")
        dev_user = request.headers.get("x-dev-user")

        if method == "OPTIONS":
            acrm = request.headers.get("access-control-request-method")
            acrh = request.headers.get("access-control-request-headers")
            logger.info(
                f"HTTP {method} {path}"
                f" origin={origin!r} acrm={acrm!r} acrh={acrh!r}"
                f" req_id={req_id!r} user={dev_user!r}"
                f"{' ?' + query if query else ''}"
            )
        else:
            logger.info(
                f"HTTP {method} {path}"
                f" origin={origin!r} req_id={req_id!r} user={dev_user!r}"
                f"{' ?' + query if query else ''}"
            )

        content_type = request.headers.get("content-type", "")
        if method in {"POST", "PUT", "PATCH"} and "application/json" in content_type.lower():
            try:
                body = await request.body()
                if body:
                    clipped = body[: self.max_body_bytes]
                    try:
                        parsed = json.loads(clipped.decode("utf-8", errors="replace"))
                        logger.debug(f"HTTP body: {json.dumps(_redact(parsed), ensure_ascii=False)}")
                    except Exception:  # noqa: BLE001
                        logger.debug(f"HTTP body(raw): {clipped.decode('utf-8', errors='replace')}")
            except Exception:  # noqa: BLE001
                logger.debug("HTTP body: <failed to read>")

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0
        logger.info(f"HTTP {method} {path} -> {response.status_code} ({duration_ms:.1f}ms)")
        return response

