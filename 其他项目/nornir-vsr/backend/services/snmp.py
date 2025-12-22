"""SNMP 服务工具。"""
import re
import subprocess
from typing import Optional

from core.db.models import Host, SNMPMetric


class SNMPService:
    """SNMP 服务类，用于执行 SNMP 查询。"""

    @staticmethod
    def build_snmpwalk_command(
        host: Host,
        oid: str,
        snmp_version: Optional[str] = None,
        snmp_community: Optional[str] = None,
    ) -> list[str]:
        """构建 snmpwalk 命令。

        Args:
            host: 主机对象
            oid: SNMP OID
            snmp_version: SNMP 版本，默认使用主机配置
            snmp_community: SNMP 团体字，默认使用主机配置

        Returns:
            命令参数列表
        """
        version = snmp_version or host.snmp_version or "v2c"
        community = snmp_community or host.snmp_community or "public"
        port = host.snmp_port or 161

        # 构建命令
        cmd = ["snmpwalk"]

        # 版本
        if version == "v1":
            cmd.extend(["-v1"])
        elif version == "v2c":
            cmd.extend(["-v2c"])
        elif version == "v3":
            cmd.extend(["-v3"])
        else:
            cmd.extend(["-v2c"])  # 默认

        # 团体字（仅 v1 和 v2c）
        if version in ["v1", "v2c"]:
            cmd.extend(["-c", community])

        # 目标主机和端口
        target = f"{host.hostname}:{port}" if port != 161 else host.hostname
        cmd.append(target)

        # OID
        cmd.append(oid)

        return cmd

    @staticmethod
    def execute_snmpwalk(
        host: Host,
        oid: str,
        snmp_version: Optional[str] = None,
        snmp_community: Optional[str] = None,
        timeout: int = 10,
    ) -> tuple[bool, Optional[str], Optional[str]]:
        """执行 snmpwalk 命令。

        Args:
            host: 主机对象
            oid: SNMP OID
            snmp_version: SNMP 版本
            snmp_community: SNMP 团体字
            timeout: 超时时间（秒）

        Returns:
            (是否成功, 输出结果, 错误信息)
        """
        cmd = SNMPService.build_snmpwalk_command(host, oid, snmp_version, snmp_community)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            if result.returncode == 0:
                return True, result.stdout.strip(), None
            else:
                return False, None, result.stderr.strip() or "SNMP query failed"

        except subprocess.TimeoutExpired:
            return False, None, f"SNMP query timeout after {timeout} seconds"
        except FileNotFoundError:
            return False, None, "snmpwalk command not found. Please install net-snmp package."
        except Exception as e:
            return False, None, f"Error executing snmpwalk: {str(e)}"

    @staticmethod
    def parse_snmp_value(raw_output: str, value_parser: Optional[str] = None) -> Optional[str]:
        """解析 SNMP 返回值。

        Args:
            raw_output: 原始输出
            value_parser: 值解析器，格式：
                - "regex:pattern" - 使用正则表达式提取
                - "last_integer" - 提取最后一个整数
                - "last_word" - 提取最后一个单词
                - None - 返回整个输出

        Returns:
            解析后的值
        """
        if not raw_output:
            return None

        if not value_parser:
            return raw_output

        # 正则表达式解析
        if value_parser.startswith("regex:"):
            pattern = value_parser[6:]
            match = re.search(pattern, raw_output)
            if match:
                # 如果有捕获组，返回第一个捕获组
                if match.groups():
                    return match.group(1)
                # 否则返回整个匹配
                return match.group(0)
            return None

        # 提取最后一个整数
        elif value_parser == "last_integer":
            integers = re.findall(r'\d+', raw_output)
            return integers[-1] if integers else None

        # 提取最后一个单词
        elif value_parser == "last_word":
            words = raw_output.split()
            return words[-1] if words else None

        return raw_output

    @staticmethod
    def parse_snmp_output_to_list(raw_output: str) -> list[dict]:
        """将 SNMP 输出解析为列表。

        用于测试 OID 时展示所有可能的返回值。

        Args:
            raw_output: 原始输出

        Returns:
            解析后的值列表，每个元素包含 oid 和 value
        """
        results = []

        if not raw_output:
            return results

        lines = raw_output.strip().split('\n')
        for line in lines:
            if not line.strip():
                continue

            # 尝试解析格式：OID = TYPE: VALUE
            match = re.match(r'^(.+?)\s*=\s*(.+?):\s*(.+)$', line)
            if match:
                oid_str, value_type, value = match.groups()
                results.append({
                    "oid": oid_str.strip(),
                    "type": value_type.strip(),
                    "value": value.strip(),
                    "raw": line,
                })
            else:
                # 如果无法解析，保存原始行
                results.append({
                    "oid": "",
                    "type": "",
                    "value": line.strip(),
                    "raw": line,
                })

        return results

    @staticmethod
    def get_builtin_metrics() -> list[dict]:
        """获取内置的监控指标。

        Returns:
            内置指标列表
        """
        return [
            {
                "name": "CPU使用率",
                "oid": "1.3.6.1.4.1.25506.2.6.1.1.1.1.6.3",
                "description": "CPU 瞬时利用率（H3C/HP Comware）",
                "value_type": "gauge",
                "unit": "%",
                "value_parser": "regex:INTEGER:\\s*(\\d+)",
            },
            {
                "name": "内存使用率",
                "oid": "1.3.6.1.4.1.25506.2.6.1.1.1.1.8.3",
                "description": "内存瞬时利用率（H3C/HP Comware）",
                "value_type": "gauge",
                "unit": "%",
                "value_parser": "regex:INTEGER:\\s*(\\d+)",
            },
        ]
