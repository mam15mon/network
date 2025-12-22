import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, message, theme } from "antd";
import type { TabsProps } from "antd";

import type { CommandResult } from "../../api/nornir";
import { useOrientation } from "../../hooks/useOrientation";

import CommandResultsTab from "./CommandResultsTab";
import CommandHistoryTab from "./CommandHistoryTab";
import type { HistoryRecord, ResultSummary } from "./types";
import type { HighlightRule } from "../../utils/commandHighlight";
import { STORAGE_KEYS } from "./constants";
import {
  createAccentCardStyle,
  createCardAccentBar,
  createCardHoverHandlers,
  mergeStyles,
} from "../../styles/commonStyles";

interface CommandOutputTabsProps {
  commandResults: CommandResult[];
  executing: boolean;
  history: HistoryRecord[];
  historyLoading: boolean;
  onRefreshHistory: () => Promise<void> | void;
  onDeleteHistory: (record: HistoryRecord) => Promise<void>;
  onBatchDeleteHistory: (logIds: number[]) => Promise<void>;
  onShowHistoryOutput: (record: HistoryRecord) => void;
  onPreviewSnapshot: (snapshotId: number) => void;
  onDownloadSnapshot: (snapshotId: number, host: string, executedAt: string) => void;
  onCopyResult: (output: string) => void;
  onSummaryChange?: (summary: ResultSummary & { executing: boolean }) => void;
  variant?: 'accent' | 'plain';
  highlightRules?: HighlightRule[];
}

