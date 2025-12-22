import { CSSProperties, ReactNode, useMemo } from "react";
import { Space, theme } from "antd";
import { createFilterPanelStyle, mergeStyles } from "../../styles/commonStyles";

interface FilterToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  gap?: number;
}

const DEFAULT_GAP = 12;

const FilterToolbar = ({ left, right, children, style, gap = DEFAULT_GAP }: FilterToolbarProps) => {
  const { token } = theme.useToken();
  const baseStyle = useMemo(() => createFilterPanelStyle(token), [token]);

  return (
    <div
      style={mergeStyles(baseStyle, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap,
        marginBottom: 16,
      }, style)}
    >
      <Space size="small" wrap>
        {left ?? children}
      </Space>
      {right && (
        <Space size="small" wrap>
          {right}
        </Space>
      )}
    </div>
  );
};

export default FilterToolbar;
