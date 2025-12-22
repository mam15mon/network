"""Host 相关 Pydantic 模型。"""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class HostBase(BaseModel):
    hostname: str
    platform: Optional[str] = "hp_comware"
    username: Optional[str] = None
    password: Optional[str] = None
    port: Optional[int] = 22
    site: Optional[str] = None
    device_type: Optional[str] = None
    device_model: Optional[str] = None
    address_pool: Optional[str] = None
    ppp_auth_mode: Optional[str] = None
    snmp_version: Optional[str] = "v2c"
    snmp_community: Optional[str] = None
    snmp_port: Optional[int] = 161


class HostCreate(HostBase):
    name: str


class HostUpdate(HostBase):
    name: Optional[str] = None


class HostOut(HostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class HostBatchCreate(BaseModel):
    hosts: List[HostCreate]


class HostBatchDelete(BaseModel):
    names: List[str]


class HostBatchEdit(BaseModel):
    names: List[str]
    data: HostUpdate


class AddressPoolSyncResult(BaseModel):
    processed: int
    updated: int
    unchanged: int
    missing_hosts: List[str]
    no_data: List[str]
    no_ppp: List[str]
    updated_address_pool: int
    updated_ppp: int
