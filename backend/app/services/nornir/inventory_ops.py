from __future__ import annotations

from typing import Any, Dict, List, Optional


def validate_hosts_exist(nr: Any, hosts: List[str]) -> None:
    missing_hosts = [h for h in hosts if h not in nr.inventory.hosts]
    if missing_hosts:
        raise ValueError(f"主机不存在: {missing_hosts}")


def filter_nornir_by_hosts(nr: Any, hosts: List[str], *, logger: Optional[object] = None) -> Any:
    host_set = set(hosts)
    filtered = nr.filter(filter_func=lambda h: h.name in host_set)
    if not filtered.inventory.hosts and logger is not None:
        try:
            inventory_keys = list(nr.inventory.hosts.keys())
            sample = inventory_keys[:10]
            logger.warning(
                "过滤主机结果为空: requested=%r inventory_sample=%r total=%d",
                hosts,
                sample,
                len(inventory_keys),
            )
        except Exception:  # noqa: BLE001
            pass
    return filtered


def get_inventory_hosts(nr: Any, filters: Optional[Dict[str, Any]] = None) -> List[str]:
    hosts = nr.inventory.hosts

    if filters:
        filtered_hosts = []
        for host_name, host in hosts.items():
            match = True
            for key, value in filters.items():
                if key == "group":
                    group_names = [g.name for g in host.groups] if host.groups else []
                    if value not in group_names:
                        match = False
                        break
                    continue
                if hasattr(host, key) and getattr(host, key) != value:
                    match = False
                    break
                elif hasattr(host, "data") and host.data.get(key) != value:
                    match = False
                    break
            if match:
                filtered_hosts.append(host_name)
        return filtered_hosts

    return list(hosts.keys())


def get_host_details(nr: Any, host_name: str) -> Optional[Dict[str, Any]]:
    host = nr.inventory.hosts.get(host_name)
    if not host:
        return None

    connection_options = None
    if host.connection_options:
        connection_options = {
            name: {
                "hostname": option.hostname,
                "port": option.port,
                "username": option.username,
                "password": "***" if option.password else None,
                "platform": option.platform,
                "extras": option.extras,
            }
            for name, option in host.connection_options.items()
        }

    return {
        "name": host.name,
        "hostname": host.hostname,
        "platform": host.platform,
        "port": host.port,
        "username": host.username,
        "password": "***" if host.password else None,
        "data": host.data,
        "groups": [group.name for group in host.groups] if host.groups else [],
        "connection_options": connection_options,
    }

