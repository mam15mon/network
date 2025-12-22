"""库存业务逻辑（DB CRUD + 批量操作）。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Device, DeviceGroup


def _derive_vendor(platform: Optional[str]) -> Optional[str]:
    if not platform:
        return None
    p = platform.lower()
    if "huawei" in p:
        return "Huawei"
    if "h3c" in p or "comware" in p:
        return "H3C"
    if "cisco" in p or p in {"nxos", "nexus"}:
        return "Cisco"
    if "juniper" in p or "junos" in p:
        return "Juniper"
    if "fortinet" in p:
        return "Fortinet"
    return None


def _device_to_dict(device: Device) -> Dict[str, Any]:
    return {
        "id": device.id,
        "name": device.name,
        "hostname": device.hostname,
        "site": device.site,
        "device_type": device.device_type,
        "platform": device.platform,
        "port": device.port or 22,
        "username": device.username,
        "timeout": device.timeout,
        "group_name": device.group_name,
        "data": device.data,
        "connection_options": device.connection_options,
        "vendor": device.vendor,
        "model": device.model,
        "os_version": device.os_version,
        "description": device.description,
        "is_active": device.is_active,
        "created_at": device.created_at,
        "updated_at": device.updated_at,
        "last_connected": device.last_connected,
    }


async def _ensure_groups_exist(db: AsyncSession, group_names: set[str]) -> None:
    normalized = {g.strip() for g in group_names if g and g.strip()}
    if not normalized:
        return

    existing_rows = (
        await db.execute(select(DeviceGroup.name).where(DeviceGroup.name.in_(sorted(normalized))))
    ).all()
    existing = {row[0] for row in existing_rows}
    missing = normalized - existing
    if not missing:
        return

    for name in sorted(missing):
        db.add(DeviceGroup(name=name, data={}, connection_options={}))
    await db.flush()


async def list_devices(
    db: AsyncSession,
    *,
    group: Optional[str] = None,
    site: Optional[str] = None,
    device_type: Optional[str] = None,
    platform: Optional[str] = None,
    vendor: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    query = select(Device)

    if group:
        query = query.where(Device.group_name == group)
    if site:
        query = query.where(Device.site == site)
    if device_type:
        query = query.where(Device.device_type == device_type)
    if platform:
        query = query.where(Device.platform == platform)
    if vendor:
        query = query.where(Device.vendor == vendor)
    if is_active is not None:
        query = query.where(Device.is_active == is_active)
    if search:
        like = f"%{search}%"
        query = query.where(or_(Device.name.ilike(like), Device.hostname.ilike(like)))

    query = query.order_by(Device.name).limit(limit).offset(offset)
    rows = (await db.execute(query)).scalars().all()
    return [_device_to_dict(row) for row in rows]


async def create_device(db: AsyncSession, *, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = payload["name"]
    exists = await db.scalar(select(Device).where(Device.name == name))
    if exists:
        raise HTTPException(status_code=409, detail=f"设备 {name} 已存在")

    group_name = payload.get("group_name")
    if group_name:
        await _ensure_groups_exist(db, {group_name})

    platform = payload.get("platform") or "cisco_ios"
    vendor = payload.get("vendor") or _derive_vendor(platform)

    row = Device(
        name=name,
        hostname=payload["hostname"],
        site=payload.get("site"),
        device_type=payload.get("device_type"),
        platform=platform,
        port=payload.get("port") or 22,
        username=payload.get("username"),
        password=payload.get("password"),
        timeout=payload.get("timeout"),
        group_name=group_name,
        data=payload.get("data") or {},
        connection_options=payload.get("connection_options") or {},
        vendor=vendor,
        model=payload.get("model"),
        description=payload.get("description"),
        is_active=payload.get("is_active", True),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _device_to_dict(row)


async def get_device(db: AsyncSession, *, device_name: str) -> Dict[str, Any]:
    row = await db.scalar(select(Device).where(Device.name == device_name))
    if not row:
        raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")
    return _device_to_dict(row)


async def update_device(db: AsyncSession, *, device_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    row = await db.scalar(select(Device).where(Device.name == device_name))
    if not row:
        raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")

    if "group_name" in payload and payload["group_name"]:
        await _ensure_groups_exist(db, {payload["group_name"]})

    for key, value in payload.items():
        if key == "name":
            continue
        if key == "password" and value is None:
            continue
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)
    return _device_to_dict(row)


async def delete_device(db: AsyncSession, *, device_name: str) -> None:
    row = await db.scalar(select(Device).where(Device.name == device_name))
    if not row:
        raise HTTPException(status_code=404, detail=f"设备 {device_name} 不存在")
    await db.delete(row)
    await db.commit()


async def bulk_upsert_devices(
    db: AsyncSession,
    *,
    items: List[Dict[str, Any]],
) -> Tuple[int, int, List[Dict[str, Any]]]:
    """
    批量 upsert 设备。

    返回：(created, updated, errors)
    """
    created = 0
    updated = 0
    errors: List[Dict[str, Any]] = []

    if not items:
        return 0, 0, []

    seen: set[str] = set()
    unique_items: list[tuple[int, Dict[str, Any]]] = []
    for idx, item in enumerate(items):
        name = item.get("name")
        if not name:
            errors.append({"index": idx, "name": None, "error": "缺少 name"})
            continue
        if name in seen:
            errors.append({"index": idx, "name": name, "error": "重复的设备名称"})
            continue
        seen.add(name)
        unique_items.append((idx, item))

    names = [item["name"] for _, item in unique_items]
    existing_rows = (await db.execute(select(Device).where(Device.name.in_(names)))).scalars().all()
    existing_by_name = {row.name: row for row in existing_rows}

    group_names = {item.get("group_name") for _, item in unique_items if item.get("group_name")}
    await _ensure_groups_exist(db, {str(g) for g in group_names if g})

    for idx, item in unique_items:
        name = item["name"]
        try:
            group_name = item.get("group_name")

            row = existing_by_name.get(name)
            if row is None:
                platform = item.get("platform") or "cisco_ios"
                vendor = item.get("vendor") or _derive_vendor(platform)
                row = Device(
                    name=name,
                    hostname=item["hostname"],
                    site=item.get("site"),
                    device_type=item.get("device_type"),
                    platform=platform,
                    port=item.get("port") or 22,
                    username=item.get("username"),
                    password=item.get("password"),
                    timeout=item.get("timeout"),
                    group_name=group_name,
                    data=item.get("data") or {},
                    connection_options=item.get("connection_options") or {},
                    vendor=vendor,
                    model=item.get("model"),
                    description=item.get("description"),
                    is_active=item.get("is_active", True),
                )
                db.add(row)
                created += 1
                continue

            for key, value in item.items():
                if key == "name":
                    continue
                if key == "password" and value is None:
                    continue
                if value is None and key in {"data", "connection_options"}:
                    continue
                setattr(row, key, value)

            if not row.vendor:
                row.vendor = _derive_vendor(row.platform)
            updated += 1
        except Exception as exc:  # noqa: BLE001
            errors.append({"index": idx, "name": name, "error": str(exc)})

    await db.commit()
    return created, updated, errors


async def bulk_delete_devices(
    db: AsyncSession,
    *,
    names: List[str],
    confirm: bool,
) -> Tuple[int, List[str], List[Dict[str, Any]]]:
    """
    批量硬删除设备。

    返回：(deleted_count, not_found_names, errors)
    """
    if not confirm:
        raise HTTPException(status_code=400, detail="缺少确认：confirm=true")

    normalized = [n.strip() for n in names if n and n.strip()]
    if not normalized:
        return 0, [], []

    existing_rows = (await db.execute(select(Device).where(Device.name.in_(normalized)))).scalars().all()
    existing_by_name = {row.name: row for row in existing_rows}
    not_found = [n for n in normalized if n not in existing_by_name]

    errors: List[Dict[str, Any]] = []
    deleted = 0
    for name, row in existing_by_name.items():
        try:
            await db.delete(row)
            deleted += 1
        except Exception as exc:  # noqa: BLE001
            errors.append({"name": name, "error": str(exc)})

    await db.commit()
    return deleted, not_found, errors


async def list_groups(db: AsyncSession) -> List[Dict[str, Any]]:
    query = (
        select(DeviceGroup, func.count(Device.id))
        .outerjoin(Device, Device.group_name == DeviceGroup.name)
        .group_by(DeviceGroup.id)
        .order_by(DeviceGroup.name)
    )
    rows = (await db.execute(query)).all()
    results: List[Dict[str, Any]] = []
    for group, count in rows:
        results.append(
            {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "username": group.username,
                "password": group.password,
                "platform": group.platform,
                "port": group.port,
                "timeout": group.timeout,
                "data": group.data,
                "connection_options": group.connection_options,
                "created_at": group.created_at,
                "updated_at": group.updated_at,
                "devices_count": int(count),
            }
        )
    return results


async def create_group(db: AsyncSession, *, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = payload["name"]
    exists = await db.scalar(select(DeviceGroup).where(DeviceGroup.name == name))
    if exists:
        raise HTTPException(status_code=409, detail=f"设备组 {name} 已存在")

    row = DeviceGroup(
        name=name,
        description=payload.get("description"),
        username=payload.get("username"),
        password=payload.get("password"),
        platform=payload.get("platform"),
        port=payload.get("port"),
        timeout=payload.get("timeout"),
        data=payload.get("data") or {},
        connection_options=payload.get("connection_options") or {},
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "username": row.username,
        "password": row.password,
        "platform": row.platform,
        "port": row.port,
        "timeout": row.timeout,
        "data": row.data,
        "connection_options": row.connection_options,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "devices_count": 0,
    }


async def get_inventory_stats(db: AsyncSession) -> Dict[str, Any]:
    total_devices = await db.scalar(select(func.count(Device.id)))
    active_devices = await db.scalar(select(func.count(Device.id)).where(Device.is_active.is_(True)))
    inactive_devices = (total_devices or 0) - (active_devices or 0)
    groups_count = await db.scalar(select(func.count(DeviceGroup.id)))

    by_platform_rows = (
        await db.execute(select(Device.platform, func.count(Device.id)).group_by(Device.platform))
    ).all()
    by_group_rows = (
        await db.execute(select(Device.group_name, func.count(Device.id)).group_by(Device.group_name))
    ).all()
    by_vendor_rows = (await db.execute(select(Device.vendor, func.count(Device.id)).group_by(Device.vendor))).all()

    return {
        "total_devices": int(total_devices or 0),
        "active_devices": int(active_devices or 0),
        "inactive_devices": int(inactive_devices),
        "groups_count": int(groups_count or 0),
        "devices_by_platform": {platform or "unknown": int(count) for platform, count in by_platform_rows},
        "devices_by_group": {group_name or "ungrouped": int(count) for group_name, count in by_group_rows},
        "devices_by_vendor": {vendor or "unknown": int(count) for vendor, count in by_vendor_rows},
        "last_updated": datetime.now(timezone.utc),
    }
