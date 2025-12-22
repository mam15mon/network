from __future__ import annotations

from nornir import InitNornir

import inventory_plugin  # noqa: F401  # 注册自定义 Nornir inventory 插件


def create_nornir(*, database_url: str, num_workers: int) -> InitNornir:
    inventory_config = {
        "plugin": "PostgreSQLInventory",
        "options": {
            "database_url": database_url,
            "table_name": "devices",
            "group_table": "device_groups",
            "defaults_table": "device_defaults",
        },
    }

    return InitNornir(
        runner={"plugin": "threaded", "options": {"num_workers": num_workers}},
        inventory=inventory_config,
        logging={"enabled": False},
    )

