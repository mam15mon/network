from __future__ import annotations

from typing import Any, Dict, Optional


def resolve_timeout_ops_for_command(host: Any, command: str) -> Optional[float]:
    """
    从数据库库存数据中解析“按命令设置超时”的规则。

    约定（均来自 DB 的 JSON 字段）：
    - device_defaults.data.command_timeouts
    - device_groups.data.command_timeouts
    - devices.data.command_timeouts

    command_timeouts 格式示例：
    {
      "display version": 90,
      "display interface": 120,
      "display bgp*": 180
    }

    规则匹配：
    1) 精确匹配 command
    2) 末尾带 * 的前缀匹配（例如 "display bgp*"）
    """
    merged: Dict[str, Any] = {}

    defaults = getattr(host, "defaults", None)
    if defaults and isinstance(getattr(defaults, "data", None), dict):
        merged.update(defaults.data.get("command_timeouts", {}) or {})

    try:
        for group in host.extended_groups():
            if isinstance(getattr(group, "data", None), dict):
                merged.update(group.data.get("command_timeouts", {}) or {})
    except Exception:  # noqa: BLE001
        pass

    if isinstance(getattr(host, "data", None), dict):
        merged.update(host.data.get("command_timeouts", {}) or {})

    if not merged:
        return None

    if command in merged:
        return float(merged[command])

    for pattern, value in merged.items():
        if isinstance(pattern, str) and pattern.endswith("*") and command.startswith(pattern[:-1]):
            return float(value)

    return None

