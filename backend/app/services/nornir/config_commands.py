from __future__ import annotations


def guess_running_config_command(platform: str) -> str:
    p = (platform or "").lower()
    if "huawei" in p or "h3c" in p or "comware" in p:
        return "display current-configuration"
    if "juniper" in p or "junos" in p:
        return "show configuration | display set"
    if "fortinet" in p or "fortigate" in p:
        return "show full-configuration"
    return "show running-config"

