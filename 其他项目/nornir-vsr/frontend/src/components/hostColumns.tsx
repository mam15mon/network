import { Button, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { SortOrder as AntdSortOrder } from "antd/es/table/interface";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  LaptopOutlined,
} from "@ant-design/icons";
import { Popconfirm } from "antd";
import type { Host } from "../api/hosts";
import { naturalCompare } from "../utils/sort";

const { Text } = Typography;

interface ParsedCidr {
  network: number;
  prefix: number;
}

const normalize = (value?: string | number | null) => String(value ?? "").trim();

const parseCidr = (value?: string | null): ParsedCidr | null => {
  if (!value) {
    return null;
  }
  const [first] = value.split(",");
  const trimmed = first.trim();
  const [ipPart, prefixPart] = trimmed.split("/");
  if (!ipPart) {
    return null;
  }
  const octets = ipPart.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  const prefix = prefixPart ? Number(prefixPart) : 32;
  if (Number.isNaN(prefix)) {
    return null;
  }
  const network = (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256) + octets[3];
  return { network, prefix };
};

const compareCidr = (left?: string | null, right?: string | null): number => {
  const a = parseCidr(left);
  const b = parseCidr(right);
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  if (a.network !== b.network) {
    return a.network - b.network;
  }
  if (a.prefix !== b.prefix) {
    return a.prefix - b.prefix;
  }
  return naturalCompare(left ?? "", right ?? "");
};

const compareStrings = (left?: string | null, right?: string | null) => {
  const a = normalize(left);
  const b = normalize(right);
  const aEmpty = a.length === 0;
  const bEmpty = b.length === 0;
  if (aEmpty && bEmpty) {
    return 0;
  }
  if (aEmpty) {
    return 1;
  }
  if (bEmpty) {
    return -1;
  }
  return naturalCompare(a, b);
};

