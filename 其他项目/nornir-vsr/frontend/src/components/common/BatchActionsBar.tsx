import { CSSProperties, ReactNode, useMemo } from "react";
import { Space, theme } from "antd";
import { createBatchActionsStyle, mergeStyles } from "../../styles/commonStyles";

interface BatchActionsBarProps {
  children: ReactNode;
  style?: CSSProperties;
  align?: CSSProperties["justifyContent"];
}

const BatchActionsBar = ({ children, style, align = "flex-start" }: BatchActionsBarProps) => {
  const { token } = theme.useToken();
  const baseStyle = useMemo(() => createBatchActionsStyle(token), [token]);

  return (
    <div
      style={mergeStyles(baseStyle, {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align,
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }, style)}
    >
      <Space size="small" wrap>
        {children}
      </Space>
    </div>
  );
};

export default BatchActionsBar;
