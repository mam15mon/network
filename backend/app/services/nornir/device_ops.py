from __future__ import annotations

from typing import Any, Dict, List, Optional

from nornir.core.exceptions import NornirSubTaskError
from nornir.core.task import MultiResult, Result, Task
from nornir_scrapli.tasks import send_command, send_configs

from .commands import split_commands
from .connection_hygiene import close_all_connections, reset_and_close_connections
from .results import ensure_host_results, format_results
from .inventory_ops import filter_nornir_by_hosts, validate_hosts_exist
from .timeouts import resolve_timeout_ops_for_command
from .config_commands import guess_running_config_command


async def run_send_command(
    nr: Any,
    hosts: List[str],
    *,
    command: str,
    timeout: Optional[int],
    logger: object,
) -> Dict[str, Any]:
    commands = split_commands(command)
    if not commands:
        raise ValueError("命令不能为空")

    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"在 {len(hosts)} 台主机上执行命令: {commands if len(commands) > 1 else commands[0]}")

    def per_host_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        try:
            if len(commands) == 1:
                effective_timeout = (
                    float(timeout) if timeout is not None else resolve_timeout_ops_for_command(task.host, commands[0])
                )
                return task.run(task=send_command, command=commands[0], timeout_ops=effective_timeout)

            items: List[Dict[str, Any]] = []
            failed_count = 0

            for cmd in commands:
                effective_timeout = (
                    float(timeout) if timeout is not None else resolve_timeout_ops_for_command(task.host, cmd)
                )
                try:
                    r = task.run(task=send_command, command=cmd, timeout_ops=effective_timeout)
                    out = None
                    if isinstance(r, MultiResult) and len(r):
                        out = r[-1].result
                    items.append({"command": cmd, "failed": False, "result": out})
                except NornirSubTaskError as e:
                    failed_count += 1
                    err = None
                    try:
                        res = getattr(e, "result", None)
                        if isinstance(res, MultiResult) and len(res):
                            err = str(res[-1].exception) if getattr(res[-1], "exception", None) else None
                        elif getattr(res, "exception", None):
                            err = str(res.exception)
                    except Exception:  # noqa: BLE001
                        err = None
                    items.append({"command": cmd, "failed": True, "exception": err or str(e)})
                    continue

            return Result(
                host=task.host,
                result={"commands": items},
                failed=failed_count > 0,
                exception=RuntimeError(f"{failed_count} 个命令执行失败") if failed_count else None,
            )
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=per_host_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)


async def run_send_config(
    nr: Any,
    hosts: List[str],
    *,
    commands: List[str],
    dry_run: bool,
    timeout: Optional[int],
    logger: object,
) -> Dict[str, Any]:
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"在 {len(hosts)} 台主机上配置: {commands}")

    def per_host_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        try:
            return task.run(task=send_configs, configs=commands, dry_run=dry_run, timeout_ops=timeout)
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=per_host_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)


async def run_get_facts(nr: Any, hosts: List[str], *, logger: object) -> Dict[str, Any]:
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"获取 {len(hosts)} 台主机的事实信息")

    def facts_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        platform = (task.host.platform or "").lower()
        version_command = "display version" if "huawei" in platform else "show version"
        try:
            command_result = task.run(task=send_command, command=version_command)
            version_output = command_result[-1].result if isinstance(command_result, MultiResult) and len(command_result) else None
            return Result(
                host=task.host,
                result={
                    "platform": task.host.platform,
                    "version_command": version_command,
                    "version_output": version_output,
                },
            )
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=facts_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)


async def run_get_interfaces(nr: Any, hosts: List[str], *, logger: object) -> Dict[str, Any]:
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"获取 {len(hosts)} 台主机的接口信息")

    def interfaces_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        platform = (task.host.platform or "").lower()
        if "huawei" in platform or "h3c" in platform or "comware" in platform:
            command = "display interface brief"
        elif "juniper" in platform:
            command = "show interfaces terse"
        else:
            command = "show interfaces status"
        try:
            command_result = task.run(task=send_command, command=command)
            interfaces_output = (
                command_result[-1].result if isinstance(command_result, MultiResult) and len(command_result) else None
            )
            return Result(
                host=task.host,
                result={
                    "platform": task.host.platform,
                    "interfaces_command": command,
                    "interfaces_output": interfaces_output,
                },
            )
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=interfaces_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)


def run_test_connectivity(nr: Any, hosts: List[str], *, logger: object) -> Dict[str, Any]:
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"测试 {len(hosts)} 台主机的连接性")

    def connectivity_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        try:
            conn = task.host.get_connection("scrapli", task.nornir.config)
            is_alive = True
            try:
                is_alive = bool(getattr(conn, "isalive", lambda: True)())
            except Exception:  # noqa: BLE001
                is_alive = True
            if not is_alive:
                raise RuntimeError("Scrapli 连接未处于活动状态")
            return Result(host=task.host, result={"connected": True})
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=connectivity_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)


async def run_get_running_config(
    nr: Any,
    hosts: List[str],
    *,
    command: Optional[str],
    timeout: Optional[int],
    logger: object,
) -> Dict[str, Any]:
    """
    采集 running-config（按平台选择默认命令）。

    - 可通过 command 覆盖所有设备使用同一命令
    - timeout 映射到 scrapli timeout_ops（秒）；为空则：优先按命令规则，其次默认 180s
    """
    validate_hosts_exist(nr, hosts)
    filtered_nornir = filter_nornir_by_hosts(nr, hosts, logger=logger)
    logger.info(f"采集 {len(hosts)} 台主机的 running-config")

    def per_host_task(task: Task) -> Result:
        reset_and_close_connections(task, "scrapli", logger=logger)
        try:
            effective_command = command
            if not effective_command:
                # 允许在设备 data 中覆盖命令（只影响该设备）
                host_data = getattr(task.host, "data", None) or {}
                override = host_data.get("running_config_command") if isinstance(host_data, dict) else None
                effective_command = str(override).strip() if override else guess_running_config_command(task.host.platform)

            effective_timeout = None
            if timeout is not None:
                effective_timeout = float(timeout)
            else:
                effective_timeout = resolve_timeout_ops_for_command(task.host, effective_command) or 180.0

            return task.run(task=send_command, command=effective_command, timeout_ops=effective_timeout)
        finally:
            close_all_connections(task)

    result = filtered_nornir.run(task=per_host_task, on_failed=True)
    formatted = format_results(result)
    return ensure_host_results(formatted, hosts, logger=logger)
