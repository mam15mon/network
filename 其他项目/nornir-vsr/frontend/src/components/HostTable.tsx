import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Popconfirm,
  Typography,
  Upload,
  Modal,
  Pagination,
  Grid,
  Checkbox,
  Popover,
  message,
  theme,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlusOutlined,
  ColumnHeightOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { SortOrder as AntdSortOrder, SorterResult, TableRowSelection } from "antd/es/table/interface";
import type { Host } from "../api/hosts";
import type { HostFilters } from "../hooks/useHosts";
import FilterToolbar from "./common/FilterToolbar";
import StatusTag from "./common/StatusTag";
import { zhCNTablePaginationLocale } from "../constants/pagination";
import { useTwoStateSort, SortOrder as TwoStateSortOrder, type SortState } from "../hooks/useTwoStateSort";
import { buildHostColumns, hostComparators } from "./hostColumns";
import { createVerticalDivider } from "../styles/commonStyles";

const { Text } = Typography;
const { Search } = Input;

const COLUMN_STORAGE_KEY = "hostTable.visibleColumns";
const paginationLocale = zhCNTablePaginationLocale;

type HostTableColumn = ColumnsType<Host>[number] & {
  key: string;
  title: string;
};

interface HostTableProps {
  hosts: Host[];
  loading: boolean;
  syncing: boolean;
  selected: string[];
  onSelectionChange: (keys: string[]) => void;
  onAdd: () => void;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
  onBatchDelete: () => void | Promise<void>;
  onImport: (file: File) => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onSyncAddressPools: () => void | Promise<void>;
  onOpenTerminal: (host: Host) => void;
  filters: HostFilters;
  onFiltersChange: (filters: HostFilters) => void | Promise<void>;
  filterOptions: FilterOptions;
  search: string;
  onSearch: (value: string) => void | Promise<void>;
  sortState?: SortState;
  onSortStateChange?: (state: SortState) => void;
}

interface FilterOptions {
  sites: string[];
}

