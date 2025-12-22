#!/usr/bin/env python3
"""
最小可复现的 nornir-scrapli 连接/执行 smoke test。

目标：在不依赖 FastAPI/数据库库存的情况下，验证以下任务能否真实连到设备并执行：
['send_command', 'send_commands', 'send_commands_from_file', 'send_config', 'send_configs',
 'send_configs_from_file', 'send_interactive']
"""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path
from typing import List, Tuple

from nornir import InitNornir
from nornir_scrapli import tasks as scrapli_tasks


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="device-1", help="主机名(库存中的 name)")
    parser.add_argument("--host", required=True, help="设备管理地址/IP")
    parser.add_argument("--platform", required=True, help="scrapli/scrapli-community 平台名，如 huawei_vrp")
    parser.add_argument("--username", required=True, help="登录用户名")
    parser.add_argument("--password", required=True, help="登录密码")
    parser.add_argument("--port", type=int, default=22, help="端口，默认 22")

    parser.add_argument("--command", default=None, help="单条 show 命令；未提供则按平台给默认值")
    parser.add_argument(
        "--commands",
        nargs="*",
        default=None,
        help="多条命令(用于 send_commands)，不传则使用 --command + 一个附加命令",
    )

    parser.add_argument(
        "--config",
        nargs="*",
        default=None,
        help="配置命令列表(用于 send_configs)；默认不跑配置类任务",
    )
    parser.add_argument(
        "--apply-config",
        action="store_true",
        help="真正下发配置（默认 dry-run，不改变设备配置）",
    )

    parser.add_argument(
        "--run-interactive",
        action="store_true",
        help="运行 send_interactive（需要你提供 --interactive-events）",
    )
    parser.add_argument(
        "--interactive-events",
        nargs="*",
        default=None,
        help="交互事件，格式: 'input|expected|hidden'，hidden 可省略(默认为 false)，示例: 'enable|Password:|true'",
    )

    parser.add_argument("--timeout-ops", type=float, default=None, help="单次操作超时(秒)")
    parser.add_argument("--num-workers", type=int, default=1, help="nornir worker 数(建议 1 做烟测)")
    return parser.parse_args()


def _default_show_command(platform: str) -> str:
    platform_lower = platform.lower()
    if "huawei" in platform_lower:
        return "display version"
    return "show version"


def _default_extra_command(platform: str) -> str:
    platform_lower = platform.lower()
    if "huawei" in platform_lower:
        return "display device"
    return "show inventory"


def _build_inventory_files(
    directory: Path,
    *,
    name: str,
    host: str,
    platform: str,
    username: str,
    password: str,
    port: int,
) -> Tuple[Path, Path, Path]:
    hosts_yaml = directory / "hosts.yaml"
    groups_yaml = directory / "groups.yaml"
    defaults_yaml = directory / "defaults.yaml"

    hosts_yaml.write_text(
        "\n".join(
            [
                f"{name}:",
                f"  hostname: {host}",
                f"  platform: {platform}",
                f"  username: {username}",
                f"  password: {password}",
                f"  port: {port}",
                "  data: {}",
                "  groups: []",
                "  connection_options:",
                "    scrapli:",
                "      extras:",
                "        auth_strict_key: false",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    groups_yaml.write_text("", encoding="utf-8")
    defaults_yaml.write_text("{}", encoding="utf-8")
    return hosts_yaml, groups_yaml, defaults_yaml


def _parse_interactive_events(raw: List[str]) -> List[Tuple[str, str, bool]]:
    parsed: List[Tuple[str, str, bool]] = []
    for item in raw:
        parts = item.split("|")
        if len(parts) not in (2, 3):
            raise ValueError("interactive event 必须是 'input|expected|hidden' 或 'input|expected'")
        input_value = parts[0]
        expected = parts[1]
        hidden = False
        if len(parts) == 3:
            hidden = parts[2].strip().lower() in ("1", "true", "yes", "y")
        parsed.append((input_value, expected, hidden))
    return parsed


def main() -> int:
    args = _parse_args()

    command = args.command or _default_show_command(args.platform)
    commands = args.commands or [command, _default_extra_command(args.platform)]

    with tempfile.TemporaryDirectory(prefix="nornir-scrapli-smoke-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        hosts_yaml, groups_yaml, defaults_yaml = _build_inventory_files(
            tmp_path,
            name=args.name,
            host=args.host,
            platform=args.platform,
            username=args.username,
            password=args.password,
            port=args.port,
        )

        nr = InitNornir(
            inventory={
                "plugin": "SimpleInventory",
                "options": {
                    "host_file": str(hosts_yaml),
                    "group_file": str(groups_yaml),
                    "defaults_file": str(defaults_yaml),
                },
            },
            runner={"plugin": "threaded", "options": {"num_workers": args.num_workers}},
        )

        print("== send_command ==")
        r1 = nr.run(task=scrapli_tasks.send_command, command=command, timeout_ops=args.timeout_ops)
        print(r1)

        print("\n== send_commands ==")
        r2 = nr.run(task=scrapli_tasks.send_commands, commands=commands, timeout_ops=args.timeout_ops)
        print(r2)

        print("\n== send_commands_from_file ==")
        commands_file = tmp_path / "commands.txt"
        commands_file.write_text("\n".join(commands) + "\n", encoding="utf-8")
        r3 = nr.run(
            task=scrapli_tasks.send_commands_from_file,
            file=str(commands_file),
            timeout_ops=args.timeout_ops,
        )
        print(r3)

        if args.config:
            print("\n== send_configs (dry-run by default) ==")
            r4 = nr.run(
                task=scrapli_tasks.send_configs,
                configs=args.config,
                dry_run=False if args.apply_config else True,
                timeout_ops=args.timeout_ops,
            )
            print(r4)

            print("\n== send_configs_from_file (dry-run by default) ==")
            configs_file = tmp_path / "configs.txt"
            configs_file.write_text("\n".join(args.config) + "\n", encoding="utf-8")
            r5 = nr.run(
                task=scrapli_tasks.send_configs_from_file,
                file=str(configs_file),
                dry_run=False if args.apply_config else True,
                timeout_ops=args.timeout_ops,
            )
            print(r5)
        else:
            print("\n== send_config/send_configs: skipped (未提供 --config) ==")

        if args.run_interactive:
            if not args.interactive_events:
                raise SystemExit("--run-interactive 需要同时提供 --interactive-events")
            events = _parse_interactive_events(args.interactive_events)
            print("\n== send_interactive ==")
            r6 = nr.run(
                task=scrapli_tasks.send_interactive,
                interact_events=events,
                timeout_ops=args.timeout_ops,
            )
            print(r6)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

