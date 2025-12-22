import { memo, useMemo, useRef } from "react";
import { Button, Popconfirm, Space, Table, Tooltip, Typography, theme } from "antd";
import { CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import type { TableProps } from "antd";

import type { LicenseOverview } from "../../api/license";
import { zhCNTablePaginationLocale } from "../../constants/pagination";
import { SortOrder as TwoStateSortOrder } from "../../hooks/useTwoStateSort";
import {
  getLicenseStatusColor,
  getLicenseStatusIcon,
  getLicenseStatusText,
  hostHasPermanentLicense,
  licenseComparators,
  sortLicenses,
} from "./constants";
import StatusTag from "../common/StatusTag";
import { createRoundedButtonStyle, createTableStyle } from "../../styles/commonStyles";

const { Text } = Typography;

interface LicenseOverviewTableProps {
  data: LicenseOverview[];
  isMobile: boolean;
  getSortOrderForColumn: (columnKey?: string) => TwoStateSortOrder | undefined;
  onSortChange: (columnKey: string | undefined, order: TwoStateSortOrder | undefined) => void;
  onShowHistory: (record: LicenseOverview) => void;
  onDeleteSnapshot: (hostName: string) => void;
  onPageChange: () => void;
}

const LicenseOverviewTable = memo(({
  data,
  isMobile,
  getSortOrderForColumn,
  onSortChange,
  onShowHistory,
  onDeleteSnapshot,
  onPageChange,
}: LicenseOverviewTableProps) => {
  const { token } = theme.useToken();
  const actionButtonStyle = useMemo(() => createRoundedButtonStyle(token), [token]);
  const tableStyle = useMemo(() => createTableStyle(token), [token]);
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  const columns: TableProps<LicenseOverview>["columns"] = useMemo(
    () => [
      {
        title: "主机名",
        dataIndex: "host_name",
        key: "host_name",
        sorter: licenseComparators.host_name,
        sortDirections: ["ascend", "descend"],
        sortOrder: getSortOrderForColumn("host_name"),
        render: (text: string) => (
          <Text strong ellipsis={{ tooltip: text }} style={{ display: "inline-block", maxWidth: "100%" }}>
            {text}
          </Text>
        ),
      },
      {
        title: "站点",
        dataIndex: "site",
        key: "site",
        sorter: licenseComparators.site,
        sortDirections: ["ascend", "descend"],
        sortOrder: getSortOrderForColumn("site"),
        render: (text: string | null | undefined) => (
          <Text ellipsis={{ tooltip: text || "-" }} style={{ display: "inline-block", maxWidth: "100%" }}>
            {text || "-"}
          </Text>
        ),
      },
      {
        title: "许可证状态",
        key: "licenses",
        sorter: licenseComparators.licenses,
        sortDirections: ["ascend", "descend"],
        sortOrder: getSortOrderForColumn("licenses"),
        render: (_: unknown, record: LicenseOverview) => {
          if (record.licenses.length === 0) {
            return <StatusTag variant="error">无许可证</StatusTag>;
          }
          const hasPermanent = hostHasPermanentLicense(record);
          const sortedLicenses = sortLicenses(record.licenses);
          return (
            <Space direction="vertical" size="small">
              <StatusTag
                variant={hasPermanent ? "success" : "warning"}
                icon={hasPermanent ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              >
                {hasPermanent ? "永久授权" : "非永久授权"}
              </StatusTag>
              {sortedLicenses.map((license) => (
                <Tooltip
                  key={license.file_name}
                  title={
                    <span>
                      文件：{license.file_name}
                      <br />类型：{license.license_type || "未知"}
                      <br />状态：{license.current_state || "未知"}
                      {license.time_left_days ? <><br />剩余时间：{license.time_left_days} 天</> : null}
                      {license.trial_time_left_days ? <><br />试用剩余：{license.trial_time_left_days} 天</> : null}
                    </span>
                  }
                >
                  <StatusTag variant={getLicenseStatusColor(license)} icon={getLicenseStatusIcon(license)}>
                    {license.file_name} · {getLicenseStatusText(license)}
                  </StatusTag>
                </Tooltip>
              ))}
            </Space>
          );
        },
      },
      {
        title: "操作",
        key: "actions",
        fixed: isMobile ? "right" : undefined,
        render: (_, record) => (
          <Space size="small">
            <Button
              size="small"
              type="link"
              onClick={() => onShowHistory(record)}
              style={actionButtonStyle}
            >
              详细信息
            </Button>
            <Popconfirm
              title="确定删除该主机的许可证状态吗？"
              description="删除后将无法恢复，需要重新刷新获取"
              onConfirm={() => onDeleteSnapshot(record.host_name)}
              okText="删除"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                size="small"
                style={actionButtonStyle}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [getSortOrderForColumn, isMobile, onDeleteSnapshot, onShowHistory],
  );

  return (
    <>
    <div ref={tableTopRef} />
    <Table
      rowKey={(record: LicenseOverview) => record.host_name || `${record.site ?? "unknown"}`}
      columns={columns}
      dataSource={data}
      showSorterTooltip={false}
      style={tableStyle}
      pagination={{
        defaultPageSize: 20,
        showSizeChanger: true,
        pageSizeOptions: [20, 50, 200],
        locale: zhCNTablePaginationLocale,
        showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        onChange: (...args) => {
          tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          onPageChange();
        },
        ...( { selectProps: { showSearch: false } } as any ),
      }}
      scroll={{ x: "max-content" }}
      onChange={(_pagination: any, _filters: any, sorter: any, extra: { action?: string }) => {
        if (extra?.action === "sort") {
          const result = Array.isArray(sorter) ? sorter[0] : sorter;
          const columnKey = result?.columnKey ? String(result.columnKey) : undefined;
          const order = result?.order;
          const normalizedOrder: TwoStateSortOrder | undefined =
            order === "ascend" || order === "descend" ? order : undefined;
          onSortChange(columnKey, normalizedOrder);
          tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
      size="small"
    />
    </>
  );
});

export default LicenseOverviewTable;
