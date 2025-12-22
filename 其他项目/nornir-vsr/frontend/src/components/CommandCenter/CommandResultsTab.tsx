import { memo, useMemo } from "react";
import {
  Button,
  List,
  Segmented,
  Space,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import type { CommandResult } from "../../api/nornir";

import type { ResultSummary } from "./types";
import StatusTag from "../common/StatusTag";
import {
  createHighlightRules,
  highlightTextWithRules,
  type HighlightRule,
} from "../../utils/commandHighlight";
import {
  createAccentCardStyle,
  createCardAccentBar,
  createCardHoverHandlers,
  createInfoBoxStyle,
  createPrimaryButtonStyle,
  createRoundedButtonStyle,
  mergeStyles,
} from "../../styles/commonStyles";

interface CommandResultsTabProps {
  executing: boolean;
  showSummary: boolean;
  summary: ResultSummary;
  resultFilter: "all" | "success" | "failure";
  onResultFilterChange: (value: "all" | "success" | "failure") => void;
  filteredResults: CommandResult[];
  allResults: CommandResult[];
  onExport: () => Promise<void> | void;
  exportDisabled: boolean;
  expandedResults: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
  onCopyResult: (output: string) => void;
  onDownloadSnapshot: (snapshotId: number, host: string, executedAt: string) => void;
  isLandscape: boolean;
  highlightRules?: HighlightRule[];
}

const { Paragraph, Text } = Typography;

const CommandResultsTab = ({
  executing,
  showSummary,
  summary,
  resultFilter,
  onResultFilterChange,
  filteredResults,
  allResults,
  onExport,
  exportDisabled,
  expandedResults,
  onToggleExpand,
  onCopyResult,
  onDownloadSnapshot,
  isLandscape,
  highlightRules: providedHighlightRules,
}: CommandResultsTabProps) => {
  const { token } = theme.useToken();
  const highlightRules = useMemo(
    () => providedHighlightRules ?? createHighlightRules(token),
    [providedHighlightRules, token],
  );
  const hoverHandlers = useMemo(() => createCardHoverHandlers(token), [token]);
  const actionButtonStyle = useMemo(() => createRoundedButtonStyle(token), [token]);
  const exportButtonStyle = useMemo(() => createPrimaryButtonStyle(token), [token]);
  const resultCardStyle = useMemo(() => createAccentCardStyle(token), [token]);
  const outputBoxStyle = useMemo(() => createInfoBoxStyle(token), [token]);

  const grid = useMemo(
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
    [isLandscape],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space size="small" wrap align="center">
        <Segmented
          options={[
            { label: "全部", value: "all" },
            { label: "成功", value: "success" },
            { label: "失败", value: "failure" },
          ]}
          value={resultFilter}
          onChange={(value: "all" | "success" | "failure") => onResultFilterChange(value)}
          size="small"
        />
        <Tooltip title={exportDisabled ? "当前无可导出的执行结果" : "下载 HTML 文件"}>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            disabled={exportDisabled}
            onClick={onExport}
            style={mergeStyles(actionButtonStyle, exportButtonStyle)}
          >
            导出当前结果
          </Button>
        </Tooltip>
        {showSummary && (
          <Space size="small" align="center">
            <StatusTag variant="info">共 {summary.total}</StatusTag>
            <StatusTag variant="success">成功 {summary.success}</StatusTag>
            {summary.failure > 0 && <StatusTag variant="error">失败 {summary.failure}</StatusTag>}
            {executing && <StatusTag variant="warning">执行中</StatusTag>}
          </Space>
        )}
      </Space>

      {filteredResults.length === 0 ? (
        <Text type="secondary">
          {allResults.length === 0 ? "暂无执行结果" : "没有符合筛选条件的结果"}
        </Text>
      ) : (
        <List
          grid={grid}
          dataSource={filteredResults}
          renderItem={(result) => {
            const cardKey = `${result.host}-${result.executedAt}`;
            const executedTime = new Date(result.executedAt).toLocaleString();
            const isExpanded = Boolean(expandedResults[cardKey]);
            const shouldShowToggle = (result.result ?? "").length > 200;

            const highlightedOutput = highlightTextWithRules(result.result ?? "", highlightRules);
            const accentStyle = result.failed
              ? { ...createCardAccentBar(token), background: token.colorError }
              : createCardAccentBar(token);

            return (
              <List.Item key={cardKey}>
                <div
                  style={mergeStyles(
                    resultCardStyle,
                    {
                      display: "flex",
                      flexDirection: "column",
                      gap: isLandscape ? 8 : 6,
                      padding: isLandscape ? 16 : 12,
                    },
                  )}
                  {...hoverHandlers}
                >
                  <div style={accentStyle} />
                  <Space size="small" align="center" wrap>
                    <Text strong>{result.host}</Text>
                    <StatusTag variant={result.failed ? "error" : "success"}>
                      {result.failed ? "失败" : "成功"}
                    </StatusTag>
                  </Space>
                  <Text type="secondary">执行时间：{executedTime}</Text>
                  <Paragraph
                    copyable={{ text: result.result ?? "" }}
                    style={mergeStyles(
                      outputBoxStyle,
                      {
                        whiteSpace: "pre-wrap",
                        marginBottom: 0,
                        maxHeight: isExpanded ? "none" : isLandscape ? 240 : 180,
                        overflowY: isExpanded ? "visible" : "auto",
                        padding: 12,
                      },
                    )}
                  >
                    {highlightedOutput}
                  </Paragraph>
                  {shouldShowToggle && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => onToggleExpand(cardKey)}
                      style={{ alignSelf: "flex-start", paddingLeft: 0 }}
                    >
                      {isExpanded ? "收起内容" : "展开全文"}
                    </Button>
                  )}
                  {result.exception && <Text type="danger">异常: {result.exception}</Text>}
                  {result.outputPath && <Text type="secondary">输出文件: {result.outputPath}</Text>}
                  <Space size="small" wrap>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => onCopyResult(result.result ?? "")}
                      style={actionButtonStyle}
                    >
                      复制输出
                    </Button>
                    {result.snapshotId && (
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => onDownloadSnapshot(result.snapshotId!, result.host, result.executedAt)}
                        style={actionButtonStyle}
                      >
                        下载配置
                      </Button>
                    )}
                  </Space>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </Space>
  );
};

export default memo(CommandResultsTab);
