"""Nornir 管理器 - 集成 Nornir 和 Scrapli 功能（拆分版实现）"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from nornir import InitNornir

from app.core.config import settings
from app.core.logging import setup_logging

from .device_ops import (
    run_get_facts,
    run_get_interfaces,
    run_get_running_config,
    run_send_command,
    run_send_config,
    run_test_connectivity,
)
from .factory import create_nornir
from .inventory_ops import get_host_details, get_inventory_hosts
from .scrapli_registry import list_scrapli_tasks
from .scrapli_runner import run_scrapli_task

logger = setup_logging(__name__)


class NornirManager:
    """Nornir 管理器"""

    def __init__(self):
        self.nornir: Optional[InitNornir] = None

    def _get_nornir(self) -> Any:
        nr = self.nornir
        if not nr:
            raise RuntimeError("Nornir 未初始化")
        return nr

    async def initialize(self):
        """初始化 Nornir"""
        try:
            logger.info("初始化 Nornir...")
            self.nornir = create_nornir(
                database_url=settings.database_url_sync,
                num_workers=settings.NORNIR_NUM_WORKERS,
            )

            logger.info("Nornir 初始化成功")

        except Exception as e:  # noqa: BLE001
            logger.error("Nornir 初始化失败: %s", e)
            raise

    async def cleanup(self):
        """清理资源"""
        logger.info("清理 Nornir 资源")
        if self.nornir:
            self.nornir = None

    def get_inventory_hosts(self, filters: Optional[Dict[str, Any]] = None) -> List[str]:
        """获取库存主机列表"""
        nr = self._get_nornir()
        return get_inventory_hosts(nr, filters=filters)

    def get_host_details(self, host_name: str) -> Optional[Dict[str, Any]]:
        """获取主机详细信息"""
        nr = self._get_nornir()
        return get_host_details(nr, host_name)

    async def send_command(
        self,
        hosts: Union[str, List[str]],
        command: str,
        enable: bool = False,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        _ = enable
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return await run_send_command(nr, hosts, command=command, timeout=timeout, logger=logger)

    async def send_config(
        self,
        hosts: Union[str, List[str]],
        commands: Union[str, List[str]],
        dry_run: bool = False,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """在指定主机上执行配置命令（多条 configs）。"""
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        if isinstance(commands, str):
            commands = [commands]
        return await run_send_config(
            nr,
            hosts,
            commands=commands,
            dry_run=dry_run,
            timeout=timeout,
            logger=logger,
        )

    async def get_facts(self, hosts: Union[str, List[str]]) -> Dict[str, Any]:
        """获取设备版本等事实信息（当前仅返回原始命令输出）。"""
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return await run_get_facts(nr, hosts, logger=logger)

    async def get_interfaces(self, hosts: Union[str, List[str]]) -> Dict[str, Any]:
        """获取接口信息（返回原始命令输出）。"""
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return await run_get_interfaces(nr, hosts, logger=logger)

    def test_connectivity(self, hosts: Union[str, List[str]]) -> Dict[str, Any]:
        """测试主机连接（仅验证能否 open 连接，不发送命令）。"""
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return run_test_connectivity(nr, hosts, logger=logger)

    async def get_running_config(
        self,
        hosts: Union[str, List[str]],
        *,
        command: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return await run_get_running_config(nr, hosts, command=command, timeout=timeout, logger=logger)

    @staticmethod
    def list_scrapli_tasks() -> Dict[str, Any]:
        return list_scrapli_tasks()

    async def run_scrapli_task(
        self,
        hosts: Union[str, List[str]],
        task_name: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        nr = self._get_nornir()
        if isinstance(hosts, str):
            hosts = [hosts]
        return await run_scrapli_task(nr, hosts, task_name=task_name, params=params, logger=logger)
