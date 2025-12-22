import { Tag, theme } from "antd";
import type { TagProps } from "antd";
import type { ReactNode } from "react";

export type StatusVariant = "neutral" | "info" | "success" | "warning" | "error";

interface StatusTagProps extends TagProps {
  variant?: StatusVariant;
  children: ReactNode;
}

const StatusTag = ({ variant = "neutral", style, children, ...rest }: StatusTagProps) => {
  const { token } = theme.useToken();

  const palette: Record<StatusVariant, { background: string; border: string; color: string }> = {
    neutral: {
      background: token.colorFillSecondary,
      border: token.colorBorderSecondary,
      color: token.colorTextSecondary,
    },
    info: {
      background: token.colorInfoBg,
      border: token.colorInfoBorder,
      color: token.colorInfoText ?? token.colorInfo,
    },
    success: {
      background: token.colorSuccessBg,
      border: token.colorSuccessBorder,
      color: token.colorSuccessText ?? token.colorSuccess,
    },
    warning: {
      background: token.colorWarningBg,
      border: token.colorWarningBorder,
      color: token.colorWarningText ?? token.colorWarning,
    },
    error: {
      background: token.colorErrorBg,
      border: token.colorErrorBorder,
      color: token.colorErrorText ?? token.colorError,
    },
  };

  const variantPalette = palette[variant] ?? palette.neutral;

  return (
    <Tag
      {...rest}
      style={{
        borderRadius: token.borderRadiusSM,
        border: `1px solid ${variantPalette.border}`,
        background: variantPalette.background,
        color: variantPalette.color,
        paddingInline: token.paddingXS,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

export default StatusTag;
