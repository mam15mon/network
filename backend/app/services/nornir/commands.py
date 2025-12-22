from __future__ import annotations

from typing import List


def split_commands(command: str) -> List[str]:
    commands = [ln.strip() for ln in (command or "").splitlines()]
    return [c for c in commands if c]

