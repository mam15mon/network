"""Normalize SNMP metric collectors to single OID configuration."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.db.database import Database  # noqa: E402


def _load_config(raw: str | None) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def main() -> None:
    db = Database()
    session_factory = getattr(db, "SessionLocal", None)
    if session_factory is None:
        raise RuntimeError("Database is not configured")

    with session_factory() as session:
        metrics = session.execute(
            text(
                "SELECT id, name, collector, collector_config "
                "FROM snmp_metrics"
            )
        ).mappings().all()

        updated = 0
        for metric in metrics:
            collector = (metric.get("collector") or "snmp").lower()
            config = _load_config(metric.get("collector_config"))
            needs_update = False

            if collector != "snmp":
                collector = "snmp"
                needs_update = True

            if isinstance(config.get("steps"), list):
                # Drop workflow artifacts, keep optional oid/value_parser overrides if present.
                config.pop("steps", None)
                config.pop("version", None)
                needs_update = True

            if needs_update:
                session.execute(
                    text(
                        "UPDATE snmp_metrics "
                        "SET collector = :collector, collector_config = :config "
                        "WHERE id = :metric_id"
                    ),
                    {
                        "collector": collector,
                        "config": json.dumps(config) if config else None,
                        "metric_id": metric["id"],
                    },
                )
                updated += 1

        if updated:
            session.commit()
        print(f"Checked {len(metrics)} metrics; normalized {updated}.")


if __name__ == "__main__":
    main()