const CommandOutputTabs = ({
  commandResults,
  executing,
  history,
  historyLoading,
  onRefreshHistory,
  onDeleteHistory,
  onBatchDeleteHistory,
  onShowHistoryOutput,
  onPreviewSnapshot,
  onDownloadSnapshot,
  onCopyResult,
  onSummaryChange,
  variant = 'accent',
  highlightRules,
}: CommandOutputTabsProps) => {
  const orientation = useOrientation();
  const isLandscape = orientation === "landscape";
  const { token } = theme.useToken();
  const hoverHandlers = useMemo(() => createCardHoverHandlers(token), [token]);

  const [activeTab, setActiveTab] = useState<"results" | "history">(() => {
    if (typeof window === "undefined") {
      return "results";
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.activeTab);
    return stored === "history" ? "history" : "results";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.activeTab, activeTab);
    }
  }, [activeTab]);

  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failure">(() => {
    if (typeof window === "undefined") {
      return "all";
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.resultFilter);
    return stored === "success" || stored === "failure" ? stored : "all";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.resultFilter, resultFilter);
    }
  }, [resultFilter]);

  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  const toggleResultExpand = useCallback((key: string) => {
    setExpandedResults((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const filteredResults = useMemo(() => {
    if (resultFilter === "all") {
      return commandResults;
    }
    const shouldFail = resultFilter === "failure";
    return commandResults.filter((item) => Boolean(item.failed) === shouldFail);
  }, [commandResults, resultFilter]);

  const summary = useMemo<ResultSummary>(() => {
    const total = commandResults.length;
    const success = commandResults.filter((item) => !item.failed).length;
    return {
      total,
      success,
      failure: total - success,
    };
  }, [commandResults]);

  const showSummary = executing || summary.total > 0;

  useEffect(() => {
    onSummaryChange?.({ ...summary, executing });
  }, [summary, executing, onSummaryChange]);

  const handleExport = useCallback(async () => {
    if (filteredResults.length === 0) {
      message.info("当前无可导出的执行结果");
      return;
    }
    try {
      const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const rowsHtml = filteredResults
        .map((item, index) => {
          const command = escapeHtml(item.command ?? "");
          const result = escapeHtml(item.result ?? "");
          const rowId = `result-${index}`;
          return `
            <tr>
              <td class="host">${escapeHtml(item.host)}</td>
              <td class="command"><pre>${command}</pre></td>
              <td class="result">
                <div class="result-actions">
                  <button class="toggle" data-target="${rowId}">展开</button>
                </div>
                <div id="${rowId}" class="result-content collapsed"><pre>${result}</pre></div>
              </td>
            </tr>
          `;
        })
        .join("");

      const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>命令执行结果</title>
  <style>
    body { font-family: "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif; background: #f5f7fa; color: #1f2933; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 12px 40px -28px rgba(15, 76, 129, 0.35); border-radius: 12px; overflow: hidden; }
    thead { background: linear-gradient(135deg, #1677ff 0%, #5d9dff 100%); color: #fff; }
    th, td { padding: 12px 16px; vertical-align: top; border-bottom: 1px solid rgba(15, 23, 42, 0.08); }
    th { text-align: left; font-weight: 600; letter-spacing: 0.02em; }
    tr:last-child td { border-bottom: none; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace; font-size: 13px; line-height: 1.54; }
    td.host { width: 15%; font-weight: 600; }
    td.command { width: 25%; background: rgba(22, 119, 255, 0.04); }
    td.result { width: 60%; background: rgba(15, 23, 42, 0.02); }
    .result-actions { margin-bottom: 8px; }
    .result-actions button { margin-right: 8px; padding: 4px 10px; border: none; border-radius: 6px; background: #1677ff; color: #fff; cursor: pointer; font-size: 12px; }
    .result-actions button:hover { background: #135ecb; }
    .result-actions button:active { transform: translateY(1px); }
    .result-actions button.toggle.collapsed { background: #6c7b94; }
    .result-content { max-height: 320px; overflow-y: auto; border: 1px solid rgba(22, 119, 255, 0.15); border-radius: 8px; background: #fff; box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.08); padding: 12px; transition: all 0.2s ease; }
    .result-content.collapsed { max-height: 0; padding: 0; overflow: hidden; border: none; box-shadow: none; }
    .controls { margin-bottom: 16px; }
    .controls button { margin-right: 12px; padding: 6px 14px; border: none; border-radius: 8px; background: linear-gradient(135deg, #1677ff 0%, #5d9dff 100%); color: #fff; cursor: pointer; font-size: 13px; }
    .controls button:hover { opacity: 0.9; }
    footer { margin-top: 16px; font-size: 12px; color: rgba(15, 23, 42, 0.55); }
  </style>
</head>
<body>
  <h1>命令执行结果导出</h1>
  <div class="controls">
    <button id="expandAll">全部展开</button>
    <button id="collapseAll">全部收起</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>主机</th>
        <th>命令</th>
        <th>回显</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <footer>生成时间：${new Date().toLocaleString()} &nbsp; | &nbsp; 记录数：${filteredResults.length}</footer>

  <script>
    const toggleButtons = document.querySelectorAll('button.toggle');
    const expandAllBtn = document.getElementById('expandAll');
    const collapseAllBtn = document.getElementById('collapseAll');

    function setCollapsed(element, collapsed) {
      element.classList.toggle('collapsed', collapsed);
    }

    toggleButtons.forEach((button) => {
      const targetId = button.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (!target) return;

      setCollapsed(target, true);
      button.classList.add('collapsed');

      button.addEventListener('click', () => {
        const isCollapsed = target.classList.contains('collapsed');
        setCollapsed(target, !isCollapsed);
        if (isCollapsed) {
          button.textContent = '收起';
          button.classList.remove('collapsed');
        } else {
          button.textContent = '展开';
          button.classList.add('collapsed');
        }
      });
    });

    expandAllBtn?.addEventListener('click', () => {
      toggleButtons.forEach((button) => {
        const targetId = button.getAttribute('data-target');
        const target = document.getElementById(targetId);
        if (!target) return;
        setCollapsed(target, false);
        button.textContent = '收起';
        button.classList.remove('collapsed');
      });
    });

    collapseAllBtn?.addEventListener('click', () => {
      toggleButtons.forEach((button) => {
        const targetId = button.getAttribute('data-target');
        const target = document.getElementById(targetId);
        if (!target) return;
        setCollapsed(target, true);
        button.textContent = '展开';
        button.classList.add('collapsed');
      });
    });
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `command-results-${timestamp}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (error) {
      console.error(error);
      message.error("导出失败，请稍后重试");
    }
  }, [filteredResults]);

  const tabItems: TabsProps["items"] = [
    {
      key: "results",
      label: "实时结果",
      children: (
        <CommandResultsTab
          executing={executing}
          showSummary={showSummary}
          summary={summary}
          resultFilter={resultFilter}
          onResultFilterChange={setResultFilter}
          filteredResults={filteredResults}
          allResults={commandResults}
          onExport={handleExport}
          exportDisabled={filteredResults.length === 0}
          expandedResults={expandedResults}
          onToggleExpand={toggleResultExpand}
          onCopyResult={onCopyResult}
          onDownloadSnapshot={onDownloadSnapshot}
          isLandscape={isLandscape}
          highlightRules={highlightRules}
        />
      ),
    },
    {
      key: "history",
      label: "执行历史",
      children: (
        <CommandHistoryTab
          records={history}
          loading={historyLoading}
          onRefresh={onRefreshHistory}
          onShowOutput={onShowHistoryOutput}
          onPreviewSnapshot={onPreviewSnapshot}
          onDownloadSnapshot={onDownloadSnapshot}
          onDeleteRecord={onDeleteHistory}
          onBatchDeleteRecords={onBatchDeleteHistory}
        />
      ),
    },
  ];

  return (
    <div
      style={mergeStyles(
        variant === 'accent' ? createAccentCardStyle(token) : {},
        {
          padding: 16,
        },
      )}
      {...(variant === 'accent' ? hoverHandlers : {})}
    >
      {variant === 'accent' ? <div style={createCardAccentBar(token)} /> : null}
      <Tabs
        activeKey={activeTab}
        onChange={(key: string) => setActiveTab(key as "results" | "history")}
        destroyOnHidden
        items={tabItems}
        tabBarStyle={{ marginBottom: 16 }}
      />
    </div>
  );
};

export default CommandOutputTabs;
