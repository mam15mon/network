"""Nornir 任务相关模型。"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CommandType(str, Enum):
    DISPLAY = "display"
    CONFIG = "config"
    CONNECTIVITY = "connectivity"
    MULTILINE = "multiline"
    CONFIG_DOWNLOAD = "config_download"


class NornirCommandRequest(BaseModel):
    hosts: Optional[List[str]] = None
    command_type: CommandType = Field(alias="commandType")
    command: Optional[str] = None
    commands: Optional[List[str]] = None
    use_timing: bool = Field(default=False, alias="useTiming")

    @model_validator(mode="after")
    def validate_payload(self) -> "NornirCommandRequest":
        if self.command_type in {CommandType.DISPLAY, CommandType.CONNECTIVITY}:
            if not self.command or not self.command.strip():
                raise ValueError("command is required for the selected command type")
            self.command = self.command.strip()

        if self.command_type in {CommandType.CONFIG, CommandType.MULTILINE}:
            commands: List[str] = []
            if self.commands:
                commands = [cmd.strip() for cmd in self.commands if cmd.strip()]
            elif self.command:
                commands = [line.strip() for line in self.command.splitlines() if line.strip()]

            if not commands:
                raise ValueError("commands are required for the selected command type")

            self.commands = commands

        if self.command_type == CommandType.CONFIG_DOWNLOAD:
            # 固定使用 display current-configuration
            self.command = "display current-configuration"

        return self


class NornirCommandResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    host: str
    log_id: Optional[int] = Field(default=None, alias="logId")
    snapshot_id: Optional[int] = Field(default=None, alias="snapshotId")
    command_type: CommandType = Field(alias="commandType")
    command: str
    result: str
    failed: bool
    exception: Optional[str] = None
    executed_at: datetime = Field(alias="executedAt")
    output_path: Optional[str] = Field(default=None, alias="outputPath")


class CommandLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    host_name: str
    site: Optional[str] = None
    command: str
    command_type: CommandType
    result: Optional[str] = None
    success: bool
    exception: Optional[str] = None
    output_path: Optional[str] = None
    executed_at: datetime


class ConfigSnapshotSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    host: str
    site: Optional[str] = None
    command: str
    executed_at: datetime = Field(alias="executedAt")
    file_path: Optional[str] = Field(default=None, alias="filePath")


class ConfigSnapshotDetail(ConfigSnapshotSummary):
    content: str
