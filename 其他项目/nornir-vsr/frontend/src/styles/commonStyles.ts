import { CSSProperties } from 'react';
import type { GlobalToken } from 'antd';
import { adjustHex, hexToRgba } from '../utils/colorUtils';

/**
 * 通用样式工具库
 * 提供可复用的样式函数和样式常量，确保整个应用的视觉一致性
 */

// ==================== 样式常量 ====================

export const TRANSITIONS = {
  fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const ELEVATIONS = {
  none: 'none',
  sm: '0 2px 4px rgba(0,0,0,0.02)',
  base: '0 2px 8px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
  lg: '0 6px 16px rgba(0,0,0,0.12)',
  xl: '0 8px 24px rgba(0,0,0,0.15)',
} as const;

// ==================== 渐变背景 ====================

/**
 * 创建渐变背景
 */
export const createGradientBg = (
  token: GlobalToken,
  angle: number = 135,
  fromOpacity: number = 1,
  toOpacity: number = 1
): string => {
  const from = token.colorPrimaryBg || token.colorBgContainer;
  const to = token.colorBgContainer;
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
};

/**
 * 创建主题色渐变背景
 */
export const createPrimaryGradient = (
  token: GlobalToken,
  angle: number = 90
): string => {
  return `linear-gradient(${angle}deg, ${token.colorPrimary}, ${token.colorPrimaryActive || token.colorPrimary})`;
};

// ==================== 卡片样式 ====================

/**
 * 创建美化的卡片样式
 */
export const createCardStyle = (token: GlobalToken, hover: boolean = false): CSSProperties => ({
  background: token.colorBgContainer,
  border: `1px solid ${token.colorBorderSecondary}`,
  borderRadius: token.borderRadiusLG,
  boxShadow: hover ? ELEVATIONS.md : ELEVATIONS.base,
  transition: `all ${TRANSITIONS.normal}`,
});

/**
 * 创建带顶部渐变条的卡片样式
 */
export const createAccentCardStyle = (token: GlobalToken): CSSProperties => ({
  ...createCardStyle(token),
  position: 'relative',
  overflow: 'hidden',
});

/**
 * 创建卡片顶部渐变条
 */
export const createCardAccentBar = (token: GlobalToken, height: number = 3): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height,
  background: createPrimaryGradient(token),
});

/**
 * 卡片悬停效果处理器
 */
export const createCardHoverHandlers = (token: GlobalToken) => ({
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget as HTMLElement;
    target.style.transform = 'translateY(-4px)';
    target.style.boxShadow = ELEVATIONS.lg;
    target.style.borderColor = token.colorPrimary;
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget as HTMLElement;
    target.style.transform = 'translateY(0)';
    target.style.boxShadow = ELEVATIONS.base;
    target.style.borderColor = token.colorBorderSecondary;
  },
});

// ==================== 容器样式 ====================

/**
 * 创建美化的容器样式
 */
export const createContainerStyle = (
  token: GlobalToken,
  withGradient: boolean = false
): CSSProperties => ({
  background: withGradient
    ? createGradientBg(token, 135)
    : token.colorBgContainer,
  borderRadius: token.borderRadiusLG,
  padding: '16px 20px',
  border: `1px solid ${token.colorBorderSecondary}`,
  boxShadow: ELEVATIONS.sm,
});

/**
 * 创建信息展示容器样式
 */
export const createInfoBoxStyle = (token: GlobalToken): CSSProperties => ({
  background: token.colorBgLayout,
  borderRadius: token.borderRadiusLG,
  padding: '12px 16px',
  border: `1px solid ${token.colorBorderSecondary}`,
});

// ==================== 按钮样式 ====================

/**
 * 创建圆角按钮样式
 */
export const createRoundedButtonStyle = (token: GlobalToken): CSSProperties => ({
  borderRadius: token.borderRadius,
});

/**
 * 创建主要按钮样式
 */
export const createPrimaryButtonStyle = (token: GlobalToken): CSSProperties => ({
  borderRadius: token.borderRadiusLG,
  boxShadow: ELEVATIONS.sm,
});

// ==================== 分隔线样式 ====================

/**
 * 创建垂直分隔线样式
 */
export const createVerticalDivider = (
  token: GlobalToken,
  height: number = 24
): CSSProperties => ({
  height,
  width: 1,
  background: token.colorBorderSecondary,
});

// ==================== 标题样式 ====================

/**
 * 创建页面标题样式
 */
export const createPageTitleStyle = (token: GlobalToken): CSSProperties => ({
  fontSize: 16,
  fontWeight: 600,
  color: token.colorText,
  margin: 0,
  letterSpacing: '0.03em',
});

/**
 * 创建区块标题样式
 */
export const createSectionTitleStyle = (token: GlobalToken): CSSProperties => ({
  fontSize: 15,
  fontWeight: 600,
  color: token.colorText,
  margin: 0,
});

/**
 * 创建卡片标题样式
 */
export const createCardTitleStyle = (token: GlobalToken): CSSProperties => ({
  fontSize: 14,
  fontWeight: 600,
  color: token.colorText,
  margin: 0,
});

// ==================== 文本样式 ====================

export interface AvatarStyleOptions {
  themeMode?: 'light' | 'dark';
}

