from __future__ import annotations

from typing import Any, Dict, List, Optional

from nornir.core.task import MultiResult, Result


def ensure_host_results(
    formatted: Dict[str, Any],
    requested_hosts: List[str],
    logger: Optional[object] = None,
) -> Dict[str, Any]:
    """
    兜底：确保每个 requested host 都有返回项。

    说明：正常情况下 nornir.run 一定会返回每个 host 的结果；如果由于过滤条件/版本差异导致空结果，
    这里返回“未返回结果”，避免上层出现难以定位的空 dict。
    """
    if not requested_hosts:
        return formatted
    if formatted and all(h in formatted for h in requested_hosts):
        return formatted

    if logger is not None:
        try:
            logger.warning(
                "任务结果缺失，使用兜底返回: requested=%r got=%r",
                requested_hosts,
                list(formatted.keys()),
            )
        except Exception:  # noqa: BLE001
            pass

    merged = dict(formatted)
    for host in requested_hosts:
        merged.setdefault(
            host,
            {
                "status": "failed",
                "result": None,
                "failed": True,
                "exception": "未返回结果（可能是过滤/热重载导致的空结果）",
                "diff": "",
                "changed": False,
            },
        )
    return merged


def format_results(results: Dict[str, Any]) -> Dict[str, Any]:
    """
    将 Nornir 的 Result/MultiResult 结构格式化成可序列化的 dict（供 API 返回）。
    """
    formatted_results: Dict[str, Any] = {}

    for host_name, host_result in results.items():
        if isinstance(host_result, MultiResult):
            leaf: Result | None = host_result[-1] if len(host_result) else None
            primary: Result | None = leaf

            exception_candidate: Result | None = None
            for r in reversed(host_result):
                if getattr(r, "exception", None):
                    exception_candidate = r
                    break
                if isinstance(getattr(r, "result", None), str) and "Traceback" in str(r.result):
                    exception_candidate = r
                    break

            if exception_candidate is not None:
                primary = exception_candidate
            else:
                parent = host_result[0] if len(host_result) else None
                if parent is not None:
                    parent_result = getattr(parent, "result", None)
                    if not isinstance(parent_result, MultiResult) and isinstance(
                        parent_result, (dict, list, str, int, float, bool, type(None))
                    ):
                        primary = parent

            exception = str(primary.exception) if primary and getattr(primary, "exception", None) else None
            if not exception and primary and isinstance(getattr(primary, "result", None), str):
                text = str(primary.result)
                if "Traceback" in text:
                    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
                    if lines:
                        exception = lines[-1]

            changed = any(bool(getattr(r, "changed", False)) for r in host_result)
            diffs = [getattr(r, "diff", None) for r in host_result if getattr(r, "diff", None)]
            diff = "\n".join(diffs) if diffs else ""

            formatted_results[host_name] = {
                "status": "success" if host_result.failed is False else "failed",
                "result": primary.result if primary else None,
                "failed": host_result.failed,
                "exception": exception,
                "diff": diff,
                "changed": changed,
            }
            continue

        result: Result = host_result
        formatted_results[host_name] = {
            "status": "success" if result.failed is False else "failed",
            "result": result.result,
            "failed": result.failed,
            "exception": str(result.exception) if result.exception else None,
            "diff": result.diff,
            "changed": result.changed,
        }

    return formatted_results

