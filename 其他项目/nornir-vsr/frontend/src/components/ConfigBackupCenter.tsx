import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Card from "./common/AntCard";
import {
  Alert,
  Button,
  DatePicker,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  ReloadOutlined,
  FileSearchOutlined,
  DownloadOutlined,
  DeleteOutlined,
  CloudServerOutlined,
} from "@ant-design/icons";
import {
  ConfigSnapshotDetail,
  ConfigSnapshotQuery,
  ConfigSnapshotSummary,
  deleteConfigSnapshot,
  deleteConfigSnapshots,
  downloadConfigSnapshot,
  fetchConfigSnapshot,
  fetchConfigSnapshots,
  fetchLatestConfigSnapshots,
} from "../api/nornir";
import FilterToolbar from "./common/FilterToolbar";
import BatchActionsBar from "./common/BatchActionsBar";
import StatusTag from "./common/StatusTag";
import { zhCNTablePaginationLocale } from "../constants/pagination";
import { useOrientation } from "../hooks/useOrientation";
import { naturalCompare } from "../utils/sort";
import { useTwoStateSort, SortOrder as TwoStateSortOrder } from "../hooks/useTwoStateSort";
import { createHighlightRules, highlightTextWithRules, type HighlightRule } from "../utils/commandHighlight";
import { createVerticalDivider } from "../styles/commonStyles";

const { Text, Paragraph, Title } = Typography;

interface ConfigBackupCenterProps {
  filterOptions: { sites: string[] };
  highlightRules?: HighlightRule[];
}

const DEFAULT_LIMIT = 1000;

const paginationLocale = zhCNTablePaginationLocale;

const historyComparators: Record<string, (a: ConfigSnapshotSummary, b: ConfigSnapshotSummary) => number> = {
  host: (a, b) => naturalCompare(a.host ?? "", b.host ?? ""),
  site: (a, b) => naturalCompare(a.site ?? "", b.site ?? ""),
  executedAt: (a, b) => naturalCompare(a.executedAt ?? "", b.executedAt ?? ""),
};