const HostTable = ({
  hosts,
  loading,
  syncing,
  selected,
  onSelectionChange,
  onAdd,
  onEdit,
  onDelete,
  onBatchDelete,
  onImport,
  onExport,
  onSyncAddressPools,
  onOpenTerminal,
  filters,
  onFiltersChange,
  filterOptions,
  search,
  onSearch,
  sortState,
  onSortStateChange,
}: HostTableProps) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [localSearch, setLocalSearch] = useState(search);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFileList, setImportFileList] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter((item): item is string => typeof item === "string");
          }
        } catch (error) {
          /* ignore corrupted storage */
        }
      }
    }
    return [];
  });
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  const {
    sortedData: sortedHosts,
    handleChange: handleSortChange,
    getSortOrderForColumn,
  } = useTwoStateSort<Host>({
    data: hosts,
    comparators: hostComparators,
    defaultColumnKey: "name",
    defaultOrder: "ascend",
    initialState: sortState,
    onStateChange: onSortStateChange,
  });

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const searchEffectInitialized = useRef(false);

  useEffect(() => {
    if (!searchEffectInitialized.current) {
      searchEffectInitialized.current = true;
      return;
    }
    const handler = window.setTimeout(() => {
      const normalized = localSearch.trim();
      if (normalized !== search) {
        setCurrentPage(1);
        tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        onSearch(normalized);
      }
    }, 400);
    return () => window.clearTimeout(handler);
  }, [localSearch, onSearch, search]);

  const handleFilterChange = (key: keyof HostFilters, value?: string) => {
    const normalized = value && value.length > 0 ? value : undefined;
    setCurrentPage(1);
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    onFiltersChange({ ...filters, [key]: normalized });
  };

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClearSearch = () => {
    setCurrentPage(1);
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setLocalSearch("");
  };

  const handleImport = (file: File) => {
    const run = async () => {
      try {
        setImporting(true);
        await Promise.resolve(onImport(file));
        message.success('导入任务已开始');
        setImportModalVisible(false);
      } catch (error) {
        message.error('导入失败，请稍后重试');
        throw error;
      } finally {
        setImporting(false);
        setImportFileList([]);
      }
    };
    run();
    return false; // 阻止默认上传行为
  };

  const handleTogglePasswordVisibility = useCallback((name: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }, []);

  const handleTableChange = (
    _pagination: any,
    _filters: Record<string, any | null>,
    sorter: SorterResult<Host> | SorterResult<Host>[],
    extra?: { action?: string }
  ) => {
    if (extra?.action !== "sort") {
      return;
    }
    const result = Array.isArray(sorter) ? sorter[0] : sorter;
    const columnKey = result?.columnKey ? String(result.columnKey) : undefined;
    const nextOrder = result?.order as AntdSortOrder | undefined;
    const normalizedOrder: TwoStateSortOrder | undefined =
      nextOrder === "ascend" || nextOrder === "descend" ? nextOrder : undefined;
    handleSortChange(columnKey, normalizedOrder);
  };

  const getAntdSortOrder = useCallback(
    (key: string) => getSortOrderForColumn(key) as AntdSortOrder | undefined,
    [getSortOrderForColumn]
  );

  const columnDefinitions = useMemo<HostTableColumn[]>(
    () =>
      buildHostColumns({
        getSortOrderForColumn: getAntdSortOrder,
        onTogglePassword: handleTogglePasswordVisibility,
        visiblePasswords,
        includeActions: true,
        onEdit,
        onDelete,
        onOpenTerminal,
        isMobile,
      }) as HostTableColumn[],
    [
      getAntdSortOrder,
      handleTogglePasswordVisibility,
      visiblePasswords,
      onEdit,
      onDelete,
      onOpenTerminal,
      isMobile,
    ]
  );

  useEffect(() => {
    const availableKeys = columnDefinitions.map((column) => column.key);
    setVisibleColumnKeys((prev) => {
      if (prev.length === 0) {
        return availableKeys;
      }
      const filtered = prev.filter((key) => availableKeys.includes(key));
      if (filtered.length !== prev.length) {
        return filtered.length > 0 ? filtered : availableKeys;
      }
      return prev;
    });
  }, [columnDefinitions]);

  useEffect(() => {
    if (visibleColumnKeys.length > 0 && typeof window !== "undefined") {
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
    }
  }, [visibleColumnKeys]);

  const handleColumnsChange = (checkedValues: Array<string | number>) => {
    const keys = checkedValues.map(String);
    if (keys.length === 0) {
      message.warning("至少保留一列");
      return;
    }
    setVisibleColumnKeys(keys);
  };

  const visibleColumns =
    visibleColumnKeys.length === 0
      ? columnDefinitions
      : columnDefinitions.filter((column) => visibleColumnKeys.includes(column.key));

  const columnSelectorContent = (
    <Checkbox.Group
      value={
        visibleColumnKeys.length === 0
          ? columnDefinitions.map((column) => column.key)
          : visibleColumnKeys
      }
      onChange={handleColumnsChange}
    >
      <Space direction="vertical">
        {columnDefinitions.map((column) => (
          <Checkbox key={column.key} value={column.key}>
            {column.title}
          </Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  );

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedHosts = sortedHosts.slice(startIndex, endIndex);
  const totalPages = Math.max(1, Math.ceil(sortedHosts.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const rowSelection: TableRowSelection<Host> = {
    selectedRowKeys: selected,
    onChange: (keys) => {
      onSelectionChange(keys.map(String));
    },
    preserveSelectedRowKeys: true,
  };

  const filteredCount = sortedHosts.length;
  const selectedCount = selected.length;

  return (
    <div>
      <FilterToolbar
        style={{ marginBottom: 16 }}
        left={
          <Space size="middle" wrap align="center">
            <StatusTag variant="info">共 {filteredCount} 台设备</StatusTag>
            <StatusTag variant={selectedCount > 0 ? "success" : "neutral"}>
              已选 {selectedCount} 台
            </StatusTag>
            <div style={createVerticalDivider(token)} />
            <Search
              placeholder="搜索设备..."
              value={localSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalSearch(e.target.value)}
              onSearch={(value: string) => setLocalSearch(value)}
              allowClear
              onClear={handleClearSearch}
              style={{ width: 240 }}
            />
            <Select
              placeholder="按站点筛选"
              value={filters.site}
              onChange={(value: string) => handleFilterChange("site", value as string)}
              allowClear
              onClear={() => handleFilterChange("site", undefined)}
              style={{ width: 160 }}
              options={filterOptions.sites.map((site) => ({ label: site, value: site }))}
              optionFilterProp="label"
              showSearch
            />
          </Space>
        }
        right={
          <Space size="small" wrap>
            <Popover
              content={columnSelectorContent}
              trigger="click"
              open={columnSelectorOpen}
              onOpenChange={setColumnSelectorOpen}
              placement="bottomRight"
            >
              <Button icon={<ColumnHeightOutlined />}>列显示</Button>
            </Popover>
            <Button
              icon={<CloudSyncOutlined />}
              onClick={() => {
                onSyncAddressPools();
              }}
              loading={syncing}
            >
              同步地址池
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportModalVisible(true)}
              loading={importing}
              disabled={importing}
            >
              导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onExport}>
              导出
            </Button>
            <Popconfirm
              title={`确定批量删除选中的 ${selected.length} 台设备吗？`}
              onConfirm={onBatchDelete}
              okText="批量删除"
              cancelText="取消"
              disabled={selected.length === 0}
            >
              <Button danger icon={<DeleteOutlined />} disabled={selected.length === 0}>
                批量删除 ({selected.length})
              </Button>
            </Popconfirm>
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              新增设备
            </Button>
          </Space>
        }
      />

      <div ref={tableTopRef} />
      <Table
        columns={visibleColumns}
        dataSource={paginatedHosts}
        loading={loading}
        rowKey="name"
        rowSelection={rowSelection}
        pagination={false}
        size="small"
        onChange={(pagination, filters, sorter, extra) => {
          handleTableChange(pagination as any, filters as any, sorter as any, extra as { action?: string });
          tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        showSorterTooltip={false}
        locale={{
          emptyText: search || filters.site ? '没有找到匹配的设备' : '暂无设备数据'
        }}
        bordered
        scroll={{
          x: 'max-content'
        }}
      />

      {sortedHosts.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <StatusTag variant="info" style={{ margin: 0 }}>
            第 {currentPage} / {totalPages} 页
          </StatusTag>
          <Pagination
            {...({
              current: currentPage,
              pageSize,
              total: sortedHosts.length,
              onChange: handlePageChange,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 200],
              showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              locale: paginationLocale,
              selectProps: { showSearch: false },
            } as any)}
          />
        </div>
      )}

      {/* 导入模态框 */}
      <Modal
        title="导入设备"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportFileList([]);
        }}
        footer={null}
      >
        <Upload.Dragger
          accept=".xlsx"
          beforeUpload={(file: File) => {
            handleImport(file);
            return false;
          }}
          disabled={importing}
          fileList={importFileList}
          onChange={({ fileList }: { fileList: any[] }) => setImportFileList(fileList)}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            仅支持 .xlsx 格式的 Excel 文件
          </p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
};

export default HostTable;
