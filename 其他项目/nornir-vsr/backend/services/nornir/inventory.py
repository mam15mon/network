"""Nornir 自定义清单插件。"""
from __future__ import annotations

import logging
from math import isnan
from typing import Any, Dict, List

from nornir.core.inventory import ConnectionOptions, Defaults, Host, Inventory

logger = logging.getLogger(__name__)


def _empty(value: Any) -> bool:
    return value is None or (isinstance(value, float) and isnan(value)) or value == ""


def _get_connection_options(data: Dict[str, Any]) -> Dict[str, ConnectionOptions]:
    return {
        name: ConnectionOptions(
            hostname=cfg.get("hostname"),
            port=cfg.get("port"),
            username=cfg.get("username"),
            password=cfg.get("password"),
            platform=cfg.get("platform"),
            extras=cfg.get("extras"),
        )
        for name, cfg in data.items()
    }


def _get_host_data(data: Dict[str, Any]) -> Dict[str, Any]:
    excluded = {"name", "hostname", "port", "username", "password", "platform"}
    netmiko_prefix = "netmiko_"
    payload: Dict[str, Any] = {}
    for key, value in data.items():
        if key in excluded or key.startswith(netmiko_prefix):
            continue
        payload[key] = value if not _empty(value) else None
    return payload


def _get_host_netmiko_options(data: Dict[str, Any]) -> Dict[str, ConnectionOptions]:
    options: Dict[str, Any] = {"netmiko": {"extras": {}}}
    mappings = {
        "netmiko_timeout": "timeout",
        "netmiko_global_delay_factor": "global_delay_factor",
        "netmiko_fast_cli": "fast_cli",
        "netmiko_read_timeout": "read_timeout_override",
    }
    for key, option_key in mappings.items():
        value = data.get(key)
        if _empty(value):
            continue
        if option_key in {"timeout", "read_timeout_override"}:
            options["netmiko"]["extras"][option_key] = int(value)
        elif option_key == "fast_cli":
            options["netmiko"]["extras"][option_key] = str(value).lower() not in {"0", "false", "none"}
        elif option_key == "global_delay_factor":
            options["netmiko"]["extras"][option_key] = float(value)
    return _get_connection_options(options) if options["netmiko"]["extras"] else {}


class FlatDataInventory:
    """基于数据库的自定义 Nornir 清单插件。"""

    def __init__(self, data: List[Any] | None = None, connection_options: Dict[str, Any] | None = None) -> None:
        from core.db.database import Database
        from core.db.models import Defaults as DefaultsModel

        self.data = data or []
        try:
            db = Database()
            with db.get_session() as session:
                defaults = session.query(DefaultsModel).first()
                if defaults:
                    self.connection_options = {
                        "timeout": defaults.timeout,
                        "global_delay_factor": defaults.global_delay_factor,
                        "fast_cli": defaults.fast_cli,
                        "read_timeout_override": defaults.read_timeout,
                    }
                    logger.info("从数据库加载连接选项 %s", self.connection_options)
                else:
                    raise RuntimeError("Defaults not found")
        except Exception as exc:  # noqa: BLE001 - 兜底默认值
            logger.error("加载连接选项失败: %s", exc)
            self.connection_options = {
                "timeout": 60,
                "global_delay_factor": 2.0,
                "fast_cli": False,
                "read_timeout_override": 30,
            }

    def load(self) -> Inventory:
        hosts: Dict[str, Host] = {}
        groups: Dict[str, Any] = {}
        defaults = Defaults()

        for device in self.data:
            try:
                connection_options = {
                    "netmiko": ConnectionOptions(
                        platform=device.platform,
                        hostname=device.hostname,
                        username=device.username,
                        password=device.password,
                        port=device.port,
                        extras={
                            "timeout": self.connection_options["timeout"],
                            "global_delay_factor": self.connection_options["global_delay_factor"],
                            "fast_cli": self.connection_options["fast_cli"],
                            "read_timeout_override": self.connection_options["read_timeout_override"],
                        },
                    )
                }
                host_data = {
                    "site": device.site,
                    "device_type": device.device_type,
                    "device_model": device.device_model,
                }
                hosts[device.name] = Host(
                    name=device.name,
                    hostname=device.hostname,
                    platform=device.platform,
                    username=device.username,
                    password=device.password,
                    port=device.port,
                    data=host_data,
                    groups=[],
                    connection_options=connection_options,
                )
            except Exception as exc:  # noqa: BLE001 - 单个主机失败不阻塞
                logger.error("构建主机 %s 失败: %s", getattr(device, "name", "unknown"), exc)
                continue

        return Inventory(hosts=hosts, groups=groups, defaults=defaults)
