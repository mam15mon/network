"""Extract address pool CIDR information from configuration snapshots."""
from __future__ import annotations

import ipaddress
import re
from typing import Iterable, Optional


_IP_PATTERN = r"\d+\.\d+\.\d+\.\d+"
PPP_AUTH_LINE = re.compile(
    r"^\s*ppp\s+authentication-mode\s+(?P<mode>[^#\r\n]+?)\s*$",
    re.MULTILINE,
)

DOMAIN_START_LINE = re.compile(r"^\s*domain\s+(?P<name>\S+)\s*$")
INDENT_LINE = re.compile(r"^\s+(?P<body>\S.*)$")
RADIUS_SCHEME_START = re.compile(r"^\s*radius\s+scheme\s+(?P<name>\S+)\s*$")
RADIUS_PRIMARY_LINE = re.compile(r"^\s*primary\s+(authentication|accounting)\s+(?P<ip>\d+\.\d+\.\d+\.\d+)\s*$", re.IGNORECASE)

__all__ = ["extract_ip_pool_cidr", "extract_ppp_auth_mode"]


def _common_prefix_length(addresses: Iterable[ipaddress.IPv4Address]) -> int:
    iterator = iter(addresses)
    try:
        first = next(iterator)
    except StopIteration:
        return 32

    min_ip = int(first)
    max_ip = int(first)
    for addr in iterator:
        value = int(addr)
        if value < min_ip:
            min_ip = value
        if value > max_ip:
            max_ip = value

    xor = min_ip ^ max_ip
    prefix = 32
    while xor:
        xor >>= 1
        prefix -= 1
    return prefix


def extract_ip_pool_cidr(config_content: str, pool_name: str = "1") -> Optional[str]:
    """Return CIDR string for the specified ``ip pool`` block if present."""

    if not config_content:
        return None

    range_pattern = re.compile(
        rf"^\s*ip\s+pool\s+{re.escape(pool_name)}\s+(?P<start>{_IP_PATTERN})\s+(?P<end>{_IP_PATTERN})\s*$",
        re.MULTILINE,
    )
    range_match = range_pattern.search(config_content)
    if not range_match:
        return None

    points = [
        ipaddress.IPv4Address(range_match.group("start")),
        ipaddress.IPv4Address(range_match.group("end")),
    ]

    gateway_pattern = re.compile(
        rf"^\s*ip\s+pool\s+{re.escape(pool_name)}\s+gateway\s+(?P<gateway>{_IP_PATTERN})\s*$",
        re.MULTILINE,
    )
    gateway_match = gateway_pattern.search(config_content)
    if gateway_match:
        points.append(ipaddress.IPv4Address(gateway_match.group("gateway")))

    prefix = _common_prefix_length(points)
    if prefix < 0:
        return None

    network_int = int(points[0]) & (~((1 << (32 - prefix)) - 1) if prefix < 32 else 0xFFFFFFFF)
    network = ipaddress.IPv4Network((network_int, prefix))
    if not all(addr in network for addr in points):
        # Fallback: expand network until it covers all points
        min_ip = min(points)
        max_ip = max(points)
        aggregated = ipaddress.summarize_address_range(min_ip, max_ip)
        networks = list(aggregated)
        if len(networks) == 1:
            return str(networks[0])
        # Multiple networks; return a comma separated list for transparency
        return ", ".join(str(net) for net in networks)

    return str(network)


def extract_ppp_auth_mode(config_content: str) -> Optional[str]:
    """Extract PPP authentication mode string from configuration."""

    if not config_content:
        return None
    match = PPP_AUTH_LINE.search(config_content)
    if not match:
        return None
    mode = match.group("mode").strip()
    if not mode:
        return None

    domain_name: Optional[str] = None
    domain_match = re.search(r"domain\s+(?P<domain>\S+)", mode)
    if domain_match:
        domain_name = domain_match.group("domain")

    if not domain_name:
        return mode

    domain_details = _extract_domain_auth_lines(config_content).get(domain_name)
    if not domain_details:
        return mode

    auth_lines = [line for line in domain_details if line.lower().startswith("authentication ")]
    if not auth_lines:
        return f"{mode} [local]"

    radius_servers = _extract_radius_servers(config_content)
    formatted_parts: list[str] = []
    for line in auth_lines:
        lower = line.lower()
        if "radius" in lower:
            scheme_match = re.search(r"radius-scheme\s+(?P<scheme>\S+)", line, re.IGNORECASE)
            if scheme_match:
                scheme = scheme_match.group("scheme")
                ips = radius_servers.get(scheme)
                if ips:
                    for ip in sorted(ips):
                        formatted_parts.append(f"radius:{ip}")
                else:
                    formatted_parts.append("radius")
            else:
                formatted_parts.append("radius")
        elif "local" in lower:
            formatted_parts.append("local")
        elif "ldap" in lower:
            formatted_parts.append("ldap")
        else:
            formatted_parts.append(line)

    formatted = "; ".join(formatted_parts)
    return f"{mode} [{formatted}]"


def _extract_domain_auth_lines(config_content: str) -> dict[str, list[str]]:
    domains: dict[str, list[str]] = {}
    current: Optional[str] = None

    for raw_line in config_content.splitlines():
        stripped = raw_line.strip()
        start_match = DOMAIN_START_LINE.match(raw_line)
        if start_match:
            current = start_match.group("name")
            domains.setdefault(current, [])
            continue

        indent_match = INDENT_LINE.match(raw_line)
        if indent_match and current:
            body = indent_match.group("body").strip()
            if body:
                domains[current].append(body)
            continue

        # Ignore empty or comment lines inside domain blocks
        if stripped == "" or stripped.startswith("#"):
            continue

        # Reset context when encountering other lines
        current = None

    return domains


def _extract_radius_servers(config_content: str) -> dict[str, set[str]]:
    schemes: dict[str, set[str]] = {}
    current: Optional[str] = None

    for raw_line in config_content.splitlines():
        start_match = RADIUS_SCHEME_START.match(raw_line)
        if start_match:
            current = start_match.group("name")
            schemes.setdefault(current, set())
            continue

        indent_match = INDENT_LINE.match(raw_line)
        if indent_match and current:
            body = indent_match.group("body").strip()
            primary_match = RADIUS_PRIMARY_LINE.match(body)
            if primary_match:
                schemes[current].add(primary_match.group("ip"))
            continue

        stripped = raw_line.strip()
        if stripped == "" or stripped.startswith("#"):
            continue

        current = None

    return schemes
