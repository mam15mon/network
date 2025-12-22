"""SNMP 定时采集调度器。"""
import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from core.db.database import Database
from core.db.models import Host, SNMPAlert, SNMPDataPoint, SNMPMetric, SNMPMonitorTask
from services.snmp_collectors import run_collector

logger = logging.getLogger(__name__)


class SNMPScheduler:
    """SNMP 调度器。"""

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self._db = Database()
        self.engine = getattr(self._db, "engine", None)
        self.SessionLocal = getattr(self._db, "SessionLocal", None)

    def start(self):
        """启动调度器。"""
        if not self.SessionLocal:
            logger.warning("SNMP scheduler disabled: database not configured")
            return
        # 添加定时任务，每 30 秒检查一次需要执行的任务
        self.scheduler.add_job(
            self.poll_all_tasks,
            'interval',
            seconds=30,
            id='snmp_poll_all',
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("SNMP scheduler started")

    def stop(self):
        """停止调度器。"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("SNMP scheduler stopped")

    def poll_all_tasks(self):
        """轮询所有需要执行的任务。"""
        if not self.SessionLocal:
            logger.debug("Skip SNMP polling: database not configured")
            return
        db = self.SessionLocal()
        try:
            # 查询所有启用的任务
            tasks = db.query(SNMPMonitorTask).filter(SNMPMonitorTask.enabled == True).all()

            for task in tasks:
                # 检查是否需要执行
                if self._should_poll(task):
                    self._poll_task(db, task)

            db.commit()
        except Exception as e:
            logger.error(f"Error polling tasks: {e}")
            db.rollback()
        finally:
            db.close()

    def _should_poll(self, task: SNMPMonitorTask) -> bool:
        """判断任务是否应该执行。

        Args:
            task: 监控任务

        Returns:
            是否应该执行
        """
        # 如果从未执行过，立即执行
        if not task.last_poll_at:
            return True

        # 计算距离上次执行的时间
        elapsed = (datetime.now() - task.last_poll_at).total_seconds()

        # 如果超过间隔时间，执行
        return elapsed >= task.interval

    def _poll_task(self, db, task: SNMPMonitorTask):
        """执行单个任务。

        Args:
            db: 数据库会话
            task: 监控任务
        """
        try:
            # 获取主机和指标信息
            host = db.query(Host).filter(Host.id == task.host_id).first()
            metric = db.query(SNMPMetric).filter(SNMPMetric.id == task.metric_id).first()

            if not host or not metric:
                logger.error(f"Task {task.id}: Host or metric not found")
                task.last_status = "failed"
                task.last_error = "Host or metric not found"
                return

            success, raw_output, parsed_value, error = run_collector(host, metric)

            # 更新任务状态
            task.last_poll_at = datetime.now()

            if success:
                # 解析值
                if parsed_value is None:
                    parsed_value = raw_output

                # 保存数据点
                data_point = SNMPDataPoint(
                    task_id=task.id,
                    value=parsed_value or raw_output,
                    raw_value=raw_output,
                    timestamp=datetime.now(),
                )
                db.add(data_point)

                # 更新任务
                task.last_value = parsed_value or raw_output
                task.last_status = "success"
                task.last_error = None

                # 检查告警
                self._check_alerts(db, task, parsed_value)

                logger.debug(f"Task {task.id} ({task.name}): Success - {parsed_value}")
            else:
                task.last_status = "failed"
                task.last_error = error
                logger.warning(f"Task {task.id} ({task.name}): Failed - {error}")

        except Exception as e:
            logger.error(f"Error polling task {task.id}: {e}")
            task.last_status = "failed"
            task.last_error = str(e)

    def _check_alerts(self, db, task: SNMPMonitorTask, value: Optional[str]):
        """检查告警条件。

        Args:
            db: 数据库会话
            task: 监控任务
            value: 当前值
        """
        if not value:
            return

        # 查询该任务的所有启用的告警
        alerts = db.query(SNMPAlert).filter(
            SNMPAlert.task_id == task.id,
            SNMPAlert.enabled == True,
        ).all()

        for alert in alerts:
            try:
                # 尝试将值转换为浮点数
                current_value = float(value)
                threshold = alert.threshold

                # 判断是否触发告警
                triggered = False
                if alert.condition == "gt" and current_value > threshold:
                    triggered = True
                elif alert.condition == "lt" and current_value < threshold:
                    triggered = True
                elif alert.condition == "eq" and current_value == threshold:
                    triggered = True
                elif alert.condition == "ne" and current_value != threshold:
                    triggered = True

                if triggered:
                    self._trigger_alert(db, task, alert, current_value)

            except ValueError:
                # 如果无法转换为数字，跳过该告警
                logger.debug(f"Cannot convert value '{value}' to float for alert {alert.id}")
                continue

    def _trigger_alert(self, db, task: SNMPMonitorTask, alert: SNMPAlert, current_value: float):
        """触发告警。

        Args:
            db: 数据库会话
            task: 监控任务
            alert: 告警配置
            current_value: 当前值
        """
        # 获取主机和指标信息
        host = db.query(Host).filter(Host.id == task.host_id).first()
        metric = db.query(SNMPMetric).filter(SNMPMetric.id == task.metric_id).first()

        # 构建告警消息
        message = alert.message or (
            f"Alert triggered: {host.name if host else 'Unknown'} - "
            f"{metric.name if metric else 'Unknown'} "
            f"{alert.condition} {alert.threshold}, current: {current_value}"
        )

        logger.warning(f"[{alert.severity.upper()}] {message}")

        # 这里可以扩展：发送邮件、webhook、短信等通知


# 全局调度器实例
snmp_scheduler = SNMPScheduler()
