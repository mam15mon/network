from __future__ import annotations

from typing import Optional

from nornir.core.task import Task


def reset_and_close_connections(task: Task, connection_name: str = "scrapli", logger: Optional[object] = None) -> None:
    """
    解决 Nornir 连接缓存导致的“半开/未打开连接”问题：

    - nornir_scrapli 会把 connection 对象缓存到 host.connections；
    - 如果 open() 过程中抛错，连接对象仍可能残留在缓存中，但处于未打开状态；
    - 后续 get_connection() 直接返回该对象，不会再次 open()，从而触发 ScrapliConnectionNotOpened。
    """
    host = task.host
    try:
        if getattr(host, "connections", None) and connection_name in host.connections:
            if logger is not None:
                try:
                    logger.debug(
                        "清理主机连接缓存: host=%s connection=%s",
                        getattr(host, "name", "<unknown>"),
                        connection_name,
                    )
                except Exception:  # noqa: BLE001
                    pass
            try:
                host.close_connection(connection_name)
            except Exception:  # noqa: BLE001
                pass
            try:
                host.connections.pop(connection_name, None)
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass


def close_all_connections(task: Task) -> None:
    try:
        task.host.close_connections()
    except Exception:  # noqa: BLE001
        pass

