"""SQLAlchemy ORM 模型定义。"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_required = Column(Boolean, default=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Host(Base):
    __tablename__ = "hosts"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    hostname = Column(String, nullable=False)
    platform = Column(String, nullable=False, default="hp_comware")
    username = Column(String)
    password = Column(String)
    port = Column(Integer, default=22)
    site = Column(String)
    device_type = Column(String)
    device_model = Column(String)
    address_pool = Column(String)
    ppp_auth_mode = Column(String)
    # Align to actual PG schema
    snmp_version = Column(String, default="v2c")
    snmp_community = Column(String)
    snmp_port = Column(Integer, default=161)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Defaults(Base):
    __tablename__ = "defaults"

    id = Column(Integer, primary_key=True)
    timeout = Column(Integer, default=60)
    global_delay_factor = Column(Float, default=2.0)
    fast_cli = Column(Boolean, default=False)
    read_timeout = Column(Integer, default=30)
    num_workers = Column(Integer, default=30)
    license_module_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class LicenseRecord(Base):
    __tablename__ = "license_records"

    id = Column(Integer, primary_key=True)
    host_name = Column(String, nullable=False)
    activation_info = Column(String, nullable=True)
    custom_identifier = Column(String, nullable=False, unique=True)
    did_filename = Column(String, nullable=True)
    did_file = Column(LargeBinary, nullable=True)
    ak_filename = Column(String, nullable=True)
    ak_file = Column(LargeBinary, nullable=True)
    license_sn = Column(String, nullable=True)
    license_key = Column(String, nullable=True)
    file_creation_time = Column(String, nullable=True)
    status = Column(String, default="未知")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class HostLicenseSnapshot(Base):
    __tablename__ = "host_license_snapshots"

    id = Column(Integer, primary_key=True)
    host_name = Column(String, nullable=False, unique=True)
    site = Column(String, nullable=True)
    license_payload = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class CommandLog(Base):
    __tablename__ = "command_logs"

    id = Column(Integer, primary_key=True)
    host_name = Column(String, nullable=False)
    site = Column(String, nullable=True)
    command = Column(Text, nullable=False)
    command_type = Column(String, nullable=False)
    result = Column(Text, nullable=True)
    success = Column(Boolean, default=True)
    exception = Column(Text, nullable=True)
    output_path = Column(String, nullable=True)
    executed_at = Column(DateTime, default=datetime.now)


class ConfigSnapshot(Base):
    __tablename__ = "config_snapshots"

    id = Column(Integer, primary_key=True)
    host_name = Column(String, nullable=False)
    site = Column(String, nullable=True)
    command = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(String, nullable=True)
    executed_at = Column(DateTime, default=datetime.now)
    command_log_id = Column(Integer, ForeignKey("command_logs.id"), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.now)


class SNMPMetric(Base):
    """SNMP 监控指标配置"""
    __tablename__ = "snmp_metrics"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)  # 指标名称，如 "CPU使用率"
    oid = Column(String, nullable=False)  # SNMP OID
    description = Column(Text, nullable=True)  # 指标描述
    value_type = Column(String, default="gauge")  # gauge, counter, string
    unit = Column(String, nullable=True)  # 单位，如 "%", "Mbps"
    value_parser = Column(String, nullable=True)  # 值解析器，如 "regex:.*= INTEGER: (\d+)"
    collector = Column(String, nullable=False, default="snmp")  # 当前仅支持 snmp
    collector_config = Column(Text, nullable=True)  # JSON 配置
    is_builtin = Column(Boolean, default=False)  # 是否内置指标
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SNMPMonitorTask(Base):
    """SNMP 监控任务"""
    __tablename__ = "snmp_monitor_tasks"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # 任务名称
    host_id = Column(Integer, ForeignKey("hosts.id"), nullable=False)
    metric_id = Column(Integer, ForeignKey("snmp_metrics.id"), nullable=False)
    interval = Column(Integer, default=300)  # 采集间隔（秒）
    enabled = Column(Boolean, default=True)  # 是否启用
    last_poll_at = Column(DateTime, nullable=True)  # 上次采集时间
    last_value = Column(String, nullable=True)  # 上次采集值
    last_status = Column(String, default="pending")  # pending, success, failed
    last_error = Column(Text, nullable=True)  # 上次错误信息
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SNMPDataPoint(Base):
    """SNMP 数据点"""
    __tablename__ = "snmp_data_points"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("snmp_monitor_tasks.id"), nullable=False)
    value = Column(String, nullable=False)  # 采集值
    raw_value = Column(Text, nullable=True)  # 原始返回值
    timestamp = Column(DateTime, default=datetime.now, index=True)


class SNMPAlert(Base):
    """SNMP 告警配置"""
    __tablename__ = "snmp_alerts"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("snmp_monitor_tasks.id"), nullable=False)
    condition = Column(String, nullable=False)  # gt, lt, eq, ne (greater than, less than, equal, not equal)
    threshold = Column(Float, nullable=False)  # 阈值
    severity = Column(String, default="warning")  # info, warning, critical
    enabled = Column(Boolean, default=True)
    message = Column(String, nullable=True)  # 自定义告警消息
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
