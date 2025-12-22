"""Nornir 执行与命令记录接口。"""
from __future__ import annotations

import io
import json
import logging
import os
import socket
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from nornir.core.filter import F
from nornir.core.task import Result, Task
from nornir_netmiko.tasks import netmiko_send_command, netmiko_send_config, netmiko_multiline
from nornir_utils.plugins.tasks.networking import tcp_ping

from core.db.database import Database
from core.db.models import Host
from app.security import get_current_active_user
from schemas.nornir import (
    CommandLogEntry,
    CommandType,
    ConfigSnapshotDetail,
    ConfigSnapshotSummary,
    NornirCommandRequest,
    NornirCommandResponse,
)
from services.nornir.manager import NornirManager, encode_task_name

router = APIRouter(
    prefix="/nornir",
    tags=["nornir"],
    dependencies=[Depends(get_current_active_user)],
)

logger = logging.getLogger(__name__)

db_manager = Database()
nornir_manager = NornirManager()


class SnapshotBatchDelete(BaseModel):
    ids: List[int]


@encode_task_name
def run_display_command(task: Task, command: str) -> Result:
    commands = [cmd.strip() for cmd in command.splitlines() if cmd.strip()] or [command.strip()]
    outputs: List[str] = []

    for index, cmd in enumerate(commands, start=1):
        response = task.run(
            netmiko_send_command,
            command_string=cmd,
            name=f"display ({index}) : {cmd}",
        )
        result_text = response.result if isinstance(response.result, str) else str(response.result)
        decorated_output = f"$ {cmd}\n{result_text}"
        response.result = decorated_output
        outputs.append(decorated_output)

    combined_output = "\n\n".join(outputs)
    return Result(host=task.host, result=combined_output)


@encode_task_name
def run_config_command(task: Task, commands: List[str]) -> Result:
    response = task.run(netmiko_send_config, config_commands=commands)
    return Result(host=task.host, result=response.result)


@encode_task_name
def run_multiline_command(task: Task, commands: List[str], use_timing: bool = False) -> Result:
    """执行多行命令，支持timing模式和文件输出"""
    device_name = task.host.name
    site = task.host.data.get('site', '未分类')

    # 创建输出目录
    output_dir = Path("vsr_commands") / site / "交互命令"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f'{device_name}-commands.txt'

    try:
        # 准备命令列表
        command_list = []

        if use_timing:
            # timing模式下直接使用命令
            for cmd in commands:
                cmd = cmd.strip()
                if cmd:
                    command_list.append(cmd)
        else:
            # 非timing模式需要处理期望响应
            for cmd in commands:
                cmd = cmd.strip()
                if not cmd:
                    continue

                parts = cmd.split('|', 1)
                command = parts[0].strip()
                expect = parts[1].strip() if len(parts) > 1 else r"[#>]"
                command_list.append([command, expect])

        # 使用netmiko_multiline执行命令
        output = task.run(
            task=netmiko_multiline,
            commands=command_list,
            use_timing=use_timing,
            last_read=8,
            read_timeout=0,
        )

        # 写入输出文件
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("=== 交互命令执行 ===\n\n")
            f.write("执行的命令序列:\n")
            for i, cmd in enumerate(command_list, 1):
                f.write(f"{i}. 命令: {cmd}\n")
            f.write("\n=== 执行输出 ===\n")
            f.write(str(output.result))

        # 准备返回结果
        combined_output = [
            "交互命令执行结果:",
            f"输出文件: {output_file}",
            "",
            "执行的命令序列:"
        ]
        for i, cmd in enumerate(command_list, 1):
            combined_output.append(f"{i}. {cmd}")
        combined_output.extend(["\n命令输出:", str(output.result)])

        return Result(
            host=task.host,
            result={
                "success": True,
                "output": "\n".join(combined_output),
                "output_file": str(output_file),
                "commands": command_list
            }
        )

    except Exception as e:
        error_msg = f"交互命令执行失败: {str(e)}"

        # 写入错误信息到文件
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("=== 交互命令执行失败 ===\n\n")
            f.write(f"错误信息: {error_msg}\n")
            f.write("执行的命令:\n")
            for cmd in commands:
                f.write(f"  {cmd}\n")

        return Result(
            host=task.host,
            result={
                "success": False,
                "output": error_msg,
                "output_file": str(output_file),
                "commands": commands
            },
            failed=True
        )


