"""数据库管理模块（PostgreSQL-only）。"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urlencode

from dotenv import find_dotenv, set_key
from sqlalchemy import create_engine, func, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from core.base.singleton import SingletonBase
from core.db.models import (
    Base,
    Defaults,
    Host,
    LicenseRecord,
    HostLicenseSnapshot,
    CommandLog,
    ConfigSnapshot,
    User,
    SNMPMetric,
)
from services.address_pool import extract_ip_pool_cidr, extract_ppp_auth_mode
from services.snmp import SNMPService
from core.security.password import get_password_hash

logger = logging.getLogger(__name__)


class Database(SingletonBase):
    """数据库单例（仅支持 PostgreSQL，通过环境变量配置）。"""

    def _initialize(self) -> None:
        self.engine = None
        self.SessionLocal = None
        self.install_mode = False
        self._env_path = find_dotenv(usecwd=True) or str(
            Path(__file__).resolve().parents[2] / ".env"
        )
        if self._env_path and not Path(self._env_path).exists():
            Path(self._env_path).touch()

        # 强制使用环境变量提供的 PostgreSQL URL
        self._external_db_url: Optional[str] = (
            os.environ.get("NORNIR_VSR_DB_URL") or os.environ.get("DATABASE_URL")
        )
        if not self._external_db_url:
            self.install_mode = True
            logger.warning(
                "未检测到数据库连接配置，API 进入安装模式。"
            )
            return

        logger.info("使用外部数据库: %s", self._external_db_url)
        self._configure_engine(self._external_db_url)
        self.init_db()

    def _configure_engine(self, db_url: str) -> None:
        self.engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        self.SessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.install_mode = False
        self._external_db_url = db_url

    def get_session(self) -> Session:
        self._ensure_configured()
        return self.SessionLocal()

    def init_db(self) -> None:
        if self.install_mode:
            logger.info("安装模式下跳过数据库初始化")
            return
        self._ensure_configured()
        try:
            Base.metadata.create_all(self.engine)
            self._ensure_license_metadata_columns()
            self._ensure_user_totp_required_column()
            self._ensure_defaults_license_toggle_column()
            with self.get_session() as session:
                dirty = False
                if not session.query(Defaults).first():
                    session.add(Defaults())
                    dirty = True
                if self._ensure_super_admin(session):
                    dirty = True
                if self._ensure_snmp_builtin_metrics(session):
                    dirty = True
                if dirty:
                    session.commit()
            logger.info("数据库初始化完成")
        except SQLAlchemyError as exc:  # noqa: BLE001 - 精确日志
            logger.error("数据库初始化失败: %s", exc)
            raise
        except RuntimeError:
            # 已记录，向上抛出以便响应调用方
            raise

    def _ensure_configured(self) -> None:
        if self.install_mode or not self.engine or not self.SessionLocal:
            raise RuntimeError("数据库尚未配置，请先完成安装向导")

    def _ensure_super_admin(self, session: Session) -> bool:
        """Ensure default super admin exists."""
        admin_username = os.environ.get("SUPER_ADMIN_USERNAME", "admin")
        admin_password = os.environ.get("SUPER_ADMIN_PASSWORD", "network123")
        admin = session.query(User).filter(User.username == admin_username).first()
        if admin:
            updated = False
            if not admin.is_superuser:
                admin.is_superuser = True
                updated = True
            if not admin.is_active:
                admin.is_active = True
                updated = True
            return updated
        password_hash = get_password_hash(admin_password)
        admin = User(
            username=admin_username,
            password_hash=password_hash,
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        return True

    def _ensure_snmp_builtin_metrics(self, session: Session) -> bool:
        """Ensure built-in SNMP metrics exist and stay in sync."""
        try:
            builtin_metrics = SNMPService.get_builtin_metrics()
        except Exception as exc:  # noqa: BLE001
            logger.error("获取内置 SNMP 指标失败: %s", exc)
            return False

        dirty = False
        for metric_data in builtin_metrics:
            name = metric_data.get("name")
            if not name:
                continue

            metric = session.query(SNMPMetric).filter(SNMPMetric.name == name).first()
            if not metric:
                metric = SNMPMetric(
                    name=name,
                    oid=metric_data.get("oid", ""),
                    description=metric_data.get("description"),
                    value_type=metric_data.get("value_type", "gauge"),
                    unit=metric_data.get("unit"),
                    value_parser=metric_data.get("value_parser"),
                    is_builtin=True,
                )
                session.add(metric)
                dirty = True
                continue

            updated = False
            for field in ("oid", "description", "value_type", "unit", "value_parser"):
                if field in metric_data:
                    new_value = metric_data.get(field)
                    if getattr(metric, field) != new_value:
                        setattr(metric, field, new_value)
                        updated = True

            if not metric.is_builtin:
                metric.is_builtin = True
                updated = True

            if updated:
                dirty = True

        return dirty

    @staticmethod
    def build_connection_url(
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        database: str,
        ssl_mode: Optional[str] = None,
    ) -> str:
        auth_part = f"{quote_plus(username)}:{quote_plus(password)}"
        query_params: Dict[str, str] = {}
        if ssl_mode:
            query_params["sslmode"] = ssl_mode
        query_string = urlencode(query_params)
        base = f"postgresql+psycopg://{auth_part}@{host}:{port}/{database}"
        return f"{base}?{query_string}" if query_string else base

    @staticmethod
    def test_connection(db_url: str) -> None:
        temp_engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=1,
            max_overflow=0,
        )
        try:
            with temp_engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:  # noqa: BLE001
            logger.error("数据库连接测试失败: %s", exc)
            raise
        finally:
            temp_engine.dispose()

    def configure(self, db_url: str) -> None:
        """Persist database URL and initialize engine."""
        self.test_connection(db_url)
        self._configure_engine(db_url)
        self._persist_db_url(db_url)
        self.init_db()

    def _persist_db_url(self, db_url: str) -> None:
        """Persist database URL into environment and .env file."""
        os.environ["NORNIR_VSR_DB_URL"] = db_url
        if self._env_path:
            try:
                set_key(self._env_path, "NORNIR_VSR_DB_URL", db_url)
            except Exception as exc:  # noqa: BLE001
                logger.warning("写入 .env 文件失败: %s", exc)

    # Host 表操作
    def add_host(self, host_data: Dict[str, Any]) -> bool:
        try:
            with self.get_session() as session:
                host = Host(**host_data)
                session.add(host)
                session.commit()
            logger.info("添加设备 %s 成功", host_data.get("name"))
            return True
        except SQLAlchemyError as exc:
            logger.error("添加设备失败: %s", exc)
            return False

    def get_host(self, name: str) -> Optional[Host]:
        with self.get_session() as session:
            return session.query(Host).filter_by(name=name).first()

    def get_all_hosts(self) -> List[Host]:
        with self.get_session() as session:
            return session.query(Host).order_by(Host.name).all()

    def get_hosts_by_names(self, names: List[str]) -> List[Host]:
        if not names:
            return []
        with self.get_session() as session:
            return (
                session.query(Host)
                .filter(Host.name.in_(names))
                .order_by(Host.name)
                .all()
            )

    def update_host(self, name: str, host_data: Dict[str, Any]) -> bool:
        try:
            with self.get_session() as session:
                host = session.query(Host).filter_by(name=name).first()
                if not host:
                    return False
                for key, value in host_data.items():
                    setattr(host, key, value)
                session.commit()
            logger.info("更新设备 %s 成功", name)
            return True
        except SQLAlchemyError as exc:
            logger.error("更新设备失败: %s", exc)
            return False

    def delete_host(self, name: str) -> bool:
        try:
            with self.get_session() as session:
                host = session.query(Host).filter_by(name=name).first()
                if not host:
                    return False
                session.delete(host)
                session.commit()
            logger.info("删除设备 %s 成功", name)
            return True
        except SQLAlchemyError as exc:
            logger.error("删除设备失败: %s", exc)
            return False

    def batch_delete_hosts(self, names: List[str]) -> int:
        try:
            with self.get_session() as session:
                result = (
                    session.query(Host)
                    .filter(Host.name.in_(names))
                    .delete(synchronize_session=False)
                )
                session.commit()
                return int(result or 0)
        except SQLAlchemyError as exc:
            logger.error("批量删除设备失败: %s", exc)
            return 0

    def batch_add_or_update_hosts(self, host_data_list: List[Dict[str, Any]]) -> Tuple[int, int]:
        session = self.get_session()
        try:
            with session:
                existing = (
                    session.query(Host)
                    .filter(Host.name.in_([data["name"] for data in host_data_list]))
                    .all()
                )
                existing_map = {host.name: host for host in existing}

                to_insert = []
                for data in host_data_list:
                    name = data["name"]
                    if name in existing_map:
                        host = existing_map[name]
                        for key, value in data.items():
                            setattr(host, key, value)
                    else:
                        to_insert.append(data)

                if to_insert:
                    session.bulk_insert_mappings(Host, to_insert)

                session.commit()
                updated = len(host_data_list) - len(to_insert)
                return len(to_insert), updated
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("批量处理设备失败: %s", exc)
            return 0, 0
        finally:
            session.close()

    def batch_edit_devices(self, device_names: List[str], edited_fields: Dict[str, Any]) -> int:
        try:
            with self.get_session() as session:
                result = (
                    session.query(Host)
                    .filter(Host.name.in_(device_names))
                    .update(edited_fields, synchronize_session=False)
                )
                session.commit()
                logger.info("批量更新设备 %s 个", result)
                return int(result or 0)
        except SQLAlchemyError as exc:
            logger.error("批量更新设备失败: %s", exc)
            return 0

    def sync_hosts_address_pool(self) -> Dict[str, Any]:
        """Populate host address_pool fields using latest configuration snapshots."""

        snapshots = self.list_latest_config_snapshots(limit=None)
        if not snapshots:
            return {
                "processed": 0,
                "updated": 0,
                "unchanged": 0,
                "missing_hosts": [],
                "no_data": [],
                "no_ppp": [],
                "updated_address_pool": 0,
                "updated_ppp": 0,
            }

        parsed_cidr: Dict[str, str] = {}
        parsed_ppp: Dict[str, str] = {}
        no_cidr: List[str] = []
        no_ppp: List[str] = []
        for snapshot in snapshots:
            content = snapshot.content or ""
            cidr = extract_ip_pool_cidr(content, pool_name="1")
            if cidr:
                parsed_cidr[snapshot.host_name] = cidr
            else:
                no_cidr.append(snapshot.host_name)

            ppp_mode = extract_ppp_auth_mode(content)
            if ppp_mode:
                parsed_ppp[snapshot.host_name] = ppp_mode
            else:
                no_ppp.append(snapshot.host_name)

        processed_hosts = set(parsed_cidr.keys()) | set(parsed_ppp.keys())

        if not processed_hosts:
            return {
                "processed": len(snapshots),
                "updated": 0,
                "unchanged": 0,
                "missing_hosts": [],
                "no_data": sorted(set(no_cidr)),
                "no_ppp": sorted(set(no_ppp)),
                "updated_address_pool": 0,
                "updated_ppp": 0,
            }

        missing_hosts: List[str] = []
        updated = 0
        updated_address_pool = 0
        updated_ppp = 0

        host_map: Dict[str, Host] = {}

        with self.get_session() as session:
            host_names_sorted = sorted(processed_hosts)
            chunk_hosts = (
                session.query(Host)
                .filter(Host.name.in_(host_names_sorted))
                .all()
            )
            for host in chunk_hosts:
                host_map[host.name] = host

            for host_name in processed_hosts:
                host = host_map.get(host_name)
                if not host:
                    missing_hosts.append(host_name)
                    continue

                changed = False
                cidr_value = parsed_cidr.get(host_name)
                if cidr_value and (host.address_pool or "").strip() != cidr_value:
                    host.address_pool = cidr_value
                    updated_address_pool += 1
                    changed = True

                ppp_value = parsed_ppp.get(host_name)
                if ppp_value and (host.ppp_auth_mode or "").strip() != ppp_value:
                    host.ppp_auth_mode = ppp_value
                    updated_ppp += 1
                    changed = True

                if changed:
                    updated += 1

            session.commit()

        return {
            "processed": len(processed_hosts),
            "updated": updated,
            "unchanged": len(processed_hosts) - updated,
            "missing_hosts": sorted(set(missing_hosts)),
            "no_data": sorted(set(no_cidr)),
            "no_ppp": sorted(set(no_ppp)),
            "updated_address_pool": updated_address_pool,
            "updated_ppp": updated_ppp,
        }

    # 巡检相关数据库操作已移除

    # LicenseRecord 表操作
    def get_license_record_by_identifier(self, identifier: str) -> Optional[LicenseRecord]:
        with self.get_session() as session:
            return (
                session.query(LicenseRecord)
                .filter(LicenseRecord.custom_identifier == identifier)
                .first()
            )

    def get_license_record_by_host(self, host_name: str) -> Optional[LicenseRecord]:
        with self.get_session() as session:
            return (
                session.query(LicenseRecord)
                .filter(LicenseRecord.host_name == host_name)
                .first()
            )

    def get_license_record(self, record_id: int) -> Optional[LicenseRecord]:
        with self.get_session() as session:
            return session.get(LicenseRecord, record_id)

    def upsert_license_record(
        self,
        *,
        host_name: str,
        custom_identifier: str,
        activation_info: Optional[str] = None,
        did_filename: Optional[str] = None,
        did_file: Optional[bytes] = None,
        ak_filename: Optional[str] = None,
        ak_file: Optional[bytes] = None,
        license_sn: Optional[str] = None,
        license_key: Optional[str] = None,
        file_creation_time: Optional[str] = None,
        status: Optional[str] = None,
    ) -> LicenseRecord:
        session = self.get_session()
        try:
            with session:
                record = (
                    session.query(LicenseRecord)
                    .filter(LicenseRecord.custom_identifier == custom_identifier)
                    .first()
                )

                if not record:
                    record = LicenseRecord(
                        host_name=host_name,
                        custom_identifier=custom_identifier,
                    )
                    session.add(record)

                record.host_name = host_name
                if activation_info is not None:
                    record.activation_info = activation_info
                if did_filename is not None:
                    record.did_filename = did_filename
                if did_file is not None:
                    record.did_file = did_file
                if ak_filename is not None:
                    record.ak_filename = ak_filename
                if ak_file is not None:
                    record.ak_file = ak_file
                if license_sn is not None:
                    record.license_sn = license_sn
                if license_key is not None:
                    record.license_key = license_key
                if file_creation_time is not None:
                    record.file_creation_time = file_creation_time
                if status is not None:
                    record.status = status

                session.commit()
                session.refresh(record)
                return record
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("更新许可证记录失败: %s", exc)
            raise
        finally:
            session.close()

    def list_license_records(self) -> List[LicenseRecord]:
        with self.get_session() as session:
            return (
                session.query(LicenseRecord)
                .order_by(LicenseRecord.updated_at.desc())
                .all()
            )

    def _ensure_license_metadata_columns(self) -> None:
        """Ensure new license metadata columns exist for backward compatibility."""
        inspector = inspect(self.engine)
        try:
            columns = {column["name"] for column in inspector.get_columns("license_records")}
        except SQLAlchemyError as exc:  # noqa: BLE001
            logger.warning("无法获取 license_records 列信息: %s", exc)
            return

        column_definitions = {
            "license_sn": "VARCHAR",
            "license_key": "VARCHAR",
            "file_creation_time": "VARCHAR",
        }

        missing = [col for col in column_definitions if col not in columns]
        if not missing:
            return

        with self.engine.connect() as connection:
            for column in missing:
                ddl = column_definitions[column]
                try:
                    connection.execute(text(f"ALTER TABLE license_records ADD COLUMN {column} {ddl}"))
                except SQLAlchemyError as exc:  # noqa: BLE001
                    logger.warning("添加列 %s 失败: %s", column, exc)
            connection.commit()

    def _ensure_user_totp_required_column(self) -> None:
        """Ensure totp_required column exists on users table for enforced MFA."""
        if not self.engine:
            return
        inspector = inspect(self.engine)
        try:
            columns = {column["name"] for column in inspector.get_columns("users")}
        except SQLAlchemyError as exc:  # noqa: BLE001
            logger.warning("无法获取 users 列信息: %s", exc)
            return

        if "totp_required" in columns:
            return

        with self.engine.connect() as connection:
            try:
                connection.execute(text("ALTER TABLE users ADD COLUMN totp_required BOOLEAN DEFAULT FALSE"))
            except SQLAlchemyError as exc:  # noqa: BLE001
                logger.warning("添加列 totp_required 失败: %s", exc)
            connection.commit()

    def _ensure_defaults_license_toggle_column(self) -> None:
        """Ensure defaults table has license module toggle column."""
        if not self.engine:
            return
        inspector = inspect(self.engine)
        try:
            columns = {column["name"] for column in inspector.get_columns("defaults")}
        except SQLAlchemyError as exc:  # noqa: BLE001
            logger.warning("无法获取 defaults 列信息: %s", exc)
            return

        if "license_module_enabled" in columns:
            return

        with self.engine.connect() as connection:
            try:
                connection.execute(
                    text("ALTER TABLE defaults ADD COLUMN license_module_enabled BOOLEAN DEFAULT TRUE")
                )
            except SQLAlchemyError as exc:  # noqa: BLE001
                logger.warning("添加列 license_module_enabled 失败: %s", exc)
            connection.commit()

    # HostLicenseSnapshot 表操作
    def upsert_license_snapshot(self, host_name: str, site: Optional[str], payload: str) -> None:
        session = self.get_session()
        try:
            with session:
                snapshot = (
                    session.query(HostLicenseSnapshot)
                    .filter(HostLicenseSnapshot.host_name == host_name)
                    .first()
                )
                if not snapshot:
                    snapshot = HostLicenseSnapshot(host_name=host_name)
                    session.add(snapshot)

                snapshot.site = site
                snapshot.license_payload = payload
                snapshot.updated_at = datetime.now()

                session.commit()
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("更新许可证状态快照失败: %s", exc)
            raise
        finally:
            session.close()

    def list_license_snapshots(
        self,
        hosts: Optional[List[str]] = None,
        site: Optional[str] = None,
    ) -> List[HostLicenseSnapshot]:
        with self.get_session() as session:
            query = session.query(HostLicenseSnapshot)
            if hosts:
                query = query.filter(HostLicenseSnapshot.host_name.in_(hosts))
            if site:
                query = query.filter(HostLicenseSnapshot.site == site)
            return query.order_by(HostLicenseSnapshot.host_name).all()

    # CommandLog 表操作
    def add_command_log(
        self,
        *,
        host_name: str,
        site: Optional[str],
        command: str,
        command_type: str,
        result: Optional[str],
        success: bool,
        exception: Optional[str],
        output_path: Optional[str],
        executed_at: Optional[datetime] = None,
    ) -> CommandLog:
        session = self.get_session()
        try:
            with session:
                log = CommandLog(
                    host_name=host_name,
                    site=site,
                    command=command,
                    command_type=command_type,
                    result=result,
                    success=success,
                    exception=exception,
                    output_path=output_path,
                    executed_at=executed_at or datetime.now(),
                )
                session.add(log)
                session.commit()
                session.refresh(log)
                return log
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("记录命令执行日志失败: %s", exc)
            raise
        finally:
            session.close()

    def list_command_logs(
        self,
        *,
        host: Optional[str] = None,
        command_type: Optional[str] = None,
        exclude_command_types: Optional[List[str]] = None,
        limit: Optional[int] = 50,
    ) -> List[CommandLog]:
        with self.get_session() as session:
            query = session.query(CommandLog)
            if host:
                query = query.filter(CommandLog.host_name == host)
            if command_type:
                query = query.filter(CommandLog.command_type == command_type)
            if exclude_command_types:
                query = query.filter(~CommandLog.command_type.in_(exclude_command_types))
            query = query.order_by(CommandLog.executed_at.desc())
            if limit:
                query = query.limit(limit)
            return query.all()

    def delete_command_log(self, log_id: int) -> bool:
        session = self.get_session()
        try:
            with session:
                log = session.query(CommandLog).filter(CommandLog.id == log_id).first()
                if not log:
                    return False
                snapshots = (
                    session.query(ConfigSnapshot)
                    .filter(ConfigSnapshot.command_log_id == log_id)
                    .all()
                )
                for snapshot in snapshots:
                    if snapshot.file_path:
                        try:
                            path = Path(snapshot.file_path)
                            if path.exists():
                                path.unlink()
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("删除配置文件失败: %s", exc)
                    session.delete(snapshot)

                if snapshots:
                    session.flush()

                if log.output_path:
                    try:
                        path = Path(log.output_path)
                        if path.exists():
                            path.unlink()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("删除命令输出文件失败: %s", exc)
                session.delete(log)
                session.commit()
                return True
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("删除命令执行日志失败: %s", exc)
            raise
        finally:
            session.close()

    def get_defaults(self) -> Dict[str, Any]:
        with self.get_session() as session:
            defaults = session.query(Defaults).first()
            if not defaults:
                defaults = Defaults()
                session.add(defaults)
                session.commit()
            return {
                "timeout": defaults.timeout,
                "global_delay_factor": defaults.global_delay_factor,
                "fast_cli": defaults.fast_cli,
                "read_timeout": defaults.read_timeout,
                "num_workers": defaults.num_workers,
            }

    # ConfigSnapshot 表操作
    def add_config_snapshot(
        self,
        *,
        host_name: str,
        site: Optional[str],
        command: str,
        content: str,
        file_path: Optional[str],
        executed_at: datetime,
        command_log_id: Optional[int] = None,
    ) -> ConfigSnapshot:
        session = self.get_session()
        try:
            with session:
                snapshot = ConfigSnapshot(
                    host_name=host_name,
                    site=site,
                    command=command,
                    content=content,
                    file_path=file_path,
                    executed_at=executed_at,
                    command_log_id=command_log_id,
                )
                session.add(snapshot)
                session.commit()
                session.refresh(snapshot)
                return snapshot
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("记录配置快照失败: %s", exc)
            raise
        finally:
            session.close()

    def get_config_snapshot(self, snapshot_id: int) -> Optional[ConfigSnapshot]:
        with self.get_session() as session:
            return (
                session.query(ConfigSnapshot)
                .filter(ConfigSnapshot.id == snapshot_id)
                .first()
            )

    def get_config_snapshot_by_log(self, command_log_id: int) -> Optional[ConfigSnapshot]:
        with self.get_session() as session:
            return (
                session.query(ConfigSnapshot)
                .filter(ConfigSnapshot.command_log_id == command_log_id)
                .first()
            )

    def list_config_snapshots(
        self,
        *,
        host: Optional[str] = None,
        site: Optional[str] = None,
        limit: Optional[int] = 50,
    ) -> List[ConfigSnapshot]:
        with self.get_session() as session:
            query = session.query(ConfigSnapshot)
            if host:
                query = query.filter(ConfigSnapshot.host_name == host)
            if site:
                query = query.filter(ConfigSnapshot.site == site)
            query = query.order_by(ConfigSnapshot.executed_at.desc())
            if limit:
                query = query.limit(limit)
            return query.all()

    def delete_config_snapshot(self, snapshot_id: int) -> bool:
        session = self.get_session()
        try:
            with session:
                snapshot = (
                    session.query(ConfigSnapshot)
                    .filter(ConfigSnapshot.id == snapshot_id)
                    .first()
                )
                if not snapshot:
                    return False
                if snapshot.file_path:
                    try:
                        path = Path(snapshot.file_path)
                        if path.exists():
                            path.unlink()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("删除配置文件失败: %s", exc)
                session.delete(snapshot)
                session.commit()
                return True
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("删除配置快照失败: %s", exc)
            raise
        finally:
            session.close()

    def batch_delete_config_snapshots(self, snapshot_ids: List[int]) -> int:
        if not snapshot_ids:
            return 0
        session = self.get_session()
        try:
            with session:
                snapshots = (
                    session.query(ConfigSnapshot)
                    .filter(ConfigSnapshot.id.in_(snapshot_ids))
                    .all()
                )
                for snapshot in snapshots:
                    if snapshot.file_path:
                        try:
                            path = Path(snapshot.file_path)
                            if path.exists():
                                path.unlink()
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("删除配置文件失败: %s", exc)

                result = (
                    session.query(ConfigSnapshot)
                    .filter(ConfigSnapshot.id.in_(snapshot_ids))
                    .delete(synchronize_session=False)
                )
                session.commit()
                return int(result or 0)
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("批量删除配置快照失败: %s", exc)
            raise
        finally:
            session.close()

    def list_latest_config_snapshots(
        self,
        *,
        host: Optional[str] = None,
        site: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[ConfigSnapshot]:
        with self.get_session() as session:
            row_number = func.row_number().over(
                partition_by=ConfigSnapshot.host_name,
                order_by=ConfigSnapshot.executed_at.desc(),
            ).label("rn")

            subquery = session.query(
                ConfigSnapshot.id.label("id"),
                row_number,
            )
            if host:
                subquery = subquery.filter(ConfigSnapshot.host_name == host)
            if site:
                subquery = subquery.filter(ConfigSnapshot.site == site)

            subquery = subquery.subquery()

            query = (
                session.query(ConfigSnapshot)
                .join(subquery, ConfigSnapshot.id == subquery.c.id)
                .filter(subquery.c.rn == 1)
                .order_by(ConfigSnapshot.executed_at.desc())
            )
            if limit:
                query = query.limit(limit)
            return query.all()

    def update_defaults(self, defaults_data: Dict[str, Any]) -> bool:
        try:
            with self.get_session() as session:
                defaults = session.query(Defaults).first()
                if not defaults:
                    defaults = Defaults()
                    session.add(defaults)
                for key, value in defaults_data.items():
                    setattr(defaults, key, value)
                session.commit()
            logger.info("更新默认配置成功")
            return True
        except SQLAlchemyError as exc:
            logger.error("更新默认配置失败: %s", exc)
            return False

    def ensure_initialized(self) -> None:
        try:
            with self.get_session() as session:
                if not session.query(Defaults).first():
                    session.add(Defaults())
                    session.commit()
        except SQLAlchemyError as exc:
            logger.error("数据库初始化检查失败: %s", exc)
