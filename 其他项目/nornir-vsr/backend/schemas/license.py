"""VSR 许可证管理相关模型。"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class LicenseInfo(BaseModel):
    """许可证信息"""
    file_name: str
    license_type: str
    current_state: str
    time_left_days: Optional[int] = None
    trial_time_left_days: Optional[int] = None


class HostLicenseInfo(BaseModel):
    """主机许可证信息"""
    host_name: str
    licenses: List[LicenseInfo]


class LicenseUploadResult(BaseModel):
    """许可证上传结果"""
    host_name: str
    upload_status: str
    install_status: str
    trial_days: Optional[str] = None


class LicenseCheckRequest(BaseModel):
    """许可证检查请求"""
    hosts: Optional[List[str]] = None
    site: Optional[str] = None


class EnableSFTPRequest(BaseModel):
    """启用SFTP请求"""
    hosts: Optional[List[str]] = None
    site: Optional[str] = None


class DidCollectionResult(BaseModel):
    """DID 文件收集结果"""
    host_name: str
    status: str
    did_filename: Optional[str] = None
    message: Optional[str] = None


class LicenseRecordBase(BaseModel):
    """许可证记录基础信息"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    host_name: str
    activation_info: Optional[str] = None
    custom_identifier: str
    did_filename: Optional[str] = None
    ak_filename: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    updated_at: Optional[datetime] = None
    license_sn: Optional[str] = None
    license_key: Optional[str] = None
    file_creation_time: Optional[str] = None


class LicenseRecordList(BaseModel):
    """许可证记录列表响应"""
    records: List[LicenseRecordBase]


class LicenseSnapshot(BaseModel):
    """主机许可证快照"""
    host_name: str
    site: Optional[str] = None
    licenses: List[LicenseInfo]
    updated_at: Optional[datetime] = None


class LicenseSnapshotList(BaseModel):
    """许可证快照列表响应"""
    snapshots: List[LicenseSnapshot]


class LicenseOverview(BaseModel):
    """聚合后的许可证概览"""
    host_name: str
    site: Optional[str] = None
    licenses: List[LicenseInfo]
    updated_at: Optional[datetime] = None
    snapshot_updated_at: Optional[datetime] = None
    latest_record: Optional[LicenseRecordBase] = None


class LicenseOverviewList(BaseModel):
    """许可证概览列表响应"""
    items: List[LicenseOverview]


class LicenseSnapshotRefreshSummary(BaseModel):
    """刷新操作摘要"""
    requested_hosts: List[str]
    processed: int
    success: int
    failed: List[str]


class LicenseSnapshotRefreshResponse(BaseModel):
    """刷新结果响应"""
    snapshots: List[LicenseSnapshot]
    summary: LicenseSnapshotRefreshSummary
