import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import {
  Button,
  message,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";

import BatchActionsBar from "../common/BatchActionsBar";
import { naturalCompare } from "../../utils/sort";
import { zhCNTablePaginationLocale } from "../../constants/pagination";
import { useTwoStateSort, SortOrder as TwoStateSortOrder } from "../../hooks/useTwoStateSort";

import type { HistoryRecord } from "./types";
import { STORAGE_KEYS } from "./constants";
import StatusTag from "../common/StatusTag";
import { createRoundedButtonStyle, createTableStyle } from "../../styles/commonStyles";

const { Paragraph, Text } = Typography;

interface CommandHistoryTabProps {
  records: HistoryRecord[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onShowOutput: (record: HistoryRecord) => void;
  onPreviewSnapshot: (snapshotId: number) => void;
  onDownloadSnapshot: (snapshotId: number, host: string, executedAt: string) => void;
  onDeleteRecord: (record: HistoryRecord) => Promise<void>;
  onBatchDeleteRecords: (logIds: number[]) => Promise<void>;
}

const historyComparators = {
  executedAt: (a: HistoryRecord, b: HistoryRecord) =>
    new Date(a.executedAt ?? 0).getTime() - new Date(b.executedAt ?? 0).getTime(),
  host: (a: HistoryRecord, b: HistoryRecord) => naturalCompare(a.host ?? "", b.host ?? ""),
  commandType: (a: HistoryRecord, b: HistoryRecord) => naturalCompare(a.commandType ?? "", b.commandType ?? ""),
  command: (a: HistoryRecord, b: HistoryRecord) => naturalCompare(a.command ?? "", b.command ?? ""),
};

const CommandHistoryTab = ({
  records,
  loading,
  onRefresh,
  onShowOutput,
  onPreviewSnapshot,
  onDownloadSnapshot,
  onDeleteRecord,
  onBatchDeleteRecords,
}: CommandHistoryTabProps) => {
  const { token } = theme.useToken();
  const actionButtonStyle = useMemo(() => createRoundedButtonStyle(token), [token]);
  const tableStyle = useMemo(() => createTableStyle(token), [token]);
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failure" | "exception">(() => {
    if (typeof window === "undefined") {
      return "all";
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.historyFilter);
    return stored === "success" || stored === "failure" || stored === "exception" ? stored : "all";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.historyFilter, statusFilter);
    }
  }, [statusFilter]);

  const {
    sortedData,
    handleChange: handleSortChange,
    getSortOrderForColumn,
  } = useTwoStateSort<HistoryRecord>({
    data: records,
    comparators: historyComparators,
    defaultColumnKey: "executedAt",
  });

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") {
      return sortedData;
    }
    if (statusFilter === "exception") {
      return sortedData.filter((item) => Boolean(item.exception));
    }
    const shouldFail = statusFilter === "failure";
    return sortedData.filter((item) => Boolean(item.failed) === shouldFail);
  }, [sortedData, statusFilter]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    const validKeys = new Set(records.filter((item) => item.logId).map((item) => String(item.logId)));
    setSelectedRowKeys((prev) => prev.filter((key) => validKeys.has(String(key))));
  }, [records]);

  const handleDelete = async (record: HistoryRecord) => {
    if (!record.logId) {
      message.warning("该记录无法删除");
      return;
    }
    await onDeleteRecord(record);
  };

  const handleBatchDelete = async () => {
    const ids = selectedRowKeys
      .map((key) => Number(key))
      .filter((value) => !Number.isNaN(value));
    if (ids.length === 0) {
      message.info("请选择需要删除的记录");
      return;
    }
    setBatchDeleting(true);
    try {
      await onBatchDeleteRecords(ids);
      setSelectedRowKeys([]);
    } finally {
      setBatchDeleting(false);
    }
  };

  const columns: ColumnsType<HistoryRecord> = [
    {
      title: "执行时间",
      dataIndex: "executedAt",
      key: "executedAt",
      sorter: historyComparators.executedAt,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("executedAt"),
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "设备",
      dataIndex: "host",
      key: "host",
      sorter: historyComparators.host,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("host"),
      render: (value: string) => (
        <Text ellipsis={{ tooltip: value }} style={{ display: "inline-block", maxWidth: "100%" }}>
          {value}
        </Text>
      ),
    },
    {
      title: "命令类型",
      dataIndex: "commandType",
      key: "commandType",
      sorter: historyComparators.commandType,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("commandType"),
      render: (value: HistoryRecord["commandType"]) => (
        <StatusTag variant={value === "config" || value === "config_download" ? "info" : "neutral"}>
          {value}
        </StatusTag>
      ),
    },
    {
      title: "命令",
      dataIndex: "command",
      key: "command",
      sorter: historyComparators.command,
      sortDirections: ["ascend", "descend"],
      sortOrder: getSortOrderForColumn("command"),
      render: (value: string) => (
        <div style={{ overflowX: "auto" }}>
          <Paragraph copyable style={{ marginBottom: 0, whiteSpace: "pre", wordBreak: "keep-all" }}>
            {value || "(自动)"}
          </Paragraph>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "failed",
      key: "failed",
      render: (_: boolean, record: HistoryRecord) => (
        <StatusTag variant={record.failed ? "error" : "success"}>
          {record.failed ? "失败" : "成功"}
        </StatusTag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record: HistoryRecord) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => onShowOutput(record)}>
            查看输出
          </Button>
          {record.snapshotId ? (
            <>
              <Button size="small" onClick={() => onPreviewSnapshot(record.snapshotId!)}>
                查看快照
              </Button>
              <Button size="small" onClick={() => onDownloadSnapshot(record.snapshotId!, record.host, record.executedAt)}>
                下载
              </Button>
            </>
          ) : null}
          {record.logId ? (
            <Popconfirm title="确定删除该记录？" onConfirm={() => handleDelete(record)} okText="删除" cancelText="取消">
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space size="small" wrap align="center">
        <Button
          type="text"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
          style={actionButtonStyle}
        >
          刷新
        </Button>
        <Segmented
          size="small"
          options={[
            { label: "全部", value: "all" },
            { label: "成功", value: "success" },
            { label: "失败", value: "failure" },
            { label: "异常", value: "exception" },
          ]}
          value={statusFilter}
          onChange={(value: "all" | "success" | "failure" | "exception") => setStatusFilter(value)}
        />
      </Space>

      <BatchActionsBar>
        <Popconfirm
          title="确定批量删除所选记录？"
          onConfirm={handleBatchDelete}
          okText="删除"
          cancelText="取消"
          disabled={selectedRowKeys.length === 0}
        >
          <Button
            danger
            loading={batchDeleting}
            disabled={selectedRowKeys.length === 0}
            style={actionButtonStyle}
          >
            批量删除 ({selectedRowKeys.length})
          </Button>
        </Popconfirm>
      </BatchActionsBar>

      <div ref={tableTopRef} />
      <Table
        size="small"
        columns={columns}
        dataSource={filteredRecords}
        loading={loading}
        showSorterTooltip={false}
        style={tableStyle}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: Key[]) => setSelectedRowKeys(keys),
          getCheckboxProps: (record: HistoryRecord) => ({ disabled: !record.logId }),
        }}
        onChange={(
          _pagination: any,
          _filters: any,
          sorter: SorterResult<HistoryRecord> | SorterResult<HistoryRecord>[],
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
          handleSortChange(columnKey, normalizedOrder);
          tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 200],
          locale: zhCNTablePaginationLocale,
          onChange: () => tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          ...( { selectProps: { showSearch: false } } as any ),
        }}
        locale={{ emptyText: "暂无历史记录" }}
        scroll={{ x: "max-content" }}
        rowKey={(record: HistoryRecord) => record.key}
      />
    </Space>
  );
};

export default memo(CommandHistoryTab);
