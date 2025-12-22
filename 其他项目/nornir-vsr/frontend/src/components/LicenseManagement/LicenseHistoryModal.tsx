import { memo } from "react";
import { Button, Modal, Popconfirm, Table, Typography } from "antd";
import type { SorterResult } from "antd/es/table/interface";
import type { TableProps } from "antd";

import type { LicenseRecord } from "../../api/license";
import { SortOrder as TwoStateSortOrder } from "../../hooks/useTwoStateSort";
import { formatRecordDate, licenseRecordComparators } from "./constants";
import StatusTag from "../common/StatusTag";

const { Link, Text } = Typography;

interface LicenseHistoryModalProps {
  visible: boolean;
  host: string | null;
  records: LicenseRecord[];
  loading: boolean;
  getSortOrderForColumn: (columnKey?: string) => TwoStateSortOrder | undefined;
  onSortChange: (columnKey: string | undefined, order: TwoStateSortOrder | undefined) => void;
  onClose: () => void;
  onPreview: (record: LicenseRecord, type: "did" | "ak") => void;
  onDeleteRecord: (recordId: number, hostName: string) => void;
  scrollToTop: () => void;
}

const LicenseHistoryModal = memo(({
  visible,
  host,
  records,
  loading,
  getSortOrderForColumn,
  onSortChange,
  onClose,
  onPreview,
  onDeleteRecord,
  scrollToTop,
}: LicenseHistoryModalProps) => {
  const columns: TableProps<LicenseRecord>["columns"] = [
    {
      title: "主机名",
      dataIndex: "host_name",
      key: "host_name",
      sorter: licenseRecordComparators.host_name,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("host_name"),
      render: (text: string) => (
        <Text strong ellipsis={{ tooltip: text }} style={{ display: "inline-block", maxWidth: "100%" }}>
          {text}
        </Text>
      ),
    },
    {
      title: ".did 文件",
      dataIndex: "did_filename",
      key: "did_filename",
      render: (text: string | null | undefined, record) =>
        text ? <Link onClick={() => onPreview(record, "did")}>{text}</Link> : "-",
    },
    {
      title: ".ak 文件",
      dataIndex: "ak_filename",
      key: "ak_filename",
      render: (text: string | null | undefined, record) =>
        text ? <Link onClick={() => onPreview(record, "ak")}>{text}</Link> : "-",
    },
    {
      title: "License SN",
      dataIndex: "license_sn",
      key: "license_sn",
      sorter: licenseRecordComparators.license_sn,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("license_sn"),
      render: (text: string | null | undefined) => text || "-",
    },
    {
      title: "License Key",
      dataIndex: "license_key",
      key: "license_key",
      sorter: licenseRecordComparators.license_key,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("license_key"),
      render: (text: string | null | undefined) => (
        <Text ellipsis={{ tooltip: text || "-" }} style={{ display: "inline-block", maxWidth: 220 }}>
          {text || "-"}
        </Text>
      ),
    },
    {
      title: "AK文件创建时间",
      dataIndex: "file_creation_time",
      key: "file_creation_time",
      sorter: licenseRecordComparators.file_creation_time,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("file_creation_time"),
      render: (text: string | null | undefined) => text || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      sorter: licenseRecordComparators.status,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("status"),
      render: (text: string | null | undefined) => {
        if (!text) {
          return <StatusTag variant="neutral">未知</StatusTag>;
        }
        const normalized = text.trim();
        const variant = normalized === "成功" || normalized === "In use"
          ? "success"
          : normalized === "失败"
            ? "error"
            : "info";
        return <StatusTag variant={variant}>{normalized}</StatusTag>;
      },
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      sorter: licenseRecordComparators.updated_at,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("updated_at"),
      render: (text: string | null | undefined) => formatRecordDate(text),
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Popconfirm
          title="确定删除该许可证记录吗？"
          onConfirm={() => onDeleteRecord(record.id, record.host_name)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" danger size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={host ? `许可证记录 - ${host}` : "许可证记录"}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading && visible}
        showSorterTooltip={false}
        onChange={(
          _pagination: any,
          _filters: any,
          sorter: SorterResult<LicenseRecord> | SorterResult<LicenseRecord>[],
          extra: { action?: string }
        ) => {
          if (extra?.action !== "sort") {
            return;
          }
          const result = Array.isArray(sorter) ? sorter[0] : sorter;
          const columnKey = result?.columnKey ? String(result.columnKey) : undefined;
          const order = result?.order;
          const normalizedOrder: TwoStateSortOrder | undefined =
            order === "ascend" || order === "descend" ? order : undefined;
          onSortChange(columnKey, normalizedOrder);
          scrollToTop();
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 200],
          ...( { selectProps: { showSearch: false } } as any ),
          onChange: () => scrollToTop(),
        }}
        size="small"
        scroll={{ x: "max-content" }}
      />
    </Modal>
  );
});

export default LicenseHistoryModal;
