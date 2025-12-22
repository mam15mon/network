import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import {
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Typography,
  Button,
  Divider,
  Grid,
  Checkbox,
  Popover,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { SortOrder as AntdSortOrder, SorterResult } from "antd/es/table/interface";
import type { Host } from "../api/hosts";
import { useTwoStateSort, SortOrder as TwoStateSortOrder, type SortState } from "../hooks/useTwoStateSort";
import { buildHostColumns, hostComparators } from "./hostColumns";
import { ColumnHeightOutlined } from "@ant-design/icons";
import StatusTag from "./common/StatusTag";

const { Text } = Typography;

const COLUMN_STORAGE_KEY = "deviceFilterDrawer.visibleColumns";

interface DeviceFilterDrawerProps {
  visible: boolean;
  hosts: Host[];
  loading: boolean;
  filterOptions: { sites: string[] };
  selectedHosts: string[];
  siteFilter: string | undefined;
  onSiteFilterChange: (value: string | undefined) => void;
  onHostsChange: (hosts: string[]) => void;
  onClose: () => void;
  sortState?: SortState;
  onSortStateChange?: (state: SortState) => void;
}

const DeviceFilterDrawer = ({
  visible,
  hosts,
  loading,
  filterOptions,
  selectedHosts,
  siteFilter,
  onSiteFilterChange,
  onHostsChange,
  onClose,
  sortState,
  onSortStateChange,
}: DeviceFilterDrawerProps) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter((item): item is string => typeof item === "string");
          }
        } catch (_error) {
          /* ignore corrupted storage */
        }
      }
    }
    return [];
  });
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  const filteredHosts = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    const matchKeyword = (host: Host) => {
      if (keyword.length === 0) {
        return true;
      }
      const searchableValues: Array<string | number | undefined | null> = [
        host.name,
        host.hostname,
        host.site,
        host.username,
        host.device_type,
        host.device_model,
        host.address_pool,
        host.ppp_auth_mode,
        host.platform,
        host.port,
      ];
      return searchableValues.some((value) => {
        if (value === undefined || value === null) {
          return false;
        }
        return String(value).toLowerCase().includes(keyword);
      });
    };

    return hosts.filter((host) => {
      if (siteFilter && host.site !== siteFilter) {
        return false;
      }
      return matchKeyword(host);
    });
  }, [hosts, siteFilter, searchInput]);

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys: selectedHosts,
      onChange: (keys: Key[]) => onHostsChange(keys as string[]),
      preserveSelectedRowKeys: true,
    }),
    [selectedHosts, onHostsChange]
  );

  const handleSelectAllFiltered = useCallback(() => {
    onHostsChange(filteredHosts.map((item) => item.name));
  }, [filteredHosts, onHostsChange]);

  const handleClearSelection = useCallback(() => {
    onHostsChange([]);
  }, [onHostsChange]);

  const {
    sortedData: sortedFilteredHosts,
    handleChange: handleSortChange,
    getSortOrderForColumn,
  } = useTwoStateSort<Host>({
    data: filteredHosts,
    comparators: hostComparators,
    defaultColumnKey: "name",
    defaultOrder: sortState?.order ?? "ascend",
    initialState: sortState,
    onStateChange: onSortStateChange,
  });

  const getAntdSortOrder = useCallback(
    (key: string) => getSortOrderForColumn(key) as AntdSortOrder | undefined,
    [getSortOrderForColumn]
  );

  const handleTogglePasswordVisibility = useCallback((name: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }, []);

  const columnDefinitions = useMemo<ColumnsType<Host>>(
    () =>
      buildHostColumns({
        getSortOrderForColumn: getAntdSortOrder,
        onTogglePassword: handleTogglePasswordVisibility,
        visiblePasswords,
        includeActions: false,
        isMobile,
      }),
    [getAntdSortOrder, handleTogglePasswordVisibility, visiblePasswords, isMobile]
  );

  useEffect(() => {
    const availableKeys = columnDefinitions
      .map((column) => column.key)
      .filter((key): key is string => typeof key === "string");

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

  const handleColumnsChange = useCallback((checkedValues: Array<string | number>) => {
    const keys = checkedValues.map(String);
    if (keys.length === 0) {
      message.warning("至少保留一列");
      return;
    }
    setVisibleColumnKeys(keys);
  }, []);

  const columnSelectorContent = useMemo(
    () => (
      <Checkbox.Group
        value={
          visibleColumnKeys.length === 0
            ? columnDefinitions
                .map((column) => column.key)
                .filter((key): key is string => typeof key === "string")
            : visibleColumnKeys
        }
        onChange={handleColumnsChange}
      >
        <Space direction="vertical">
          {columnDefinitions.map((column) => {
            const label =
              typeof column.title === "string"
                ? column.title
                : typeof column.key === "string"
                  ? column.key
                  : "列";
            return (
              <Checkbox key={column.key} value={column.key as string}>
                {label}
              </Checkbox>
            );
          })}
        </Space>
      </Checkbox.Group>
    ),
    [columnDefinitions, handleColumnsChange, visibleColumnKeys]
  );

  const visibleColumns = useMemo<ColumnsType<Host>>(
    () =>
      visibleColumnKeys.length === 0
        ? columnDefinitions
        : columnDefinitions.filter((column) =>
            column.key ? visibleColumnKeys.includes(String(column.key)) : true
          ),
    [columnDefinitions, visibleColumnKeys]
  );

  const drawerWidth = useMemo(() => {
    if (isMobile) {
      return "100%";
    }
    if (typeof window === "undefined") {
      return 760;
    }
    const maxWidth = window.innerWidth * 0.8;
    return Math.min(Math.max(760, maxWidth), 960);
  }, [isMobile]);

  return (
    <Drawer
      title={
        <Space>
          <Text>设备筛选</Text>
          <StatusTag variant="info">{filteredHosts.length} 台可用</StatusTag>
          <StatusTag variant={selectedHosts.length > 0 ? "success" : "neutral"}>
            {selectedHosts.length} 台已选
          </StatusTag>
        </Space>
      }
      placement="left"
      onClose={onClose}
      open={visible}
      width={drawerWidth}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space
          direction={isMobile ? "vertical" : "horizontal"}
          size={isMobile ? "small" : "middle"}
          style={{ width: "100%" }}
          wrap
        >
          <Input.Search
            id="device-filter-search"
            name="device-filter-search"
            placeholder="搜索设备名 / IP / 站点 / 用户 / 地址池等"
            allowClear
            value={searchInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
            onSearch={(value: string) => setSearchInput(value)}
            style={{ flex: 1, minWidth: isMobile ? undefined : 280 }}
          />

          <Select
            placeholder="选择站点"
            allowClear
            value={siteFilter}
            onChange={onSiteFilterChange}
            style={{ width: isMobile ? "100%" : 240 }}
            options={filterOptions.sites.map((site) => ({ label: site, value: site }))}
            optionFilterProp="label"
            showSearch
          />
        </Space>

        <Space
          direction={isMobile ? "vertical" : "horizontal"}
          size={isMobile ? "small" : "middle"}
          style={{ width: "100%" }}
          wrap
        >
          <Button
            size="small"
            type="primary"
            onClick={handleSelectAllFiltered}
            disabled={filteredHosts.length === 0}
          >
            选择筛选
          </Button>
          <Button
            size="small"
            onClick={handleClearSelection}
            disabled={selectedHosts.length === 0}
          >
            清空选择
          </Button>
        </Space>

        <Divider orientation="left" style={{ marginBottom: 12 }}>
          设备列表
        </Divider>

        <Space
          align="center"
          style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
        >
          <Text type="secondary">共 {sortedFilteredHosts.length} 台设备</Text>
          <Popover
            content={columnSelectorContent}
            trigger="click"
            open={columnSelectorOpen}
            onOpenChange={setColumnSelectorOpen}
            placement="bottomRight"
          >
            <Button size="small" icon={<ColumnHeightOutlined />}>
              列显示
            </Button>
          </Popover>
        </Space>

        <div ref={tableTopRef} />

        <Table
          size="small"
          rowKey={(record: Host) => record.name}
          columns={visibleColumns}
          dataSource={sortedFilteredHosts}
          rowSelection={rowSelection}
          loading={loading}
          showSorterTooltip={false}
          onChange={(
            _pagination: any,
            _filters: any,
            sorter: SorterResult<Host> | SorterResult<Host>[],
            extra: { action?: string }
          ) => {
            tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (extra?.action !== "sort") {
              return;
            }
            const result = Array.isArray(sorter) ? sorter[0] : sorter;
            const columnKey = result?.columnKey ? String(result.columnKey) : undefined;
            const order = result?.order;
            const normalizedOrder: TwoStateSortOrder | undefined =
              order === "ascend" || order === "descend" ? order : undefined;
            handleSortChange(columnKey, normalizedOrder);
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 200],
            showTotal: (total: number, range: [number, number]) =>
              `${range[0]}-${range[1]} / ${total} 台设备`,
            ...( { selectProps: { showSearch: false } } as any ),
            onChange: () => tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          }}
          scroll={{ y: isMobile ? 320 : 400, x: 'max-content' }}
        />
        <Divider style={{ margin: '16px 0' }} />
        <Button type="primary" block onClick={onClose}>
          完成选择
        </Button>
      </Space>
    </Drawer>
  );
};

export default DeviceFilterDrawer;
