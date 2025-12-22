import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Form, Grid, message, theme } from "antd";

import DeviceFilterDrawer from "../DeviceFilterDrawer";
import type { Host } from "../../api/hosts";
import {
  CommandPayload,
  CommandResult,
  CommandType,
  ConfigSnapshotDetail,
  deleteCommandHistory,
  downloadConfigSnapshot,
  executeCommand,
  fetchCommandHistory,
  fetchConfigSnapshot,
} from "../../api/nornir";

import DeviceSelectionCard from "./DeviceSelectionCard";
import CommandFormCard from "./CommandFormCard";
import CommandOutputTabs from "./CommandOutputTabs";
import type { HistoryRecord, ResultSummary } from "./types";
import { DEFAULT_COMMANDS } from "./constants";
import { createContainerStyle, createInfoBoxStyle, mergeStyles } from "../../styles/commonStyles";
import type { HighlightRule } from "../../utils/commandHighlight";
import type { SortState } from "../../hooks/useTwoStateSort";

const HistoryResultModal = lazy(() => import("./HistoryResultModal"));
const SnapshotPreviewModal = lazy(() => import("./SnapshotPreviewModal"));

interface CommandCenterProps {
  hosts: Host[];
  loading: boolean;
  filterOptions: { sites: string[] };
  onSummaryChange?: (summary: ResultSummary & { executing: boolean }) => void;
  highlightRules?: HighlightRule[];
  sortState?: SortState;
  onSortStateChange?: (state: SortState) => void;
}

