"""自定义 Nornir PostgreSQL 库存插件"""

from nornir.core.plugins.inventory import InventoryPluginRegister

from .postgres_inventory import SyncPostgreSQLInventory


# 让 `config/nornir_config.yml` 里的 `inventory.plugin: PostgreSQLInventory` 可用
InventoryPluginRegister.register("PostgreSQLInventory", SyncPostgreSQLInventory)
