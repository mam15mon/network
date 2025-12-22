import { memo, useMemo } from "react";
import { Alert, Button, Space, Typography, theme } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import StatusTag from "../common/StatusTag";
import {
  createAccentCardStyle,
  createCardAccentBar,
  createCardHoverHandlers,
  createRoundedButtonStyle,
  mergeStyles,
} from "../../styles/commonStyles";

interface DeviceSelectionCardProps {
  selectedHosts: string[];
  onOpenDeviceFilter: () => void;
  variant?: 'accent' | 'plain';
}

const DeviceSelectionCard = ({ selectedHosts, onOpenDeviceFilter, variant = 'accent' }: DeviceSelectionCardProps) => {
  const { token } = theme.useToken();
  const hoverHandlers = useMemo(() => createCardHoverHandlers(token), [token]);

  const hasSelection = selectedHosts.length > 0;
  const summary = hasSelection
    ? `${selectedHosts.slice(0, 5).join(", ")}${selectedHosts.length > 5 ? ` 等 ${selectedHosts.length} 台设备` : ""}`
    : "";

  return (
    <div
      style={mergeStyles(
        variant === 'accent' ? createAccentCardStyle(token) : {},
        {
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        },
      )}
      {...(variant === 'accent' ? hoverHandlers : {})}
    >
      {variant === 'accent' ? <div style={createCardAccentBar(token)} /> : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Typography.Text type="secondary" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          设备选择
        </Typography.Text>
        <Space size="small" wrap>
          <StatusTag variant={hasSelection ? "success" : "warning"}>
            {hasSelection ? `已选 ${selectedHosts.length} 台` : "未选择设备"}
          </StatusTag>
          <Button icon={<FilterOutlined />} onClick={onOpenDeviceFilter} style={createRoundedButtonStyle(token)}>
            选择设备
          </Button>
        </Space>
      </div>

      {hasSelection ? (
        <Alert
          type="success"
          showIcon
          message={<Typography.Text strong>{`已选择 ${selectedHosts.length} 台设备`}</Typography.Text>}
          description={summary}
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          message="请先选择要执行命令的设备"
          description="点击“选择设备”按钮打开筛选抽屉，选择需要执行命令的设备。"
        />
      )}
    </div>
  );
};

export default memo(DeviceSelectionCard);