const ConfigBackupCenter = ({ filterOptions, highlightRules: providedHighlightRules }: ConfigBackupCenterProps) => {
  const { token } = theme.useToken();
  const [siteFilter, setSiteFilter] = useState<string | undefined>(undefined);
  const [searchValue, setSearchValue] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [latestSnapshots, setLatestSnapshots] = useState<ConfigSnapshotSummary[]>([]);
  const [historySnapshots, setHistorySnapshots] = useState<ConfigSnapshotSummary[]>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [modalState, setModalState] = useState<{
    open: boolean;
    loading: boolean;
    snapshot: ConfigSnapshotDetail | null;
  }>({ open: false, loading: false, snapshot: null });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const orientation = useOrientation();
  const isLandscape = orientation === "landscape";
  const historyTableTopRef = useRef<HTMLDivElement | null>(null);

  const listGrid = useMemo(
    () => ({
      gutter: isLandscape ? 16 : 12,
      column: isLandscape ? 3 : 2,
      xs: isLandscape ? 1 : 2,
      sm: isLandscape ? 2 : 2,
      md: isLandscape ? 3 : 2,
      lg: isLandscape ? 3 : 2,
      xl: isLandscape ? 3 : 2,
      xxl: isLandscape ? 4 : 3,
    }),
    [isLandscape]
  );

  const highlightRules = useMemo(
    () => providedHighlightRules ?? createHighlightRules(token),
    [providedHighlightRules, token],
  );

  const fetchParams = useCallback((): ConfigSnapshotQuery => ({
    limit: DEFAULT_LIMIT,
    site: siteFilter,
  }), [siteFilter]);

  const loadLatest = useCallback(async () => {
    try {
      setLoadingLatest(true);
      const params = fetchParams();
      const data = await fetchLatestConfigSnapshots(params);
      setLatestSnapshots(data);
    } catch (error) {
      message.error("加载最新备份失败");
    } finally {
      setLoadingLatest(false);
    }
  }, [fetchParams]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const params = fetchParams();
      const data = await fetchConfigSnapshots(params);
      setHistorySnapshots(data);
    } catch (error) {
      message.error("加载备份历史失败");
    } finally {
      setLoadingHistory(false);
    }
  }, [fetchParams]);

  useEffect(() => {
    loadLatest();
    loadHistory();
  }, [loadLatest, loadHistory, siteFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchKeyword(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const isDateMatch = useCallback(
    (executedAt?: string | null) => {
      if (!selectedDate) {
        return true;
      }
      if (!executedAt) {
        return false;
      }
      return dayjs(executedAt).isSame(selectedDate, "day");
    },
    [selectedDate],
  );

  const filteredLatest = useMemo(() => {
    const bySearch = !searchKeyword
      ? latestSnapshots
      : latestSnapshots.filter((item) => item.host.toLowerCase().includes(searchKeyword.toLowerCase()));
    return bySearch.filter((item) => isDateMatch(item.executedAt));
  }, [isDateMatch, latestSnapshots, searchKeyword]);

  const filteredHistory = useMemo(() => {
    const bySearch = !searchKeyword
      ? historySnapshots
      : historySnapshots.filter((item) => item.host.toLowerCase().includes(searchKeyword.toLowerCase()));
    return bySearch.filter((item) => isDateMatch(item.executedAt));
  }, [historySnapshots, isDateMatch, searchKeyword]);

  useEffect(() => {
    setCurrentPage(1);
  }, [siteFilter, searchKeyword, historySnapshots.length, selectedDate]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [siteFilter, searchKeyword, selectedDate]);

  const {
    sortedData: sortedHistory,
    handleChange: handleHistorySortChange,
    getSortOrderForColumn: getHistorySortOrder,
  } = useTwoStateSort<ConfigSnapshotSummary>({
    data: filteredHistory,
    comparators: historyComparators,
    defaultColumnKey: "executedAt",
  });

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedHistory.slice(start, start + pageSize);
  }, [sortedHistory, currentPage, pageSize]);

  const handleTablePaginationChange = useCallback((page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
    historyTableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleViewSnapshot = useCallback(async (snapshotId: number) => {
    try {
      setModalState({ open: true, loading: true, snapshot: null });
      const detail = await fetchConfigSnapshot(snapshotId);
      setModalState({ open: true, loading: false, snapshot: detail });
    } catch (error) {
      message.error("加载备份详情失败");
      setModalState({ open: false, loading: false, snapshot: null });
    }
  }, []);

  const handleDownloadSnapshot = useCallback(async (snapshotId: number, host: string, executedAt: string) => {
    try {
      const blob = await downloadConfigSnapshot(snapshotId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${host}-${executedAt.replace(/[^0-9]/g, "")}.cfg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      message.success("备份已下载");
    } catch (error) {
      message.error("下载备份失败");
    }
  }, []);

  const handleDeleteSnapshot = useCallback(async (snapshotId: number) => {
    try {
      setDeletingId(snapshotId);
      await deleteConfigSnapshot(snapshotId);
      message.success("备份已删除");
      await Promise.all([loadLatest(), loadHistory()]);
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail ?? "删除备份失败";
      message.error(errMsg);
    } finally {
      setDeletingId(null);
    }
  }, [loadHistory, loadLatest]);

  const selectedSnapshots = useMemo(
    () => historySnapshots.filter((item) => selectedRowKeys.includes(item.id)),
    [historySnapshots, selectedRowKeys]
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    try {
      setBatchDeleting(true);
      const deleted = await deleteConfigSnapshots(selectedRowKeys);
      message.success(`已删除 ${deleted}/${selectedRowKeys.length} 条备份`);
      setSelectedRowKeys([]);
      await Promise.all([loadLatest(), loadHistory()]);
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail ?? "批量删除失败";
      message.error(errMsg);
    } finally {
      setBatchDeleting(false);
    }
  }, [loadHistory, loadLatest, selectedRowKeys]);


  const handleBatchDownload = useCallback(async () => {
    if (selectedSnapshots.length === 0) {
      return;
    }
    try {
      setBatchDownloading(true);
      for (const snapshot of selectedSnapshots) {
        const blob = await downloadConfigSnapshot(snapshot.id);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${snapshot.host}-${snapshot.executedAt.replace(/[^0-9]/g, "")}.cfg`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
      }
      message.success(`已下载 ${selectedSnapshots.length} 个备份`);
    } catch (error) {
      message.error("批量下载失败");
    } finally {
      setBatchDownloading(false);
    }
  }, [selectedSnapshots]);

  const historyColumns: ColumnsType<ConfigSnapshotSummary> = useMemo(() => [
    {
      title: "设备",
      dataIndex: "host",
      key: "host",
      sorter: historyComparators.host,
      sortDirections: ["ascend", "descend"],
      sortOrder: getHistorySortOrder("host"),
      render: (value: string) => (
        <Text strong style={{ color: token.colorPrimary, fontSize: 14 }}>
          {value}
        </Text>
      ),
    },
    {
      title: "站点",
      dataIndex: "site",
      key: "site",
      sorter: historyComparators.site,
      sortDirections: ["ascend", "descend"],
      sortOrder: getHistorySortOrder("site"),
      render: (value: string | null | undefined) => (
        <Text style={{ fontSize: 13 }}>{value || "-"}</Text>
      ),
    },
    {
      title: "执行时间",
      dataIndex: "executedAt",
      key: "executedAt",
      sorter: historyComparators.executedAt,
      sortDirections: ["ascend", "descend"],
      sortOrder: getHistorySortOrder("executedAt"),
      render: (value: string) => (
        <Text style={{ fontSize: 13 }}>{new Date(value).toLocaleString()}</Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, record) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => handleViewSnapshot(record.id)}
            style={{
              borderRadius: token.borderRadius,
            }}
          >
            查看
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadSnapshot(record.id, record.host, record.executedAt)}
            style={{
              borderRadius: token.borderRadius,
            }}
          >
            下载
          </Button>
          <Popconfirm
            title="确定删除该备份？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteSnapshot(record.id)}
          >
            <Button
              size="small"
              danger
              loading={deletingId === record.id}
              icon={<DeleteOutlined />}
              style={{
                borderRadius: token.borderRadius,
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [deletingId, getHistorySortOrder, handleDeleteSnapshot, handleDownloadSnapshot, handleViewSnapshot, token.borderRadius, token.colorPrimary]);

  const rowSelection = useMemo(() => ({
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys.map(Number)),
    preserveSelectedRowKeys: true,
  }), [selectedRowKeys]);

  const latestCount = filteredLatest.length;
  const historyCount = filteredHistory.length;
  const selectedCount = selectedRowKeys.length;

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    historySnapshots.forEach((item) => {
      if (item.executedAt) {
        set.add(dayjs(item.executedAt).format("YYYY-MM-DD"));
      }
    });
    latestSnapshots.forEach((item) => {
      if (item.executedAt) {
        set.add(dayjs(item.executedAt).format("YYYY-MM-DD"));
      }
    });
    return set;
  }, [historySnapshots, latestSnapshots]);

  const handleDateChange = useCallback((value: Dayjs | null) => {
    setSelectedDate(value);
  }, []);

  const dateRender = useCallback(
    (current: Dayjs) => {
      const dateKey = current.format("YYYY-MM-DD");
      const isAvailable = availableDates.has(dateKey);
      const isSelected = selectedDate ? current.isSame(selectedDate, "day") : false;
      return (
        <div
          style={{
            borderRadius: 6,
            padding: 4,
            background: isSelected ? token.colorPrimaryBg ?? "#e6f4ff" : undefined,
            textAlign: "center",
          }}
        >
          <div>{current.date()}</div>
          {isAvailable ? (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isSelected
                  ? token.colorPrimary ?? "#1677ff"
                  : token.colorSuccess ?? "#52c41a",
                margin: "4px auto 0",
              }}
            />
          ) : null}
        </div>
      );
    },
    [availableDates, selectedDate, token.colorPrimary, token.colorPrimaryBg, token.colorSuccess],
  );

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedRowKeys(filteredHistory.map((item) => item.id));
  }, [filteredHistory]);

  const handleClearAllSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <FilterToolbar
          style={{ marginBottom: 16 }}
          left={
            <Space size="middle" wrap align="center">
              <StatusTag variant="success">最新 {latestCount} 条</StatusTag>
              <StatusTag variant="info">历史 {historyCount} 条</StatusTag>
              <div style={createVerticalDivider(token)} />
              <DatePicker
                allowClear
                value={selectedDate}
                onChange={handleDateChange}
                placeholder="按日期筛选"
                dateRender={dateRender}
                style={{
                  minWidth: 180,
                  borderRadius: token.borderRadius,
                }}
              />
              <Select
                allowClear
                placeholder="按站点筛选"
                value={siteFilter}
                onChange={(value: string | null) => setSiteFilter(value || undefined)}
                style={{
                  minWidth: 180,
                  borderRadius: token.borderRadius,
                }}
                options={filterOptions.sites.map((site) => ({ label: site, value: site }))}
                optionFilterProp="label"
                showSearch
              />
              <Input.Search
                id="config-backup-search"
                name="config-backup-search"
                allowClear
                value={searchValue}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchValue(event.target.value)}
                placeholder="搜索设备名称"
                style={{
                  width: 240,
                  borderRadius: token.borderRadius,
                }}
              />
            </Space>
          }
          right={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                loadLatest();
                loadHistory();
              }}
              loading={loadingLatest || loadingHistory}
            >
              刷新
            </Button>
          }
        />
        <Tabs
          activeKey={activeTab}
          onChange={(key: string) => setActiveTab(key as "overview" | "history")}
          destroyOnHidden
          items={[
              {
                key: "overview",
                label: "最新备份",
                children: (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setActiveTab("history")}
                      style={{
                        paddingLeft: 0,
                        fontWeight: 500,
                      }}
                    >
                      查看备份历史表格 →
                    </Button>
                    <List
                      loading={loadingLatest}
                      grid={listGrid}
                      dataSource={filteredLatest}
                      locale={{ emptyText: <Text type="secondary">暂无备份记录</Text> }}
                      style={{ marginTop: 8 }}
                      renderItem={(item: ConfigSnapshotSummary) => (
                        <List.Item key={item.id}>
                          <Card
                            size="small"
                            style={{
                              height: "100%",
                              background: token.colorBgContainer,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              border: `1px solid ${token.colorBorderSecondary}`,
                              borderRadius: token.borderRadiusLG,
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                            styles={{
                              body: {
                                display: "flex",
                                flexDirection: "column",
                                gap: isLandscape ? 8 : 6,
                                padding: isLandscape ? 16 : 12,
                              }
                            }}
                            onMouseEnter={(e: ReactMouseEvent<HTMLDivElement>) => {
                              e.currentTarget.style.transform = 'translateY(-4px)';
                              e.currentTarget.style.boxShadow = `0 6px 16px rgba(0,0,0,0.12)`;
                              e.currentTarget.style.borderColor = token.colorPrimary;
                            }}
                            onMouseLeave={(e: ReactMouseEvent<HTMLDivElement>) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                              e.currentTarget.style.borderColor = token.colorBorderSecondary;
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: `linear-gradient(90deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                              }}
                            />
                            <Space size="small" align="center" wrap>
                              <Title level={5} style={{ margin: 0, color: token.colorText }}>
                                {item.host}
                              </Title>
                              <StatusTag variant="info">最新备份</StatusTag>
                              {item.filePath && <StatusTag variant="info">已归档</StatusTag>}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              执行时间：{new Date(item.executedAt).toLocaleString()}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              站点：{item.site || "-"}
                            </Text>
                            {item.filePath && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                文件：{item.filePath}
                              </Text>
                            )}
                            <Space size="small" wrap style={{ marginTop: 4 }}>
                              <Button
                                size="small"
                                icon={<FileSearchOutlined />}
                                onClick={() => handleViewSnapshot(item.id)}
                                style={{
                                  borderRadius: token.borderRadius,
                                }}
                              >
                                查看
                              </Button>
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownloadSnapshot(item.id, item.host, item.executedAt)}
                                style={{
                                  borderRadius: token.borderRadius,
                                }}
                              >
                                下载
                              </Button>
                            </Space>
                          </Card>
                        </List.Item>
                      )}
                    />
                  </Space>
                ),
              },
              {
                key: "history",
                label: "备份历史",
                children: (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Alert
                      type="info"
                      showIcon
                      message="历史备份仅展示最近记录，可通过搜索和站点筛选快速定位目标设备。"
                      style={{
                        borderRadius: token.borderRadiusLG,
                        border: `1px solid ${token.colorInfoBorder}`,
                      }}
                    />
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorBgLayout} 100%)`,
                        borderRadius: token.borderRadiusLG,
                        padding: '16px',
                        border: `1px solid ${token.colorBorderSecondary}`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      }}
                    >
                      <BatchActionsBar>
                        <Space size="small" wrap>
                          <StatusTag variant={selectedCount > 0 ? "success" : "neutral"}>
                            已选 {selectedCount} 条
                          </StatusTag>
                          <Button
                            onClick={handleSelectAllFiltered}
                            disabled={filteredHistory.length === 0 || selectedRowKeys.length === filteredHistory.length}
                            style={{ borderRadius: token.borderRadius }}
                          >
                            全选筛选 ({filteredHistory.length})
                          </Button>
                          <Button
                            onClick={handleClearAllSelection}
                            disabled={selectedRowKeys.length === 0}
                            style={{ borderRadius: token.borderRadius }}
                          >
                            清空选择
                          </Button>
                          <Button
                            type="primary"
                            ghost
                            icon={<DownloadOutlined />}
                            disabled={selectedSnapshots.length === 0}
                            loading={batchDownloading}
                            onClick={handleBatchDownload}
                            style={{ borderRadius: token.borderRadius }}
                          >
                            批量下载 ({selectedSnapshots.length})
                          </Button>
                          {selectedRowKeys.length === 0 ? (
                            <Tooltip title="请选择至少一条备份" placement="top">
                              <span>
                                <Button
                                  danger
                                  disabled
                                  icon={<DeleteOutlined />}
                                  style={{ borderRadius: token.borderRadius }}
                                >
                                  批量删除 (0)
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                            <Popconfirm
                              title={`确定删除选中的 ${selectedRowKeys.length} 条备份？`}
                              onConfirm={handleBatchDelete}
                              okText="删除"
                              cancelText="取消"
                            >
                              <Button
                                danger
                                loading={batchDeleting}
                                icon={<DeleteOutlined />}
                                style={{ borderRadius: token.borderRadius }}
                              >
                                批量删除 ({selectedRowKeys.length})
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      </BatchActionsBar>
                    </div>
                    <div ref={historyTableTopRef} />
                    <Table<ConfigSnapshotSummary>
                      rowKey={(record: ConfigSnapshotSummary) => record.id}
                      loading={loadingHistory}
                      dataSource={paginatedHistory}
                      columns={historyColumns}
                      showSorterTooltip={false}
                      onChange={(
                        _pagination: any,
                        _filters: any,
                        sorter: SorterResult<ConfigSnapshotSummary> | SorterResult<ConfigSnapshotSummary>[],
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
                        handleHistorySortChange(columnKey, normalizedOrder);
                        historyTableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      rowSelection={rowSelection}
                      pagination={{
                        current: currentPage,
                        pageSize,
                        total: filteredHistory.length,
                        showSizeChanger: true,
                        pageSizeOptions: [20, 50, 200, 500, 1000],
                        onChange: handleTablePaginationChange,
                        showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条备份`,
                        locale: paginationLocale,
                        ...( { selectProps: { showSearch: false } } as any ),
                      }}
                      size="small"
                      style={{
                        borderRadius: token.borderRadiusLG,
                      }}
                    />
                  </Space>
                ),
              },
            ]}
          />
      </Card>

      <Modal
        open={modalState.open}
        title={
          <Space align="center">
            <CloudServerOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>
              {modalState.snapshot ? `配置备份 - ${modalState.snapshot.host}` : "配置备份"}
            </Text>
          </Space>
        }
        onCancel={() => setModalState({ open: false, loading: false, snapshot: null })}
        footer={null}
        width={900}
        destroyOnHidden
        styles={{
          header: {
            background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%)`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: '16px 24px',
            borderRadius: `${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0`,
          },
          body: {
            padding: '24px',
            maxHeight: '70vh',
            overflowY: 'auto',
          },
        }}
      >
        {modalState.loading ? (
          <div style={{
            textAlign: "center",
            padding: 48,
            color: token.colorTextSecondary,
          }}>
            <Text>加载中...</Text>
          </div>
        ) : modalState.snapshot ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div
              style={{
                background: token.colorBgLayout,
                borderRadius: token.borderRadiusLG,
                padding: '12px 16px',
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Space size="large" wrap>
                <Text type="secondary">
                  执行时间：{new Date(modalState.snapshot.executedAt).toLocaleString()}
                </Text>
                {modalState.snapshot.filePath && (
                  <Text type="secondary">文件：{modalState.snapshot.filePath}</Text>
                )}
              </Space>
            </div>
            <div
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusLG,
                padding: '16px',
                maxHeight: '50vh',
                overflowY: 'auto',
              }}
            >
              <Paragraph
                copyable={{ text: modalState.snapshot.content ?? "" }}
                style={{
                  whiteSpace: "pre-wrap",
                  marginBottom: 0,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {highlightTextWithRules(modalState.snapshot.content ?? "", highlightRules)}
              </Paragraph>
            </div>
          </Space>
        ) : (
          <div style={{
            textAlign: "center",
            padding: 48,
          }}>
            <Text type="secondary">未找到备份内容</Text>
          </div>
        )}
      </Modal>
    </Space>
  );
};

export default ConfigBackupCenter;
