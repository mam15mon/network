"""数据库模型定义"""

from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, JSON, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


Base = declarative_base()


class Device(Base):
    """设备表"""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    hostname = Column(String(255), nullable=False)
    site = Column(String(100), nullable=True, index=True)
    device_type = Column(String(50), nullable=True, index=True)
    platform = Column(String(50), nullable=False, default="cisco_ios")
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=True)
    password = Column(String(255), nullable=True)
    timeout = Column(Integer, default=30, nullable=True)

    # 设备分组
    group_name = Column(String(100), ForeignKey("device_groups.name"), nullable=True)
    group = relationship("DeviceGroup", back_populates="devices")

    # 扩展数据 (JSON 格式)
    data = Column(JSON, nullable=True, default=dict)

    # 连接选项 (JSON 格式)
    connection_options = Column(JSON, nullable=True, default=dict)

    # 状态和元数据
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    vendor = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    os_version = Column(String(100), nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_connected = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<Device(name='{self.name}', hostname='{self.hostname}', platform='{self.platform}')>"


class DeviceGroup(Base):
    """设备组表"""
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # 组级别配置
    username = Column(String(100), nullable=True)
    password = Column(String(255), nullable=True)
    platform = Column(String(50), nullable=True)
    port = Column(Integer, nullable=True)
    timeout = Column(Integer, nullable=True)

    # 扩展数据
    data = Column(JSON, nullable=True, default=dict)
    connection_options = Column(JSON, nullable=True, default=dict)

    # 关系
    devices = relationship("Device", back_populates="group")

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DeviceGroup(name='{self.name}')>"


class DeviceDefaults(Base):
    """设备默认配置表"""
    __tablename__ = "device_defaults"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="default", unique=True)

    # 默认连接参数
    username = Column(String(100), nullable=True)
    password = Column(String(255), nullable=True)
    platform = Column(String(50), nullable=True)
    port = Column(Integer, nullable=True)
    timeout = Column(Integer, nullable=True)

    # 默认数据
    data = Column(JSON, nullable=True, default=dict)
    connection_options = Column(JSON, nullable=True, default=dict)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=False)  # config, command, etc.

    # 任务状态
    status = Column(String(20), default="pending")  # pending, running, completed, failed

    # 目标设备
    targets = Column(JSON, nullable=False)  # 设备名称列表

    # 任务内容
    command = Column(Text, nullable=True)
    config = Column(Text, nullable=True)
    parameters = Column(JSON, nullable=True, default=dict)

    # 结果
    results = Column(JSON, nullable=True, default=dict)
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # 创建者
    created_by = Column(String(100), nullable=True)


class TaskLog(Base):
    """任务日志表"""
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    task = relationship("Task")

    device_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)  # success, failed, timeout

    # 详细结果
    result = Column(JSON, nullable=True, default=dict)
    raw_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 索引
    __table_args__ = (
        Index('idx_task_device', 'task_id', 'device_name'),
    )


class ConfigSnapshot(Base):
    """设备配置快照表（例如 running-config）"""

    __tablename__ = "config_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    device = relationship("Device")

    config_type = Column(String(20), nullable=False, default="running", index=True)
    content = Column(Text, nullable=False)
    content_sha256 = Column(String(64), nullable=True, index=True)

    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_by = Column(String(100), nullable=True)

    __table_args__ = (
        Index("idx_config_snapshot_device_time", "device_id", "collected_at"),
    )


class ConfigBackupSchedule(Base):
    """配置备份计划（interval 调度）"""

    __tablename__ = "config_backup_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False, index=True)

    # 计划内容
    devices = Column(JSON, nullable=False)  # 设备名称列表（string[]）
    interval_minutes = Column(Integer, nullable=False, default=60)
    command = Column(Text, nullable=True)
    timeout = Column(Integer, nullable=True)

    # 调度状态
    last_run_at = Column(DateTime(timezone=True), nullable=True, index=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_status = Column(String(20), nullable=True)
    last_error = Column(Text, nullable=True)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("idx_config_backup_schedule_enabled_next", "enabled", "next_run_at"),
    )


class ConfigBackupRun(Base):
    """配置备份运行记录（保存结果概要，便于排查）"""

    __tablename__ = "config_backup_runs"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("config_backup_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule = relationship("ConfigBackupSchedule")

    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="running", index=True)
    results = Column(JSON, nullable=True, default=dict)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_config_backup_run_schedule_time", "schedule_id", "started_at"),
    )


# 创建索引
Index('idx_device_active', Device.is_active)
Index('idx_device_hostname', Device.hostname)
Index('idx_device_site', Device.site)
Index('idx_device_type', Device.device_type)
Index('idx_task_status', Task.status)
Index('idx_task_created', Task.created_at)
