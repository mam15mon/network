"""SNMP 相关的 Pydantic schemas。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# SNMPMetric schemas
class SNMPMetricBase(BaseModel):
    name: str = Field(..., description="指标名称")
    oid: str = Field(..., description="SNMP OID")
    description: Optional[str] = Field(None, description="指标描述")
    value_type: str = Field("gauge", description="值类型: gauge, counter, string")
    unit: Optional[str] = Field(None, description="单位")
    value_parser: Optional[str] = Field(None, description="值解析器")
    collector: str = Field("snmp", description="采集方式（当前仅支持 snmp）")
    collector_config: Optional[str] = Field(None, description="采集配置(JSON)")


class SNMPMetricCreate(SNMPMetricBase):
    pass


class SNMPMetricUpdate(BaseModel):
    name: Optional[str] = None
    oid: Optional[str] = None
    description: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    value_parser: Optional[str] = None
    collector: Optional[str] = None
    collector_config: Optional[str] = None


class SNMPMetricResponse(SNMPMetricBase):
    id: int
    is_builtin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# SNMPMonitorTask schemas
class SNMPMonitorTaskBase(BaseModel):
    name: str = Field(..., description="任务名称")
    host_id: int = Field(..., description="主机ID")
    metric_id: int = Field(..., description="指标ID")
    interval: int = Field(300, description="采集间隔（秒）")
    enabled: bool = Field(True, description="是否启用")


class SNMPMonitorTaskCreate(SNMPMonitorTaskBase):
    pass


class SNMPMonitorTaskUpdate(BaseModel):
    name: Optional[str] = None
    interval: Optional[int] = None
    enabled: Optional[bool] = None


class SNMPMonitorTaskResponse(SNMPMonitorTaskBase):
    id: int
    last_poll_at: Optional[datetime]
    last_value: Optional[str]
    last_status: str
    last_error: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# SNMPDataPoint schemas
class SNMPDataPointResponse(BaseModel):
    id: int
    task_id: int
    value: str
    raw_value: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


# SNMPAlert schemas
class SNMPAlertBase(BaseModel):
    task_id: int = Field(..., description="监控任务ID")
    condition: str = Field(..., description="条件: gt, lt, eq, ne")
    threshold: float = Field(..., description="阈值")
    severity: str = Field("warning", description="严重级别: info, warning, critical")
    enabled: bool = Field(True, description="是否启用")
    message: Optional[str] = Field(None, description="自定义告警消息")


class SNMPAlertCreate(SNMPAlertBase):
    pass


class SNMPAlertUpdate(BaseModel):
    condition: Optional[str] = None
    threshold: Optional[float] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    message: Optional[str] = None


class SNMPAlertResponse(SNMPAlertBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# OID 测试相关
class SNMPTestRequest(BaseModel):
    host_id: int = Field(..., description="主机ID")
    oid: str = Field(..., description="SNMP OID")
    snmp_version: Optional[str] = Field(None, description="SNMP版本，不传则使用主机配置")
    snmp_community: Optional[str] = Field(None, description="团体字，不传则使用主机配置")


class SNMPTestResponse(BaseModel):
    success: bool
    raw_output: Optional[str] = None
    parsed_values: Optional[list] = None
    error: Optional[str] = None


# 批量创建监控任务
class SNMPBatchTaskCreate(BaseModel):
    host_ids: list[int] = Field(..., description="主机ID列表")
    metric_ids: list[int] = Field(..., description="指标ID列表")
    interval: int = Field(300, description="采集间隔（秒）")
    enabled: bool = Field(True, description="是否启用")


class SNMPBatchTaskDelete(BaseModel):
    task_ids: list[int] = Field(..., min_length=1, description="任务ID列表")


# 监控任务详情（包含关联数据）
class SNMPMonitorTaskDetail(SNMPMonitorTaskResponse):
    host_name: Optional[str] = None
    host_hostname: Optional[str] = None
    host_site: Optional[str] = None
    metric_name: Optional[str] = None
    metric_oid: Optional[str] = None
    metric_unit: Optional[str] = None
    alerts: list[SNMPAlertResponse] = []


class SNMPHistoryCleanupRequest(BaseModel):
    days: int = Field(90, ge=0, description="保留多少天内的数据")
    delete_all: bool = Field(False, description="是否立刻清空所有历史数据")


class SNMPHistoryCleanupResponse(BaseModel):
    deleted: int


# 监控统计
class SNMPMonitorStats(BaseModel):
    total_tasks: int
    active_tasks: int
    failed_tasks: int
    total_hosts: int
    total_metrics: int