const parseNumber = (value?: number | string | null) => {
  const normalized = normalize(value);
  if (normalized.length === 0) {
    return Number.NaN;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const compareNumbers = (left?: number | string | null, right?: number | string | null) => {
  const a = parseNumber(left);
  const b = parseNumber(right);
  if (Number.isNaN(a) && Number.isNaN(b)) {
    return 0;
  }
  if (Number.isNaN(a)) {
    return 1;
  }
  if (Number.isNaN(b)) {
    return -1;
  }
  return a - b;
};

export const hostComparators: Record<string, (a: Host, b: Host) => number> = {
  name: (a, b) => compareStrings(a.name, b.name),
  hostname: (a, b) => compareStrings(a.hostname, b.hostname),
  platform: (a, b) => compareStrings(a.platform, b.platform),
  username: (a, b) => compareStrings(a.username, b.username),
  password: (a, b) => compareStrings(a.password, b.password),
  port: (a, b) => compareNumbers(a.port, b.port),
  site: (a, b) => compareStrings(a.site, b.site),
  device_type: (a, b) => compareStrings(a.device_type, b.device_type),
  device_model: (a, b) => compareStrings(a.device_model, b.device_model),
  address_pool: (a, b) => compareCidr(a.address_pool, b.address_pool),
  ppp_auth_mode: (a, b) => compareStrings(a.ppp_auth_mode, b.ppp_auth_mode),
  snmp_version: (a, b) => compareStrings(a.snmp_version, b.snmp_version),
  snmp_community: (a, b) => compareStrings(a.snmp_community, b.snmp_community),
  snmp_port: (a, b) => compareNumbers(a.snmp_port, b.snmp_port),
};

const renderPlatformValue = (value?: string) => {
  const normalized = (value || "").toLowerCase();
  if (!value || normalized === "hp_comware") {
    return "hp_comware";
  }
  return value;
};

export interface HostColumnBuilderOptions {
  getSortOrderForColumn?: (key: string) => AntdSortOrder | undefined;
  onTogglePassword?: (name: string) => void;
  visiblePasswords?: Record<string, boolean>;
  includeActions?: boolean;
  onEdit?: (host: Host) => void;
  onDelete?: (host: Host) => void;
  onOpenTerminal?: (host: Host) => void;
  isMobile?: boolean;
}

const withSortProps = (
  key: keyof typeof hostComparators,
  getSortOrderForColumn?: HostColumnBuilderOptions["getSortOrderForColumn"],
) => ({
  sorter: hostComparators[key],
  sortDirections: ["ascend", "descend"] as Array<"ascend" | "descend">,
  sortOrder: getSortOrderForColumn ? getSortOrderForColumn(key) : undefined,
});

export const buildHostColumns = (options: HostColumnBuilderOptions = {}): ColumnsType<Host> => {
  const {
    getSortOrderForColumn,
    onTogglePassword,
    visiblePasswords = {},
    includeActions,
    onEdit,
    onDelete,
    onOpenTerminal,
    isMobile,
  } = options;

  const baseColumns: ColumnsType<Host> = [
    {
      title: "设备名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      ...withSortProps("name", getSortOrderForColumn),
      render: (text: string) => (
        <Text
          strong
          ellipsis={{ tooltip: text }}
          style={{
            display: "inline-block",
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {text}
        </Text>
      ),
    },
    {
      title: "地址",
      dataIndex: "hostname",
      key: "hostname",
      ellipsis: true,
      ...withSortProps("hostname", getSortOrderForColumn),
    },
    {
      title: "平台",
      dataIndex: "platform",
      key: "platform",
      ellipsis: true,
      ...withSortProps("platform", getSortOrderForColumn),
      render: (value?: string) => renderPlatformValue(value),
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      ellipsis: true,
      ...withSortProps("username", getSortOrderForColumn),
    },
    {
      title: "密码",
      dataIndex: "password",
      key: "password",
      ellipsis: true,
      ...withSortProps("password", getSortOrderForColumn),
      render: (_: string | undefined, record: Host) => {
        if (!record.password) {
          return "-";
        }
        const isVisible = Boolean(visiblePasswords[record.name]);
        if (!onTogglePassword) {
          return <Text>{isVisible ? record.password : "••••••"}</Text>;
        }
        return (
          <Space size="small">
            <Text>{isVisible ? record.password : "••••••"}</Text>
            <Button
              type="text"
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                onTogglePassword(record.name);
              }}
            />
          </Space>
        );
      },
    },
    {
      title: "端口",
      dataIndex: "port",
      key: "port",
      ellipsis: true,
      align: "right",
      ...withSortProps("port", getSortOrderForColumn),
    },
    {
      title: "SNMP 版本",
      dataIndex: "snmp_version",
      key: "snmp_version",
      ellipsis: true,
      ...withSortProps("snmp_version", getSortOrderForColumn),
      render: (value?: string) => value || "-",
    },
    {
      title: "SNMP 团体字",
      dataIndex: "snmp_community",
      key: "snmp_community",
      ellipsis: true,
      ...withSortProps("snmp_community", getSortOrderForColumn),
      render: (value?: string) => (value ? value : "-"),
    },
    {
      title: "SNMP 端口",
      dataIndex: "snmp_port",
      key: "snmp_port",
      ellipsis: true,
      align: "right",
      ...withSortProps("snmp_port", getSortOrderForColumn),
      render: (value?: number) => (typeof value === "number" ? value : "-"),
    },
    {
      title: "站点",
      dataIndex: "site",
      key: "site",
      ellipsis: true,
      ...withSortProps("site", getSortOrderForColumn),
    },
    {
      title: "设备类型",
      dataIndex: "device_type",
      key: "device_type",
      ellipsis: true,
      ...withSortProps("device_type", getSortOrderForColumn),
    },
    {
      title: "设备型号",
      dataIndex: "device_model",
      key: "device_model",
      ellipsis: true,
      ...withSortProps("device_model", getSortOrderForColumn),
    },
    {
      title: "地址池",
      dataIndex: "address_pool",
      key: "address_pool",
      ellipsis: true,
      ...withSortProps("address_pool", getSortOrderForColumn),
    },
    {
      title: "PPP认证模式",
      dataIndex: "ppp_auth_mode",
      key: "ppp_auth_mode",
      ellipsis: true,
      ...withSortProps("ppp_auth_mode", getSortOrderForColumn),
    },
  ];

  if (!includeActions) {
    return baseColumns;
  }

  return [
    ...baseColumns,
    {
      title: "操作",
      key: "actions",
      fixed: isMobile ? "right" : undefined,
      render: (_: any, record: Host) => (
        <Space size="small">
          <Button
            type="link"
            icon={<LaptopOutlined />}
            onClick={() => onOpenTerminal?.(record)}
            size="small"
          >
            终端
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => onEdit?.(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该设备吗？"
            onConfirm={() => onDelete?.(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
};
