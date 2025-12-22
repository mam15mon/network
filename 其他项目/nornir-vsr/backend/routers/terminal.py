"""WebSocket 终端会话接口。"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.db.database import Database
from core.db.models import User
from core.security.tokens import TokenError, get_token_subject

router = APIRouter(prefix="/ws", tags=["terminal"])

logger = logging.getLogger(__name__)

db_manager = Database()


async def _authorize_websocket(websocket: WebSocket) -> bool:
    token = websocket.query_params.get("token")  # type: ignore[attr-defined]
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        return False
    try:
        subject = get_token_subject(token)
    except TokenError:
        return False
    try:
        user_id = int(subject)
    except ValueError:
        return False
    with Database().get_session() as session:
        user = session.get(User, user_id)
        if not user or not user.is_active:
            return False
    return True


class TerminalProtocolError(Exception):
    """Raised when client payload is invalid."""


async def _send_json_safe(websocket: WebSocket, payload: dict[str, Any]) -> None:
    """Send JSON payload ignoring connection state errors."""

    try:
        await websocket.send_json(payload)
    except RuntimeError:
        # WebSocket already closed
        logger.debug("WebSocket runtime error while sending payload: %s", payload)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to send payload %s: %s", payload, exc)


async def _close_socket(websocket: WebSocket, code: int, reason: str) -> None:
    """Close WebSocket gracefully, swallowing common errors."""

    try:
        await websocket.close(code=code, reason=reason)
    except Exception:  # noqa: BLE001
        logger.debug("WebSocket close failed: code=%s reason=%s", code, reason)


@router.websocket("/hosts/{host_name}/terminal")
async def terminal_session(websocket: WebSocket, host_name: str) -> None:
    """Bridge a WebSocket connection to a remote SSH shell."""

    if not await _authorize_websocket(websocket):
        await websocket.close(code=4401, reason="unauthorized")
        return

    await websocket.accept()

    host = db_manager.get_host(host_name)
    if not host:
        await _send_json_safe(websocket, {"type": "error", "message": "未找到对应的设备"})
        await _close_socket(websocket, code=4404, reason="host_not_found")
        return

    if not host.hostname or not host.username or not host.password:
        await _send_json_safe(
            websocket,
            {
                "type": "error",
                "message": "设备缺少连接所需的地址或凭据",
            },
        )
        await _close_socket(websocket, code=4003, reason="missing_credentials")
        return

    port = host.port or 22

    try:
        connection = await asyncssh.connect(  # type: ignore[no-untyped-call]
            host.hostname,
            port=port,
            username=host.username,
            password=host.password,
            known_hosts=None,
            keepalive_interval=30,
        )
    except (asyncssh.Error, OSError) as exc:
        logger.warning("SSH connection to %s failed: %s", host.hostname, exc)
        await _send_json_safe(
            websocket,
            {
                "type": "error",
                "message": f"连接设备失败: {exc}",
            },
        )
        await _close_socket(websocket, code=1011, reason="ssh_connect_failed")
        return

    process: asyncssh.SSHClientProcess | None = None

    try:
        process = await connection.create_process(  # type: ignore[no-untyped-call]
            term_type="xterm-256color",
            term_size=(120, 36),
            encoding="utf-8",
            errors="ignore",
        )
    except (asyncssh.Error, OSError) as exc:
        logger.warning("Failed to open shell for %s: %s", host.hostname, exc)
        await _send_json_safe(
            websocket,
            {
                "type": "error",
                "message": f"打开终端失败: {exc}",
            },
        )
        await _close_socket(websocket, code=1011, reason="shell_open_failed")
        connection.close()
        return

    await _send_json_safe(
        websocket,
        {
            "type": "status",
            "status": "connected",
            "host": host.name,
            "address": host.hostname,
            "port": port,
        },
    )

    # Removed initial carriage return to avoid extra newline on connect

    # In some Comware/H3C devices the prompt only appears after the first
    # chunk is read; proactively read a small amount to push the welcome banner.
    try:
        chunk = await asyncio.wait_for(process.stdout.read(1024), timeout=1.5)
        if chunk:
            await websocket.send_json({"type": "data", "stream": "stdout", "payload": chunk})
    except asyncio.TimeoutError:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("Prefetch stdout failed for %s: %s", host.name, exc)

    async def forward_device_stream(stream: asyncssh.SSHReader, stream_name: str) -> None:
        try:
            while True:
                chunk = await stream.read(4096)
                if chunk == "":
                    break
                await websocket.send_json({"type": "data", "stream": stream_name, "payload": chunk})
        except Exception as exc:  # noqa: BLE001
            logger.debug("Device stream %s forwarding stopped: %s", stream_name, exc)
        finally:
            await _send_json_safe(websocket, {"type": "status", "status": "eof", "stream": stream_name})

    async def forward_client_input() -> None:
        try:
            while True:
                message = await websocket.receive_text()
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError as exc:
                    raise TerminalProtocolError(f"invalid json payload: {exc}") from exc

                message_type = payload.get("type")
                if message_type == "input":
                    data = payload.get("payload", "")
                    if not isinstance(data, str):
                        raise TerminalProtocolError("payload must be a string")
                    process.stdin.write(data)
                    await process.stdin.drain()
                elif message_type == "resize":
                    cols = payload.get("cols")
                    rows = payload.get("rows")
                    if isinstance(cols, int) and isinstance(rows, int):
                        try:
                            process.channel.change_terminal_dimensions(cols, rows)
                        except Exception as exc:  # noqa: BLE001
                            logger.debug("Failed to change terminal size: %s", exc)
                    else:
                        raise TerminalProtocolError("resize payload requires integer cols/rows")
                else:
                    raise TerminalProtocolError(f"unsupported message type: {message_type}")
        except WebSocketDisconnect:
            logger.info("Terminal session closed by client: %s", host.name)
        except TerminalProtocolError as exc:
            logger.warning("Terminal protocol error for %s: %s", host.name, exc)
            await _send_json_safe(websocket, {"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001
            logger.warning("Terminal input forwarding error for %s: %s", host.name, exc)
            await _send_json_safe(websocket, {"type": "error", "message": f"会话异常: {exc}"})
        finally:
            try:
                process.stdin.write_eof()
            except Exception:  # noqa: BLE001
                pass

    stdout_task = asyncio.create_task(forward_device_stream(process.stdout, "stdout"))
    stderr_task = asyncio.create_task(forward_device_stream(process.stderr, "stderr"))
    input_task = asyncio.create_task(forward_client_input())

    done, pending = await asyncio.wait(
        {stdout_task, stderr_task, input_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)

    # Ensure remaining tasks finish and process closes
    await asyncio.gather(*done, return_exceptions=True)

    try:
        await process.wait_closed()
    except Exception:  # noqa: BLE001
        pass

    connection.close()
    await connection.wait_closed()

    await _send_json_safe(websocket, {"type": "status", "status": "disconnected"})
    await _close_socket(websocket, code=1000, reason="session_ended")