@encode_task_name
def run_connectivity(task: Task, ports: List[int]) -> Result:
    host_ip = task.host.hostname
    timeout_seconds = 5

    ping_result = task.run(
        tcp_ping,
        ports=ports,
        timeout=timeout_seconds,
        host=host_ip,
    )

    port_states = {}
    if ping_result and hasattr(ping_result[0], "result"):
        result_data = ping_result[0].result
        if isinstance(result_data, dict):
            port_states = result_data

    enhanced_port_states = {}
    for port in ports:
        reachable = bool(port_states.get(port))
        latency_ms: Optional[float] = None
        if reachable:
            start_time = time.perf_counter()
            sock = socket.socket()
            sock.settimeout(timeout_seconds)
            try:
                sock.connect((host_ip, port))
                latency_ms = (time.perf_counter() - start_time) * 1000
            except Exception:  # noqa: BLE001
                latency_ms = None
            finally:
                try:
                    sock.close()
                except Exception:  # noqa: BLE001
                    pass

        enhanced_port_states[port] = {
            "reachable": reachable,
            "latency_ms": latency_ms,
        }

    if ping_result and hasattr(ping_result[0], "result"):
        ping_result[0].result = enhanced_port_states

    success = True
    for port in ports:
        reachable = bool(port_states.get(port))
        success = success and reachable

    login_message = ""
    if ports:
        if any(bool(port_states.get(port)) for port in ports):
            try:
                task.host.get_connection("netmiko", task.nornir.config)
                login_message = "登录验证: 成功"
            except Exception as exc:  # noqa: BLE001
                success = False
                login_message = f"登录验证: 失败 ({exc})"
            finally:
                try:
                    task.host.close_connection("netmiko")
                except Exception:  # noqa: BLE001
                    pass
        else:
            login_message = "登录验证: 未执行（端口不可达）"

    return Result(host=task.host, result=login_message, failed=not success)


def _aggregate_result(multi_result: Result) -> str:
    outputs: List[str] = []
    seen: set[str] = set()

    def _append(value: str) -> None:
        text = value.strip()
        if text and text not in seen:
            outputs.append(text)
            seen.add(text)

    for item in multi_result:
        if getattr(item, "result", None) is None:
            continue

        result = item.result
        if isinstance(result, dict):
            if "success" in result:
                message = str(result.get("output", ""))
                if result.get("success"):
                    _append(message)
                else:
                    _append(f"错误: {message}")
            elif result and all(
                isinstance(key, int) and isinstance(value, bool)
                for key, value in result.items()
            ):
                for port, reachable in result.items():
                    _append(f"端口 {port}: {'可达' if reachable else '不可达'}")
            elif result and all(
                isinstance(key, int)
                and isinstance(value, dict)
                and "reachable" in value
                for key, value in result.items()
            ):
                for port, info in result.items():
                    reachable = info.get("reachable", False)
                    latency = info.get("latency_ms")
                    if latency is not None:
                        _append(
                            f"端口 {port}: {'可达' if reachable else '不可达'} (延迟 {latency:.1f} ms)"
                        )
                    else:
                        _append(f"端口 {port}: {'可达' if reachable else '不可达'}")
            else:
                _append(str(result))
        else:
            _append(str(result))

    if not outputs and getattr(multi_result, "result", None) is not None:
        result = multi_result.result
        if isinstance(result, dict):
            if "output" in result:
                return str(result.get("output", ""))
            if result and all(
                isinstance(key, int) and isinstance(value, bool)
                for key, value in result.items()
            ):
                return "\n".join(
                    f"端口 {port}: {'可达' if reachable else '不可达'}"
                    for port, reachable in result.items()
                )
            if result and all(
                isinstance(key, int)
                and isinstance(value, dict)
                and "reachable" in value
                for key, value in result.items()
            ):
                lines = []
                for port, info in result.items():
                    reachable = info.get("reachable", False)
                    latency = info.get("latency_ms")
                    if latency is not None:
                        lines.append(
                            f"端口 {port}: {'可达' if reachable else '不可达'} (延迟 {latency:.1f} ms)"
                        )
                    else:
                        lines.append(f"端口 {port}: {'可达' if reachable else '不可达'}")
                return "\n".join(lines)
            return str(result)
        return str(result)

    return "\n".join(outputs)


