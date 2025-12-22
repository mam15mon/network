"""Add collector columns to snmp_metrics table."""
from sqlalchemy import text

from core.db.database import Database


def main() -> None:
    db = Database()
    session_factory = getattr(db, "SessionLocal", None)
    if session_factory is None:
        raise RuntimeError("Database is not configured")
    session = session_factory()
    try:
        session.execute(text("ALTER TABLE snmp_metrics ADD COLUMN IF NOT EXISTS collector VARCHAR(50) DEFAULT 'snmp';"))
        session.execute(text("ALTER TABLE snmp_metrics ADD COLUMN IF NOT EXISTS collector_config TEXT;"))
        session.commit()
        print("Columns collector and collector_config ensured on snmp_metrics")
    finally:
        session.close()


if __name__ == "__main__":
    main()
