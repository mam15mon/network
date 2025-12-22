"""Nornir 管理器。"""
from __future__ import annotations

import logging
from functools import wraps
from typing import Dict, List

from nornir import InitNornir
from nornir.core.plugins.inventory import InventoryPluginRegister
from sqlalchemy.orm import Session

from core.base.singleton import SingletonBase
from core.db.database import Database
from core.db.models import Defaults as DefaultsModel, Host as HostModel
from services.nornir.inventory import FlatDataInventory

logger = logging.getLogger(__name__)


def encode_task_name(task_function):
    @wraps(task_function)
    def wrapper(*args, **kwargs):
        return task_function(*args, **kwargs)

    return wrapper


class NornirManager(SingletonBase):
    """管理 Nornir 生命周期。"""

    def _initialize(self) -> None:
        self.nr: InitNornir | None = None
        self.db = Database()

    def _get_defaults(self) -> Dict[str, int | float | bool]:
        with Session(self.db.engine) as session:
            defaults = session.query(DefaultsModel).first()
            if not defaults:
                defaults = DefaultsModel()
                session.add(defaults)
                session.commit()
            return {
                "timeout": defaults.timeout,
                "global_delay_factor": defaults.global_delay_factor,
                "fast_cli": defaults.fast_cli,
                "read_timeout": defaults.read_timeout,
                "num_workers": defaults.num_workers,
            }

    def init_nornir(self, devices: List[HostModel]) -> InitNornir:
        defaults = self._get_defaults()
        try:
            InventoryPluginRegister.register("FlatDataInventory", FlatDataInventory)
        except ValueError:
            pass
        self.nr = InitNornir(
            runner={"plugin": "threaded", "options": {"num_workers": defaults["num_workers"]}},
            inventory={
                "plugin": "FlatDataInventory",
                "options": {"data": devices, "connection_options": defaults},
            },
            logging={"enabled": False},
        )
        return self.nr

    def get_nornir(self) -> InitNornir:
        if not self.nr:
            raise RuntimeError("Nornir 未初始化")
        return self.nr

    def close(self) -> None:
        if self.nr:
            self.nr.close_connections()
            self.nr = None