def _extract_exception(multi_result: Result) -> Optional[str]:
    if not multi_result.failed:
        return None
    for item in multi_result:
        if item.failed and item.exception:
            return str(item.exception)
    return "执行失败"


def _snapshot_summary_payload(snapshot) -> Dict[str, object]:
    return {
        "id": snapshot.id,
        "host": snapshot.host_name,
        "site": snapshot.site,
        "command": snapshot.command,
        "executedAt": snapshot.executed_at,
        "filePath": snapshot.file_path,
    }


def _snapshot_detail_payload(snapshot) -> Dict[str, object]:
    payload = _snapshot_summary_payload(snapshot)
    payload["content"] = snapshot.content
    return payload


@router.post("/commands", response_model=List[NornirCommandResponse])
def execute_command(payload: NornirCommandRequest) -> List[NornirCommandResponse]:
    devices = db_manager.get_all_hosts()
    if not devices:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hosts available")

    nr = nornir_manager.init_nornir(devices)

    if payload.hosts:
        nr = nr.filter(F(name__in=payload.hosts))
        if not nr.inventory.hosts:
            nornir_manager.close()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected hosts not found")

    host_map: Dict[str, Host] = {device.name: device for device in devices}

    try:
        if payload.command_type == CommandType.CONFIG:
            commands = payload.commands or []
            results = nr.run(task=run_config_command, commands=commands)
            executed_command = "\n".join(commands)
        elif payload.command_type == CommandType.MULTILINE:
            commands = payload.commands or []
            results = nr.run(task=run_multiline_command, commands=commands, use_timing=payload.use_timing)
            executed_command = "\n".join(commands)
        elif payload.command_type == CommandType.CONNECTIVITY:
            ports = []
            if payload.commands:
                for value in payload.commands:
                    try:
                        ports.append(int(value))
                    except ValueError:
                        continue
            elif payload.command:
                for part in payload.command.split(','):
                    part = part.strip()
                    if part:
                        try:
                            ports.append(int(part))
                        except ValueError:
                            continue
            if not ports:
                ports = [22]
            results = nr.run(task=run_connectivity, ports=ports)
            executed_command = ",".join(str(port) for port in ports)
        else:
            command = payload.command or ""
            results = nr.run(task=run_display_command, command=command)
            executed_command = command
    finally:
        nornir_manager.close()

    responses: List[NornirCommandResponse] = []
    for host_name, multi_result in results.items():
        host_obj = host_map.get(host_name)
        site = getattr(host_obj, "site", None)

        result_text = _aggregate_result(multi_result)
        exception_text = _extract_exception(multi_result)
        success = not multi_result.failed

        output_path = None

        snapshot_entry = None
        log_entry = None
        executed_at = datetime.now()
        should_persist = payload.command_type != CommandType.CONNECTIVITY
        if should_persist:
            log_entry = db_manager.add_command_log(
                host_name=host_name,
                site=site,
                command=executed_command,
                command_type=payload.command_type.value,
                result=result_text,
                success=success,
                exception=exception_text,
                output_path=output_path,
                executed_at=executed_at,
            )
            executed_at = log_entry.executed_at if log_entry and log_entry.executed_at else executed_at

            if payload.command_type == CommandType.CONFIG_DOWNLOAD and success:
                try:
                    snapshot_entry = db_manager.add_config_snapshot(
                        host_name=host_name,
                        site=site,
                        command=executed_command,
                        content=result_text,
                        file_path=None,
                        executed_at=executed_at,
                        command_log_id=log_entry.id if log_entry else None,
                    )
                except Exception as snapshot_exc:  # noqa: BLE001
                    logger.error("记录配置快照失败: %s", snapshot_exc)
                    snapshot_entry = None

        # 调试信息
        logger.info(f"Creating response for {host_name}:")
        logger.info(f"  log_entry.executed_at: {log_entry.executed_at if log_entry else 'None'}")
        logger.info(f"  payload.command_type: {payload.command_type}")

        responses.append(
            NornirCommandResponse(
                host=host_name,
                log_id=log_entry.id if log_entry else None,
                snapshot_id=snapshot_entry.id if snapshot_entry else None,
                command_type=payload.command_type,
                command=executed_command,
                result=result_text,
                failed=not success,
                exception=exception_text,
                executed_at=executed_at,
                output_path=output_path or (snapshot_entry.file_path if snapshot_entry else None),
            )
        )

    return responses


