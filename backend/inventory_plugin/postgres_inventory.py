"""
PostgreSQL 库存插件
用于从 PostgreSQL 数据库加载网络设备信息到 Nornir
"""

import asyncio
import json
from typing import Any, Dict, Optional

import asyncpg
from nornir.core.inventory import (
    Host,
    Group,
    Hosts,
    Groups,
    Inventory,
    ConnectionOptions,
    Defaults,
    ParentGroups,
)

from loguru import logger


class PostgreSQLInventory:
    """PostgreSQL 库存插件实现"""

    def __init__(
        self,
        database_url: str,
        table_name: str = "devices",
        group_table: str = "device_groups",
        defaults_table: str = "device_defaults",
        **kwargs: Any,
    ) -> None:
        """
        初始化 PostgreSQL 库存插件

        Args:
            database_url: PostgreSQL 数据库连接 URL
            table_name: 设备表名
            group_table: 组表名
            defaults_table: 默认配置表名
        """
        self.database_url = database_url
        self.table_name = table_name
        self.group_table = group_table
        self.defaults_table = defaults_table
        self.kwargs = kwargs

    async def load(self) -> Inventory:
        """
        从数据库加载库存数据

        Returns:
            Inventory: Nornir 库存对象
        """
        logger.info(f"从数据库加载库存数据: {self.database_url}")

        connection = await asyncpg.connect(self.database_url)

        try:
            # 加载默认配置
            defaults = await self._load_defaults(connection)

            # 加载组数据
            groups = await self._load_groups(connection, defaults)

            # 加载主机数据
            hosts = await self._load_hosts(connection, groups, defaults)

            return Inventory(
                hosts=hosts,
                groups=groups,
                defaults=defaults
            )

        finally:
            await connection.close()

    @staticmethod
    def _normalize_json_dict(raw: Any) -> Dict[str, Any]:
        if raw is None:
            return {}
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            raise TypeError("JSON 字符串解析后不是对象(dict)")
        try:
            return dict(raw)
        except Exception as exc:  # noqa: BLE001
            raise TypeError("无法将值转换为 dict") from exc

    @staticmethod
    def _parse_connection_options(raw: Any) -> Dict[str, ConnectionOptions]:
        """
        将数据库里的 JSON 连接选项转换为 Nornir 的 ConnectionOptions 结构。

        兼容两类常见存储：
        1) {"scrapli": {"auth_strict_key": false, "timeout_ops": 30}}  # 视为 extras
        2) {"scrapli": {"hostname": "...", "port": 22, "extras": {...}}}
        """
        if not raw:
            return {}

        if isinstance(raw, str):
            raw = json.loads(raw)

        if not isinstance(raw, dict):
            raise TypeError("connection_options 必须是 dict(JSON 对象或可解析的 JSON 字符串)")

        parsed: Dict[str, ConnectionOptions] = {}
        for connection_name, connection_config in raw.items():
            if connection_config is None:
                continue

            if not isinstance(connection_config, dict):
                raise TypeError(f"connection_options['{connection_name}'] 必须是 dict")

            extras = connection_config.get("extras")
            if extras is None:
                extras = connection_config

            parsed[connection_name] = ConnectionOptions(
                hostname=connection_config.get("hostname"),
                port=connection_config.get("port"),
                username=connection_config.get("username"),
                password=connection_config.get("password"),
                platform=connection_config.get("platform"),
                extras=extras if extras else None,
            )

        return parsed

    @staticmethod
    def _merge_connection_options_chain(
        options: list[ConnectionOptions | None],
    ) -> ConnectionOptions:
        """
        将 defaults/groups/host 的 ConnectionOptions 做“字段覆盖 + extras 深度合并”。

        - 标量字段：后者覆盖前者（None 不覆盖）
        - extras：dict.update 逐层合并（后者覆盖同名 key）
        """
        hostname = None
        port = None
        username = None
        password = None
        platform = None

        merged_extras: Dict[str, Any] = {}
        for option in options:
            if option is None:
                continue
            if option.hostname is not None:
                hostname = option.hostname
            if option.port is not None:
                port = option.port
            if option.username is not None:
                username = option.username
            if option.password is not None:
                password = option.password
            if option.platform is not None:
                platform = option.platform
            if option.extras:
                merged_extras.update(option.extras)

        return ConnectionOptions(
            hostname=hostname,
            port=port,
            username=username,
            password=password,
            platform=platform,
            extras=merged_extras or None,
        )

    async def _load_defaults(self, connection: asyncpg.Connection) -> Defaults:
        """加载默认配置"""
        try:
            query = f"""
                SELECT
                    data,
                    username,
                    password,
                    platform,
                    port,
                    connection_options
                FROM {self.defaults_table}
                LIMIT 1
            """

            row = await connection.fetchrow(query)

            if row:
                return Defaults(
                    data=self._normalize_json_dict(row["data"]),
                    username=row["username"],
                    password=row["password"],
                    platform=row["platform"],
                    port=row["port"],
                    connection_options=self._parse_connection_options(row["connection_options"]),
                )
            else:
                # 返回默认值
                return Defaults(
                    data={},
                    username="admin",
                    password="password",
                    platform="cisco_ios",
                    port=22,
                    connection_options={
                        "scrapli": ConnectionOptions(extras={"auth_strict_key": False}),
                    },
                )

        except Exception as e:
            logger.warning(f"加载默认配置失败: {e}")
            return Defaults()

    async def _load_groups(self, connection: asyncpg.Connection, defaults: Defaults) -> Groups:
        """加载组数据"""
        groups_dict = {}

        try:
            query = f"""
                SELECT
                    name,
                    data,
                    username,
                    password,
                    platform,
                    port,
                    connection_options
                FROM {self.group_table}
            """

            rows = await connection.fetch(query)

            for row in rows:
                groups_dict[row["name"]] = Group(
                    name=row["name"],
                    data=self._normalize_json_dict(row["data"]),
                    username=row["username"],
                    password=row["password"],
                    platform=row["platform"],
                    port=row["port"],
                    connection_options=self._parse_connection_options(row["connection_options"]),
                    defaults=defaults,
                )

        except Exception as e:
            logger.warning(f"加载组数据失败: {e}")

        return Groups(groups_dict)

    async def _load_hosts(
        self,
        connection: asyncpg.Connection,
        groups: Groups,
        defaults: Defaults,
    ) -> Hosts:
        """加载主机数据"""
        hosts_dict = {}

        try:
            query = f"""
                SELECT
                    name,
                    hostname,
                    site,
                    group_name,
                    data,
                    device_type,
                    username,
                    password,
                    platform,
                    port,
                    connection_options
                FROM {self.table_name}
            """

            rows = await connection.fetch(query)

            for row in rows:
                group_name = row["group_name"]
                host_groups = []
                if group_name:
                    group_obj = groups.get(group_name)
                    if group_obj:
                        host_groups = [group_obj]
                    else:
                        logger.warning(f"主机 {row['name']} 引用不存在的组: {group_name}")

                host_data = self._normalize_json_dict(row["data"])
                if row["site"]:
                    host_data["site"] = row["site"]
                if row["device_type"]:
                    host_data["device_type"] = row["device_type"]

                # 合并 defaults/groups/host 的 connection_options，避免 extras 被“整块覆盖”
                raw_host_connection_options = self._parse_connection_options(row["connection_options"])
                merged_connection_options: Dict[str, ConnectionOptions] = {}
                connection_names = set(defaults.connection_options.keys())
                for group_obj in host_groups:
                    connection_names.update(group_obj.connection_options.keys())
                connection_names.update(raw_host_connection_options.keys())

                for connection_name in connection_names:
                    chain: list[ConnectionOptions | None] = [defaults.connection_options.get(connection_name)]
                    chain.extend([group_obj.connection_options.get(connection_name) for group_obj in host_groups])
                    chain.append(raw_host_connection_options.get(connection_name))
                    merged_connection_options[connection_name] = self._merge_connection_options_chain(chain)

                hosts_dict[row["name"]] = Host(
                    name=row["name"],
                    hostname=row["hostname"],
                    groups=ParentGroups(host_groups),
                    data=host_data,
                    username=row["username"],
                    password=row["password"],
                    platform=row["platform"],
                    port=row["port"],
                    connection_options=merged_connection_options,
                    defaults=defaults,
                )

        except Exception as e:
            logger.error(f"加载主机数据失败: {e}")
            raise

        return Hosts(hosts_dict)


# 为了兼容 Nornir 的同步接口，创建同步包装器
class SyncPostgreSQLInventory:
    """同步版本的 PostgreSQL 库存插件"""

    def __init__(self, **kwargs: Any) -> None:
        self.async_inventory = PostgreSQLInventory(**kwargs)

    def load(self) -> Inventory:
        """同步加载库存数据"""
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 如果已经在事件循环中，创建新的线程池
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, self.async_inventory.load())
                return future.result()
        else:
            return asyncio.run(self.async_inventory.load())
