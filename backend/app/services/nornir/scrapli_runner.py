from __future__ import annotations

from typing import Any, Dict, List

from nornir.core.task import Result, Task

from .connection_hygiene import close_all_connections, reset_and_close_connections
from .inventory_ops import filter_nornir_by_hosts, validate_hosts_exist
from .results import ensure_host_results, format_results
from .scrapli_registry import resolve_scrapli_task
from .timeouts import resolve_timeout_ops_for_command


async def run_scrapli_task(
    nr: Any,
    hosts: List[str],
    *,
    task_name: str,
    params: Dict[str, Any],
    logger: object,
) -> Dict[str, Any]:
    internal_task, base_params, effective_task_name = resolve_scrapli_task(task_name, params)
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)

    def per_host_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        try:
            effective_params = dict(base_params)

            if "timeout_ops" not in effective_params or effective_params.get("timeout_ops") is None:
                if effective_task_name == "send_command" and "command" in effective_params:
                    t = resolve_timeout_ops_for_command(task.host, str(effective_params["command"]))
                    if t is not None:
                        effective_params["timeout_ops"] = t
                elif effective_task_name == "send_commands" and "commands" in effective_params:
                    timeouts = [
                        resolve_timeout_ops_for_command(task.host, str(c)) for c in list(effective_params.get("commands") or [])
                    ]
                    timeouts = [t for t in timeouts if t is not None]
                    if timeouts:
                        effective_params["timeout_ops"] = max(timeouts)
                elif effective_task_name == "send_config" and "config" in effective_params:
                    t = resolve_timeout_ops_for_command(task.host, str(effective_params["config"]))
                    if t is not None:
                        effective_params["timeout_ops"] = t
                elif effective_task_name == "send_configs" and "configs" in effective_params:
                    timeouts = [
                        resolve_timeout_ops_for_command(task.host, str(c)) for c in list(effective_params.get("configs") or [])
                    ]
                    timeouts = [t for t in timeouts if t is not None]
                    if timeouts:
                        effective_params["timeout_ops"] = max(timeouts)

            return task.run(task=internal_task, **effective_params)
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=per_host_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)

