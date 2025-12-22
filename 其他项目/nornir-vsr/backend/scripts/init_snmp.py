"""SNMP 模块数据库迁移脚本。

此脚本用于创建 SNMP 监控相关的数据库表和初始化内置指标。
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# 添加后端路径到 sys.path
project_root = Path(__file__).resolve().parents[2]
backend_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(backend_root))

# 加载 .env 配置
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.db.models import Base, SNMPMetric
from services.snmp import SNMPService

def resolve_database_url() -> str:
    """获取数据库连接串。"""
    db_url = os.environ.get("NORNIR_VSR_DB_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("数据库连接未配置，请设置 NORNIR_VSR_DB_URL 或 DATABASE_URL 环境变量")
    return db_url


def init_snmp_tables():
    """初始化 SNMP 表结构。"""
    print("Initializing SNMP tables...")
    engine = create_engine(resolve_database_url())

    # 创建所有表
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")

    return engine

def init_builtin_metrics(engine):
    """初始化内置监控指标。"""
    print("\nInitializing builtin SNMP metrics...")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        builtin_metrics = SNMPService.get_builtin_metrics()

        for metric_data in builtin_metrics:
            # 检查是否已存在
            existing = db.query(SNMPMetric).filter(SNMPMetric.name == metric_data['name']).first()
            if existing:
                print(f"  - Skipping existing metric: {metric_data['name']}")
                continue

            # 创建新指标
            metric = SNMPMetric(
                name=metric_data['name'],
                oid=metric_data['oid'],
                description=metric_data['description'],
                value_type=metric_data['value_type'],
                unit=metric_data['unit'],
                value_parser=metric_data['value_parser'],
                is_builtin=True,
            )
            db.add(metric)
            print(f"  + Created builtin metric: {metric_data['name']}")

        db.commit()
        print("✓ Builtin metrics initialized successfully")

    except Exception as e:
        print(f"✗ Error initializing builtin metrics: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """主函数。"""
    print("=" * 60)
    print("SNMP Module Database Migration")
    print("=" * 60)

    try:
        # 初始化表
        engine = init_snmp_tables()

        # 初始化内置指标
        init_builtin_metrics(engine)

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
