from __future__ import annotations

from typing import Any, Callable, Dict, Tuple

from nornir_scrapli import tasks as scrapli_tasks

ScrapliTask = Callable[..., Any]


SCRAPLI_TASK_ALLOWLIST: Dict[str, ScrapliTask] = {
    # Core
    "send_command": scrapli_tasks.send_command,
    "send_commands": scrapli_tasks.send_commands,
    "send_commands_from_file": scrapli_tasks.send_commands_from_file,
    "send_config": scrapli_tasks.send_config,
    "send_configs": scrapli_tasks.send_configs,
    "send_configs_from_file": scrapli_tasks.send_configs_from_file,
    "send_interactive": scrapli_tasks.send_interactive,
    "get_prompt": scrapli_tasks.get_prompt,
    # Config
    "cfg_get_config": scrapli_tasks.cfg_get_config,
    "cfg_load_config": scrapli_tasks.cfg_load_config,
    "cfg_commit_config": scrapli_tasks.cfg_commit_config,
    "cfg_abort_config": scrapli_tasks.cfg_abort_config,
    "cfg_diff_config": scrapli_tasks.cfg_diff_config,
    "cfg_get_version": scrapli_tasks.cfg_get_version,
    # NETCONF
    "netconf_get_config": scrapli_tasks.netconf_get_config,
    "netconf_edit_config": scrapli_tasks.netconf_edit_config,
    "netconf_commit": scrapli_tasks.netconf_commit,
    "netconf_discard": scrapli_tasks.netconf_discard,
    "netconf_delete_config": scrapli_tasks.netconf_delete_config,
    "netconf_lock": scrapli_tasks.netconf_lock,
    "netconf_unlock": scrapli_tasks.netconf_unlock,
    "netconf_validate": scrapli_tasks.netconf_validate,
    "netconf_get": scrapli_tasks.netconf_get,
    "netconf_rpc": scrapli_tasks.netconf_rpc,
    "netconf_capabilities": scrapli_tasks.netconf_capabilities,
}


SCRAPLI_MUTATING_TASKS = {
    "send_config",
    "send_configs",
    "send_configs_from_file",
    "cfg_load_config",
    "cfg_commit_config",
    "cfg_abort_config",
    "netconf_edit_config",
    "netconf_commit",
    "netconf_discard",
    "netconf_delete_config",
    "netconf_lock",
    "netconf_unlock",
}


def list_scrapli_tasks() -> Dict[str, Any]:
    return {"tasks": sorted(SCRAPLI_TASK_ALLOWLIST.keys()), "mutating": sorted(SCRAPLI_MUTATING_TASKS)}


def resolve_scrapli_task(task_name: str, params: Dict[str, Any]) -> Tuple[ScrapliTask, Dict[str, Any], str]:
    """
    解析 task + params，并做 from_file 的安全兼容（只接受文本内容，而非服务端任意路径）。

    返回：
    - 实际要执行的 task callable
    - 归一化后的 params
    - 实际 task 名（from_file 可能转换为 send_commands/send_configs）
    """
    if task_name not in SCRAPLI_TASK_ALLOWLIST:
        raise ValueError(f"不支持的 task: {task_name}")

    internal_task = SCRAPLI_TASK_ALLOWLIST[task_name]
    normalized = dict(params or {})
    effective_name = task_name

    if task_name in {"send_commands_from_file", "send_configs_from_file"}:
        content = normalized.pop("content", None)
        if content is None:
            raise ValueError("from_file 类 task 需要传入 params.content（文件内容文本）")
        lines = [ln.strip() for ln in str(content).splitlines()]
        lines = [ln for ln in lines if ln and not ln.startswith("#")]

        if task_name == "send_commands_from_file":
            internal_task = SCRAPLI_TASK_ALLOWLIST["send_commands"]
            normalized.pop("file", None)
            normalized["commands"] = lines
            effective_name = "send_commands"
        else:
            internal_task = SCRAPLI_TASK_ALLOWLIST["send_configs"]
            normalized.pop("file", None)
            normalized["configs"] = lines
            effective_name = "send_configs"

    return internal_task, normalized, effective_name