export interface AvatarHoverStyle {
  style: CSSProperties;
  hoverStyle: CSSProperties;
}

export const createAvatarStyle = (
  token: GlobalToken,
  options: AvatarStyleOptions = {},
): AvatarHoverStyle => {
  const { themeMode = 'light' } = options;

  const isDark = themeMode === 'dark';
  const baseShadow = isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.45)'
    : '0 12px 32px rgba(15, 76, 129, 0.16)';

  const primary = token.colorPrimary;
  const softened = adjustHex(primary, isDark ? 8 : -6) ?? primary;
  const borderColor = adjustHex(primary, isDark ? -24 : -12) ?? primary;

  const hoverBg = adjustHex(primary, isDark ? 18 : -14) ?? primary;
  const hoverBorder = adjustHex(primary, isDark ? -18 : -20) ?? primary;

  const style: CSSProperties = {
    backgroundColor: softened,
    color: token.colorWhite,
    border: `1px solid ${borderColor}`,
    boxShadow: baseShadow,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    transition: `background-color ${TRANSITIONS.normal}, box-shadow ${TRANSITIONS.normal}, transform ${TRANSITIONS.fast}, border-color ${TRANSITIONS.fast}`,
  };

  const hoverStyle: CSSProperties = {
    backgroundColor: hoverBg,
    borderColor: hoverBorder,
    boxShadow: isDark
      ? '0 16px 36px rgba(0, 0, 0, 0.55)'
      : '0 16px 36px rgba(15, 76, 129, 0.22)',
    transform: 'translateY(-2px)',
  };

  return { style, hoverStyle };
};

/**
 * 创建次要文本样式
 */
export const createSecondaryTextStyle = (token: GlobalToken): CSSProperties => ({
  fontSize: 13,
  color: token.colorTextSecondary,
});

/**
 * 创建小号文本样式
 */
export const createSmallTextStyle = (token: GlobalToken): CSSProperties => ({
  fontSize: 12,
  color: token.colorTextSecondary,
});

// ==================== 输入框样式 ====================

/**
 * 创建输入框样式
 */
export const createInputStyle = (token: GlobalToken): CSSProperties => ({
  borderRadius: token.borderRadius,
});

// ==================== 表格样式 ====================

/**
 * 创建表格样式
 */
export const createTableStyle = (token: GlobalToken): CSSProperties => ({
  borderRadius: token.borderRadiusLG,
});

// ==================== 模态框样式 ====================

/**
 * 创建模态框标题样式
 */
export const createModalHeaderStyle = (token: GlobalToken): CSSProperties => ({
  background: createGradientBg(token, 135),
  borderBottom: `1px solid ${token.colorBorderSecondary}`,
  padding: '16px 24px',
  borderRadius: `${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0`,
});

/**
 * 创建模态框内容样式
 */
export const createModalBodyStyle = (token: GlobalToken): CSSProperties => ({
  padding: '24px',
  maxHeight: '70vh',
  overflowY: 'auto',
});

/**
 * 创建代码展示区域样式
 */
export const createCodeBlockStyle = (token: GlobalToken): CSSProperties => ({
  background: token.colorBgContainer,
  border: `1px solid ${token.colorBorder}`,
  borderRadius: token.borderRadiusLG,
  padding: '16px',
  maxHeight: '50vh',
  overflowY: 'auto',
  fontFamily: 'monospace',
  fontSize: 13,
  lineHeight: 1.6,
});

// ==================== 筛选面板样式 ====================

/**
 * 创建筛选面板样式
 */
export const createFilterPanelStyle = (token: GlobalToken): CSSProperties => ({
  border: 'none',
  background: token.colorBgContainer,
  borderRadius: token.borderRadiusLG,
  boxShadow: ELEVATIONS.sm,
});

/**
 * 创建批量操作栏样式
 */
export const createBatchActionsStyle = (token: GlobalToken): CSSProperties => ({
  background: createGradientBg(token, 135),
  borderRadius: token.borderRadiusLG,
  padding: '16px',
  border: `1px solid ${token.colorBorderSecondary}`,
  boxShadow: ELEVATIONS.sm,
});

// ==================== 响应式间距 ====================

/**
 * 根据设备方向返回不同的间距
 */
export const getResponsiveSpacing = (isLandscape: boolean) => ({
  cardPadding: isLandscape ? 16 : 12,
  gap: isLandscape ? 8 : 6,
  margin: isLandscape ? 16 : 12,
});

// ==================== 动画关键帧 ====================

/**
 * 淡入动画
 */
export const fadeIn: CSSProperties = {
  animation: 'fadeIn 0.3s ease-in',
};

/**
 * 滑入动画
 */
export const slideIn: CSSProperties = {
  animation: 'slideIn 0.3s ease-out',
};

// ==================== 工具函数 ====================

/**
 * 合并多个样式对象
 */
export const mergeStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return Object.assign({}, ...styles.filter(Boolean));
};

/**
 * 条件样式
 */
export const conditionalStyle = (
  condition: boolean,
  trueStyle: CSSProperties,
  falseStyle: CSSProperties = {}
): CSSProperties => {
  return condition ? trueStyle : falseStyle;
};