@router.get("/commands/history", response_model=List[NornirCommandResponse])
def command_history(
    limit: int = Query(default=50, ge=1, le=500),
    host: Optional[str] = None,
    command_type: Optional[CommandType] = Query(default=None, alias="commandType"),
    include_config_download: bool = Query(default=False, alias="includeConfigDownload"),
) -> List[NornirCommandResponse]:
    exclude_types: Optional[List[str]] = None
    if not include_config_download and command_type is None:
        exclude_types = [CommandType.CONFIG_DOWNLOAD.value]

    logs = db_manager.list_command_logs(
        host=host,
        command_type=command_type.value if command_type else None,
        exclude_command_types=exclude_types,
        limit=limit,
    )

    responses: List[NornirCommandResponse] = []
    for log in logs:
        snapshot_entry = None
        if log.command_type == CommandType.CONFIG_DOWNLOAD.value:
            snapshot_entry = db_manager.get_config_snapshot_by_log(log.id)
        responses.append(
            NornirCommandResponse(
                host=log.host_name,
                log_id=log.id,
                snapshot_id=snapshot_entry.id if snapshot_entry else None,
                command_type=CommandType(log.command_type),
                command=log.command,
                result=log.result or "",
                failed=not log.success,
                exception=log.exception,
                executed_at=log.executed_at,
                output_path=log.output_path or (snapshot_entry.file_path if snapshot_entry else None),
            )
        )
    return responses


@router.delete("/commands/history/{log_id}")
def delete_command_history(log_id: int) -> dict:
    deleted = db_manager.delete_command_log(log_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在或已删除")
    return {"deleted": True}


@router.get(
    "/config-snapshots",
    response_model=List[ConfigSnapshotSummary],
)
def list_config_snapshots(
    limit: int = Query(default=100, ge=1, le=1000),
    host: Optional[str] = None,
    site: Optional[str] = Query(default=None),
) -> List[ConfigSnapshotSummary]:
    snapshots = db_manager.list_config_snapshots(host=host, site=site, limit=limit)
    return [ConfigSnapshotSummary.model_validate(_snapshot_summary_payload(item)) for item in snapshots]


@router.get(
    "/config-snapshots/latest",
    response_model=List[ConfigSnapshotSummary],
)
def get_latest_config_snapshots(
    limit: int = Query(default=100, ge=1, le=1000),
    host: Optional[str] = None,
    site: Optional[str] = Query(default=None),
) -> List[ConfigSnapshotSummary]:
    snapshots = db_manager.list_latest_config_snapshots(host=host, site=site, limit=limit)
    return [ConfigSnapshotSummary.model_validate(_snapshot_summary_payload(item)) for item in snapshots]


@router.get(
    "/config-snapshots/{snapshot_id}",
    response_model=ConfigSnapshotDetail,
)
def get_config_snapshot(snapshot_id: int) -> ConfigSnapshotDetail:
    snapshot = db_manager.get_config_snapshot(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置快照不存在")
    return ConfigSnapshotDetail.model_validate(_snapshot_detail_payload(snapshot))


@router.delete("/config-snapshots/batch")
def delete_config_snapshots_batch(payload: SnapshotBatchDelete) -> dict:
    if not payload.ids:
        return {"deleted": 0}
    deleted = db_manager.batch_delete_config_snapshots(payload.ids)
    return {"deleted": deleted}


@router.delete("/config-snapshots/{snapshot_id}")
def delete_config_snapshot(snapshot_id: int) -> dict:
    deleted = db_manager.delete_config_snapshot(snapshot_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置快照不存在")
    return {"deleted": True}


@router.get("/config-snapshots/{snapshot_id}/download")
def download_config_snapshot(snapshot_id: int) -> StreamingResponse:
    snapshot = db_manager.get_config_snapshot(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配置快照不存在")

    filename = (
        f"{snapshot.host_name}-"
        f"{snapshot.executed_at.strftime('%Y%m%d%H%M%S') if snapshot.executed_at else 'config'}.cfg"
    )
    stream = io.StringIO(snapshot.content)
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(stream, media_type="text/plain", headers=headers)