const CommandCenter = ({
  hosts,
  loading,
  filterOptions,
  onSummaryChange,
  highlightRules,
  sortState,
  onSortStateChange,
}: CommandCenterProps) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [form] = Form.useForm();
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);

  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [executing, setExecuting] = useState(false);

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [siteFilter, setSiteFilter] = useState<string | undefined>(undefined);

  const [historyResultModal, setHistoryResultModal] = useState<{ visible: boolean; record: HistoryRecord | null }>(
    { visible: false, record: null },
  );

  const [snapshotModal, setSnapshotModal] = useState<{
    visible: boolean;
    loading: boolean;
    data: ConfigSnapshotDetail | null;
  }>(() => ({ visible: false, loading: false, data: null }));

  const mapHistoryRecords = useCallback((items: CommandResult[]): HistoryRecord[] => (
    items.map((item) => ({
      ...item,
      key: item.logId ? item.logId.toString() : `${item.host}-${item.executedAt}`,
    }))
  ), []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const records = await fetchCommandHistory({ limit: 200, includeConfigDownload: false });
      setHistory(mapHistoryRecords(records));
    } catch (error) {
      message.error("加载历史记录失败");
    } finally {
      setHistoryLoading(false);
    }
  }, [mapHistoryRecords]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      if (selectedHosts.length === 0) {
        message.warning("请先选择至少一个设备");
        return;
      }

      const type = values.commandType as CommandType;
      const payload: CommandPayload = {
        commandType: type,
        hosts: selectedHosts,
      };

      switch (type) {
        case "display":
          payload.command = (values.command || "").trim();
          break;
        case "config":
        case "multiline":
          payload.commands = (values.commands || "")
            .split(/\r?\n/)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
          if (type === "multiline") {
            payload.useTiming = Boolean(values.useTiming);
          }
          break;
        case "connectivity":
          payload.command = DEFAULT_COMMANDS.connectivity;
          break;
        case "config_download":
          break;
        default:
          break;
      }

      setExecuting(true);
      const results = await executeCommand(payload);
      setCommandResults(results);
      message.success("命令已执行");
      await loadHistory();
    } catch (error: any) {
      if (error?.response?.data?.detail) {
        message.error(error.response.data.detail);
      } else if (!error?.errorFields) {
        message.error("执行命令失败");
      }
    } finally {
      setExecuting(false);
    }
  };

  const formatTimestampForFilename = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.replace(/[^0-9]/g, "");
    }
    const pad = (num: number) => num.toString().padStart(2, "0");
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  };

  const handleDownloadSnapshot = useCallback(async (snapshotId: number, host: string, executedAt: string) => {
    try {
      const blob = await downloadConfigSnapshot(snapshotId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = formatTimestampForFilename(executedAt);
      link.download = `${host}-${timestamp}.cfg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error("下载配置失败");
    }
  }, []);

  const handlePreviewSnapshot = useCallback(async (snapshotId: number) => {
    setSnapshotModal({ visible: true, loading: true, data: null });
    try {
      const data = await fetchConfigSnapshot(snapshotId);
      setSnapshotModal({ visible: true, loading: false, data });
    } catch (error) {
      message.error("加载配置快照失败");
      setSnapshotModal({ visible: true, loading: false, data: null });
    }
  }, []);

  const closeSnapshotModal = () => {
    setSnapshotModal({ visible: false, loading: false, data: null });
  };

  const openHistoryResultModal = (record: HistoryRecord) => {
    setHistoryResultModal({ visible: true, record });
  };

  const closeHistoryResultModal = () => {
    setHistoryResultModal({ visible: false, record: null });
  };

  const handleCopyResult = useCallback(async (output: string) => {
    if (!output) {
      message.info("暂无输出内容可复制");
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(output);
        message.success("输出已复制");
      } else {
        throw new Error("clipboard not supported");
      }
    } catch (error) {
      message.error("复制失败，请手动复制");
    }
  }, []);

  const handleDeleteHistoryRecord = useCallback(
    async (record: HistoryRecord) => {
      if (!record.logId) {
        message.warning("该记录无法删除");
        return;
      }
      try {
        await deleteCommandHistory(record.logId);
        message.success("已删除记录");
        await loadHistory();
      } catch (error) {
        message.error("删除失败");
      }
    },
    [loadHistory],
  );

  const handleBatchDeleteHistoryRecords = useCallback(
    async (logIds: number[]) => {
      if (logIds.length === 0) {
        return;
      }
      try {
        await Promise.all(logIds.map((id) => deleteCommandHistory(id)));
        message.success(`已删除 ${logIds.length} 条记录`);
        await loadHistory();
      } catch (error) {
        message.error("批量删除失败");
      }
    },
    [loadHistory],
  );

  const handleSummaryChange = useCallback(
    (summary: ResultSummary & { executing: boolean }) => {
      onSummaryChange?.(summary);
    },
    [onSummaryChange],
  );

  const pageContainerStyle = useMemo(
    () =>
      mergeStyles(createContainerStyle(token, true), {
        border: "none",
        boxShadow: "none",
        padding: isMobile ? 16 : 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }),
    [token, isMobile],
  );

  const sectionStyle = useMemo(
    () =>
      mergeStyles(createInfoBoxStyle(token), {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: isMobile ? 16 : 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }),
    [token, isMobile],
  );

  const resultsSectionStyle = useMemo(
    () =>
      mergeStyles(createInfoBoxStyle(token), {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: isMobile ? 12 : 16,
      }),
    [token, isMobile],
  );

  return (
    <>
      <div style={pageContainerStyle}>
        <div style={sectionStyle}>
          <DeviceSelectionCard
            selectedHosts={selectedHosts}
            onOpenDeviceFilter={() => setFilterDrawerVisible(true)}
            variant="plain"
          />

          <CommandFormCard form={form} executing={executing} onExecute={handleExecute} variant="plain" />
        </div>

        <div style={resultsSectionStyle}>
          <CommandOutputTabs
            commandResults={commandResults}
            executing={executing}
            history={history}
            historyLoading={historyLoading}
            onRefreshHistory={loadHistory}
            onDeleteHistory={handleDeleteHistoryRecord}
            onBatchDeleteHistory={handleBatchDeleteHistoryRecords}
            onShowHistoryOutput={openHistoryResultModal}
            onPreviewSnapshot={handlePreviewSnapshot}
            onDownloadSnapshot={handleDownloadSnapshot}
            onCopyResult={handleCopyResult}
            onSummaryChange={handleSummaryChange}
            variant="plain"
            highlightRules={highlightRules}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <HistoryResultModal
          visible={historyResultModal.visible}
          record={historyResultModal.record}
          onClose={closeHistoryResultModal}
          highlightRules={highlightRules}
        />

        <SnapshotPreviewModal
          visible={snapshotModal.visible}
          loading={snapshotModal.loading}
          data={snapshotModal.data}
          onClose={closeSnapshotModal}
          onDownloadSnapshot={handleDownloadSnapshot}
          highlightRules={highlightRules}
        />
      </Suspense>

      <DeviceFilterDrawer
        visible={filterDrawerVisible}
        hosts={hosts}
        loading={loading}
        filterOptions={filterOptions}
        selectedHosts={selectedHosts}
        siteFilter={siteFilter}
        onSiteFilterChange={setSiteFilter}
        onHostsChange={setSelectedHosts}
        onClose={() => setFilterDrawerVisible(false)}
        sortState={sortState}
        onSortStateChange={onSortStateChange}
      />
    </>
  );
};

export default CommandCenter;
