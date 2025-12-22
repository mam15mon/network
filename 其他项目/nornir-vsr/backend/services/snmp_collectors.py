"""Simplified SNMP collector utilities for single-OID polling."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional, Tuple

from core.db.models import Host, SNMPMetric
from services.snmp import SNMPService

logger = logging.getLogger(__name__)

CollectorResult = Tuple[bool, Optional[str], Optional[str], Optional[str]]


def _load_config(config_str: Optional[str]) -> Dict[str, Any]:
    if not config_str:
        return {}
    try:
        return json.loads(config_str)
    except json.JSONDecodeError:
        logger.warning("Invalid collector_config JSON: %s", config_str)
        return {}


def run_collector(host: Host, metric: SNMPMetric) -> CollectorResult:
    """Collect a single OID value and return both raw and parsed results."""
    config = _load_config(metric.collector_config)

    if isinstance(config.get("steps"), list):
        logger.error(
            "Workflow configuration detected for metric %s; workflow collectors are no longer supported",
            getattr(metric, "name", "<unknown>"),
        )
        return False, None, None, "Workflow collector configuration is no longer supported. Please configure a single OID."

    oid = _resolve_oid(host, metric, config)
    if not oid:
        return False, None, None, "SNMP OID is required"

    snmp_version = config.get("snmp_version")
    snmp_community = config.get("snmp_community")
    timeout = config.get("timeout", 10)

    success, raw_output, error = SNMPService.execute_snmpwalk(
        host=host,
        oid=oid,
        snmp_version=snmp_version,
        snmp_community=snmp_community,
        timeout=timeout,
    )
    if not success:
        return False, raw_output, None, error

    value_parser = config.get("value_parser") or metric.value_parser
    parsed_value = SNMPService.parse_snmp_value(raw_output, value_parser)

    return True, raw_output, parsed_value, None


def _resolve_oid(host: Host, metric: SNMPMetric, config: Dict[str, Any]) -> Optional[str]:
    """Resolve final OID considering host-derived domain configuration."""
    domain_base = config.get("domain_base_oid")
    if not domain_base:
        raw_oid = config.get("oid") or metric.oid
        return str(raw_oid).strip() if raw_oid else None

    domain_value = str(config.get("domain_value") or "").strip()
    if not domain_value:
        host_field = str(config.get("domain_host_field") or "ppp_auth_mode")
        raw_source = getattr(host, host_field, None)
        if raw_source:
            domain_value = _extract_domain_from_source(str(raw_source), config.get("domain_regex"))
    if not domain_value:
        fallback = config.get("domain_fallback")
        if fallback:
            domain_value = str(fallback).strip()
    if not domain_value:
        logger.warning(
            "Unable to determine domain for host %s metric %s using field '%s'",
            getattr(host, "name", host.id),
            metric.name,
            config.get("domain_host_field", "ppp_auth_mode"),
        )
        return None

    try:
        return _compose_domain_oid(str(domain_base), domain_value)
    except ValueError as exc:
        logger.error("Failed to compose domain OID: %s", exc)
        return None


def _extract_domain_from_source(source: str, custom_regex: Optional[str]) -> Optional[str]:
    """Try to extract domain identifier from PPP auth mode or custom patterns."""
    if custom_regex:
        try:
            match = re.search(custom_regex, source)
            if match:
                if "domain" in match.re.groupindex:
                    return match.group("domain")
                if match.groups():
                    return match.group(1)
        except re.error as exc:
            logger.warning("Invalid domain_regex provided: %s", exc)

    match = re.search(r"domain\s+([^\s\[\]]+)", source, re.IGNORECASE)
    if match:
        return match.group(1)

    cleaned = source.strip()
    return cleaned or None


def _compose_domain_oid(base_oid: str, domain: str) -> str:
    """Compose OID with ASCII encoding for domain suffix."""
    domain = domain.strip()
    if not domain:
        raise ValueError("Domain value cannot be empty")
    ascii_parts = [str(ord(char)) for char in domain]
    return f"{base_oid}.{len(domain)}.{'.'.join(ascii_parts)}"
