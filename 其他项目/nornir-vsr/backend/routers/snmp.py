"""SNMP 监控相关路由。"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.security import get_current_active_user
from core.db.models import Host, SNMPAlert, SNMPDataPoint, SNMPMetric, SNMPMonitorTask
from schemas.snmp import (
    SNMPAlertCreate,
    SNMPAlertResponse,
    SNMPAlertUpdate,
    SNMPBatchTaskCreate,
    SNMPBatchTaskDelete,
    SNMPDataPointResponse,
    SNMPMetricCreate,
    SNMPMetricResponse,
    SNMPMetricUpdate,
    SNMPMonitorStats,
    SNMPMonitorTaskCreate,
    SNMPMonitorTaskDetail,
    SNMPMonitorTaskResponse,
    SNMPMonitorTaskUpdate,
    SNMPTestRequest,
    SNMPTestResponse,
    SNMPHistoryCleanupRequest,
    SNMPHistoryCleanupResponse,
)
from services.snmp import SNMPService

router = APIRouter(prefix="/snmp", tags=["SNMP"])


# ========== SNMP Metrics ==========
@router.get("/metrics", response_model=List[SNMPMetricResponse])
def list_metrics(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取所有 SNMP 监控指标。"""
    metrics = db.query(SNMPMetric).offset(skip).limit(limit).all()
    return metrics


@router.get("/metrics/builtin", response_model=List[dict])
def get_builtin_metrics(current_user=Depends(get_current_active_user)):
    """获取内置的监控指标。"""
    return SNMPService.get_builtin_metrics()


@router.post("/metrics", response_model=SNMPMetricResponse)
def create_metric(
    metric: SNMPMetricCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """创建 SNMP 监控指标。"""
    # 检查名称是否已存在
    existing = db.query(SNMPMetric).filter(SNMPMetric.name == metric.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="指标名称已存在")

    db_metric = SNMPMetric(**metric.model_dump())
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric


@router.put("/metrics/{metric_id}", response_model=SNMPMetricResponse)
def update_metric(
    metric_id: int,
    metric: SNMPMetricUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新 SNMP 监控指标。"""
    db_metric = db.query(SNMPMetric).filter(SNMPMetric.id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="指标不存在")

    if db_metric.is_builtin and not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="内置指标仅超级管理员可修改")

    # 更新字段
    for field, value in metric.model_dump(exclude_unset=True).items():
        setattr(db_metric, field, value)

    db.commit()
    db.refresh(db_metric)
    return db_metric


@router.delete("/metrics/{metric_id}")
def delete_metric(
    metric_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除 SNMP 监控指标。"""
    db_metric = db.query(SNMPMetric).filter(SNMPMetric.id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="指标不存在")

    if db_metric.is_builtin and not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="内置指标仅超级管理员可删除")

    # 检查是否有关联的监控任务
    task_count = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.metric_id == metric_id).count()
    if task_count > 0:
        raise HTTPException(status_code=400, detail=f"该指标有 {task_count} 个关联的监控任务，无法删除")

    db.delete(db_metric)
    db.commit()
    return {"message": "指标删除成功"}


