from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models.database import ConfigSnapshot, Device
from app.services.nornir import NornirManager


@dataclass(frozen=True)
class SnapshotMeta:
    id: int
    device_name: str
    config_type: str
    bytes: int
    sha256: Optional[str]
    collected_at: datetime
    created_by: Optional[str]


async def save_running_config_snapshots(
    db: AsyncSession,
    nornir_manager: NornirManager,
    *,
    device_names: List[str],
    command: Optional[str],
    timeout: Optional[int],
    created_by: Optional[str],
) -> Dict[str, Any]:
    if not device_names:
        raise ValueError("devices 不能为空")

    rows = (
        await db.execute(select(Device.id, Device.name).where(Device.name.in_(device_names)))
    ).all()
    by_name = {name: device_id for device_id, name in rows}
    by_id = {device_id: name for device_id, name in rows}
    missing = [n for n in device_names if n not in by_name]

    results: Dict[str, Any] = {}
    for n in missing:
        results[n] = {"status": "failed", "failed": True, "exception": "设备不存在（DB）"}

    existing_names = [n for n in device_names if n in by_name]
    if not existing_names:
        return results

    fetch_results = await nornir_manager.get_running_config(existing_names, command=command, timeout=timeout)

    snapshots: List[ConfigSnapshot] = []
    for name in existing_names:
        r = fetch_results.get(name) or {}
        failed = bool(r.get("failed"))
        if failed:
            results[name] = {
                "status": "failed",
                "failed": True,
                "exception": r.get("exception") or "采集失败",
            }
            continue

        content = r.get("result")
        if not isinstance(content, str) or not content.strip():
            results[name] = {
                "status": "failed",
                "failed": True,
                "exception": "未获取到 running-config（空输出）",
            }
            continue

        sha256 = hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest()
        snapshots.append(
            ConfigSnapshot(
                device_id=by_name[name],
                config_type="running",
                content=content,
                content_sha256=sha256,
                created_by=created_by,
            )
        )
        results[name] = {
            "status": "success",
            "failed": False,
            "bytes": len(content.encode("utf-8", errors="ignore")),
            "sha256": sha256,
        }

    if snapshots:
        db.add_all(snapshots)
        await db.commit()
        # 回填 snapshot_id（commit 后 id 才可用）
        for snap in snapshots:
            device_name = by_id.get(snap.device_id)
            if device_name and results.get(device_name) and results[device_name].get("status") == "success":
                results[device_name]["snapshot_id"] = snap.id
                results[device_name]["collected_at"] = snap.collected_at.isoformat() if snap.collected_at else None

    return results


async def list_snapshots(
    db: AsyncSession,
    *,
    device_name: Optional[str],
    limit: int,
    offset: int,
) -> List[SnapshotMeta]:
    stmt = (
        select(
            ConfigSnapshot.id,
            Device.name,
            ConfigSnapshot.config_type,
            ConfigSnapshot.content_sha256,
            ConfigSnapshot.collected_at,
            ConfigSnapshot.created_by,
            func.octet_length(ConfigSnapshot.content),
        )
        .join(Device, Device.id == ConfigSnapshot.device_id)
        .order_by(desc(ConfigSnapshot.collected_at), desc(ConfigSnapshot.id))
        .limit(limit)
        .offset(offset)
    )
    if device_name:
        stmt = stmt.where(Device.name == device_name)

    rows = (await db.execute(stmt)).all()
    items: List[SnapshotMeta] = []
    for sid, name, ctype, sha, collected_at, created_by, content in rows:
        size = int(content or 0)
        items.append(
            SnapshotMeta(
                id=sid,
                device_name=name,
                config_type=ctype,
                bytes=size,
                sha256=sha,
                collected_at=collected_at,
                created_by=created_by,
            )
        )
    return items


async def get_snapshot(db: AsyncSession, snapshot_id: int) -> Optional[Dict[str, Any]]:
    stmt = (
        select(
            ConfigSnapshot.id,
            Device.name,
            ConfigSnapshot.config_type,
            ConfigSnapshot.content,
            ConfigSnapshot.content_sha256,
            ConfigSnapshot.collected_at,
            ConfigSnapshot.created_by,
        )
        .join(Device, Device.id == ConfigSnapshot.device_id)
        .where(ConfigSnapshot.id == snapshot_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        return None
    sid, device_name, ctype, content, sha, collected_at, created_by = row
    return {
        "id": sid,
        "device_name": device_name,
        "config_type": ctype,
        "content": content,
        "sha256": sha,
        "bytes": len((content or "").encode("utf-8", errors="ignore")),
        "collected_at": collected_at,
        "created_by": created_by,
    }
