"""Defaults 配置模型。"""
from pydantic import BaseModel


class DefaultsUpdate(BaseModel):
    timeout: int
    global_delay_factor: float
    fast_cli: bool
    read_timeout: int
    num_workers: int
    license_module_enabled: bool


class DefaultsOut(DefaultsUpdate):
    pass