# ========== SNMP Test ==========
@router.post("/test", response_model=SNMPTestResponse)
def test_snmp_oid(
    test_req: SNMPTestRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """测试 SNMP OID。"""
    # 获取主机
    host = db.query(Host).filter(Host.id == test_req.host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="主机不存在")

    # 执行 SNMP 查询
    success, output, error = SNMPService.execute_snmpwalk(
        host=host,
        oid=test_req.oid,
        snmp_version=test_req.snmp_version,
        snmp_community=test_req.snmp_community,
    )

    if success:
        # 解析输出为列表
        parsed_values = SNMPService.parse_snmp_output_to_list(output)
        return SNMPTestResponse(
            success=True,
            raw_output=output,
            parsed_values=parsed_values,
        )
    else:
        return SNMPTestResponse(
            success=False,
            error=error,
        )


# ========== SNMP Monitor Tasks ==========
@router.get("/tasks", response_model=List[SNMPMonitorTaskDetail])
def list_tasks(
    skip: int = 0,
    limit: int = 1000,
    host_id: Optional[int] = None,
    metric_id: Optional[int] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取所有 SNMP 监控任务。"""
    query = db.query(SNMPMonitorTask)

    if host_id is not None:
        query = query.filter(SNMPMonitorTask.host_id == host_id)
    if metric_id is not None:
        query = query.filter(SNMPMonitorTask.metric_id == metric_id)
    if enabled is not None:
        query = query.filter(SNMPMonitorTask.enabled == enabled)

    tasks = query.offset(skip).limit(limit).all()

    # 构建详细信息
    result = []
    for task in tasks:
        host = db.query(Host).filter(Host.id == task.host_id).first()
        metric = db.query(SNMPMetric).filter(SNMPMetric.id == task.metric_id).first()
        alerts = db.query(SNMPAlert).filter(SNMPAlert.task_id == task.id).all()

        task_dict = {
            "id": task.id,
            "name": task.name,
            "host_id": task.host_id,
            "metric_id": task.metric_id,
            "interval": task.interval,
            "enabled": task.enabled,
            "last_poll_at": task.last_poll_at,
            "last_value": task.last_value,
            "last_status": task.last_status,
            "last_error": task.last_error,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "host_name": host.name if host else None,
            "host_hostname": host.hostname if host else None,
            "host_site": host.site if host else None,
            "metric_name": metric.name if metric else None,
            "metric_oid": metric.oid if metric else None,
            "metric_unit": metric.unit if metric else None,
            "metric_collector": metric.collector if metric else None,
            "metric_collector_config": metric.collector_config if metric else None,
            "alerts": alerts,
        }
        result.append(SNMPMonitorTaskDetail(**task_dict))

    return result


@router.post("/tasks", response_model=SNMPMonitorTaskResponse)
def create_task(
    task: SNMPMonitorTaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """创建 SNMP 监控任务。"""
    # 验证主机和指标存在
    host = db.query(Host).filter(Host.id == task.host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="主机不存在")

    metric = db.query(SNMPMetric).filter(SNMPMetric.id == task.metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="指标不存在")

    db_task = SNMPMonitorTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.post("/tasks/batch", response_model=List[SNMPMonitorTaskResponse])
def create_batch_tasks(
    batch: SNMPBatchTaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """批量创建 SNMP 监控任务。"""
    created_tasks = []

    for host_id in batch.host_ids:
        # 验证主机存在
        host = db.query(Host).filter(Host.id == host_id).first()
        if not host:
            continue

        for metric_id in batch.metric_ids:
            # 验证指标存在
            metric = db.query(SNMPMetric).filter(SNMPMetric.id == metric_id).first()
            if not metric:
                continue

            # 检查是否已存在
            existing = (
                db.query(SNMPMonitorTask)
                .filter(
                    SNMPMonitorTask.host_id == host_id,
                    SNMPMonitorTask.metric_id == metric_id,
                )
                .first()
            )
            if existing:
                continue

            # 创建任务
            task_name = f"{host.name} - {metric.name}"
            db_task = SNMPMonitorTask(
                name=task_name,
                host_id=host_id,
                metric_id=metric_id,
                interval=batch.interval,
                enabled=batch.enabled,
            )
            db.add(db_task)
            created_tasks.append(db_task)

    db.commit()
    for task in created_tasks:
        db.refresh(task)

    return created_tasks


@router.put("/tasks/{task_id}", response_model=SNMPMonitorTaskResponse)
def update_task(
    task_id: int,
    task: SNMPMonitorTaskUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新 SNMP 监控任务。"""
    db_task = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")

    for field, value in task.model_dump(exclude_unset=True).items():
        setattr(db_task, field, value)

    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除 SNMP 监控任务。"""
    db_task = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 删除关联的数据点和告警
    db.query(SNMPDataPoint).filter(SNMPDataPoint.task_id == task_id).delete()
    db.query(SNMPAlert).filter(SNMPAlert.task_id == task_id).delete()

    db.delete(db_task)
    db.commit()
    return {"message": "任务删除成功"}


@router.post("/tasks/batch/delete")
def delete_batch_tasks(
    batch: SNMPBatchTaskDelete,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """批量删除 SNMP 监控任务。"""
    task_ids = list({task_id for task_id in batch.task_ids if isinstance(task_id, int)})
    if not task_ids:
        return {"deleted": 0}

    tasks = (
        db.query(SNMPMonitorTask)
        .filter(SNMPMonitorTask.id.in_(task_ids))
        .all()
    )
    if not tasks:
        return {"deleted": 0}

    db.query(SNMPDataPoint).filter(SNMPDataPoint.task_id.in_(task_ids)).delete(synchronize_session=False)
    db.query(SNMPAlert).filter(SNMPAlert.task_id.in_(task_ids)).delete(synchronize_session=False)
    db.query(SNMPMonitorTask).filter(SNMPMonitorTask.id.in_(task_ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": len(tasks)}


# ========== SNMP Data Points ==========
@router.post("/data/cleanup", response_model=SNMPHistoryCleanupResponse)
def cleanup_data_points(
    payload: SNMPHistoryCleanupRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """清理 SNMP 历史数据。仅超级管理员可执行。"""
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="仅超级管理员可执行此操作")

    query = db.query(SNMPDataPoint)
    if payload.delete_all:
        deleted = query.delete(synchronize_session=False)
    else:
        cutoff = datetime.now() - timedelta(days=payload.days)
        deleted = query.filter(SNMPDataPoint.timestamp <= cutoff).delete(synchronize_session=False)

    db.commit()
    return SNMPHistoryCleanupResponse(deleted=int(deleted or 0))


@router.get("/tasks/{task_id}/data", response_model=List[SNMPDataPointResponse])
def get_task_data(
    task_id: int,
    hours: int = Query(24, description="获取最近多少小时的数据"),
    start_time: Optional[datetime] = Query(
        None,
        description="开始时间 (ISO8601)",
    ),
    end_time: Optional[datetime] = Query(
        None,
        description="结束时间 (ISO8601)",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取监控任务的历史数据。"""
    # 验证任务存在
    task = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 处理时间范围
    if start_time and end_time and start_time > end_time:
        raise HTTPException(status_code=400, detail="开始时间不能晚于结束时间")

    if end_time and not start_time:
        start_time = end_time - timedelta(hours=hours)
    if start_time and not end_time:
        end_time = datetime.now()

    query = db.query(SNMPDataPoint).filter(SNMPDataPoint.task_id == task_id)

    if start_time:
        query = query.filter(SNMPDataPoint.timestamp >= start_time)
    else:
        since = datetime.now() - timedelta(hours=hours)
        query = query.filter(SNMPDataPoint.timestamp >= since)

    if end_time:
        query = query.filter(SNMPDataPoint.timestamp <= end_time)

    data_points = query.order_by(SNMPDataPoint.timestamp.asc()).all()

    return data_points


# ========== SNMP Alerts ==========
@router.post("/alerts", response_model=SNMPAlertResponse)
def create_alert(
    alert: SNMPAlertCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """创建 SNMP 告警。"""
    # 验证任务存在
    task = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.id == alert.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    db_alert = SNMPAlert(**alert.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.put("/alerts/{alert_id}", response_model=SNMPAlertResponse)
def update_alert(
    alert_id: int,
    alert: SNMPAlertUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新 SNMP 告警。"""
    db_alert = db.query(SNMPAlert).filter(SNMPAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    for field, value in alert.model_dump(exclude_unset=True).items():
        setattr(db_alert, field, value)

    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.delete("/alerts/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除 SNMP 告警。"""
    db_alert = db.query(SNMPAlert).filter(SNMPAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    db.delete(db_alert)
    db.commit()
    return {"message": "告警删除成功"}


# ========== SNMP Statistics ==========
@router.get("/stats", response_model=SNMPMonitorStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取 SNMP 监控统计信息。"""
    total_tasks = db.query(SNMPMonitorTask).count()
    active_tasks = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.enabled == True).count()
    failed_tasks = (
        db.query(SNMPMonitorTask)
        .filter(SNMPMonitorTask.last_status == "failed")
        .count()
    )

    # 统计有监控任务的主机数
    total_hosts = (
        db.query(func.count(func.distinct(SNMPMonitorTask.host_id)))
        .scalar()
    )

    total_metrics = db.query(SNMPMetric).count()

    return SNMPMonitorStats(
        total_tasks=total_tasks,
        active_tasks=active_tasks,
        failed_tasks=failed_tasks,
        total_hosts=total_hosts or 0,
        total_metrics=total_metrics,
    )
