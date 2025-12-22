# Nornir 前端样式指南

## 概述

本项目采用统一的样式系统，确保整个应用的视觉一致性和可维护性。所有可复用的样式函数和常量都集中在 `src/styles/commonStyles.ts` 中。

## 主题系统

### 支持的主题

项目支持 5 种主题配色方案，并且每种配色都提供亮色与暗色模式：

1. **经典蓝 (Classic)** - 传统蓝色主题
2. **Catppuccin** - 现代柔和配色
3. **Nord** - 北欧风格配色
4. **Dracula** - 高对比暗黑配色
5. **Solarized** - 经典 Solarized 配色

### 切换主题

用户可以通过右上角的主题切换器选择：
- 亮色模式
- 暗色模式
- 跟随系统

主题选择会自动保存到 localStorage，下次访问时自动应用。

### 主题调色板与 token

- 全局主题逻辑位于 `App.tsx`，通过 `themeVariants` 为每个主题定义 `ThemePalette`，并结合 Ant Design 的 `ConfigProvider` 生成 token。
- 在组件中使用 `const { token } = theme.useToken();` 获取主题敏感的样式参数（如 `token.colorBgContainer`、`token.colorTextSecondary`）。
- 需要直接访问调色板时，可在组件内通过 Context 方式获得（参考 `App.tsx` 近 `palette` 的 `useMemo`），避免硬编码颜色值。
- 尽量使用 token 或通过 `hexToRgba`、`adjustHex` 等工具函数从主题主色衍生渐变、描边、阴影。

### 明暗色模式适配

1. 判断当前主题模式：
   ```ts
   import { hexToRgb, hexToRgba } from "../utils/colorUtils";
   const { token } = theme.useToken();
   const toRgb = (value: string) => hexToRgb(value) ?? { r: 255, g: 255, b: 255 };
   const isDarkMode = useMemo(() => {
     const rgb = toRgb(token.colorBgLayout ?? '#ffffff');
     const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
     return luminance < 0.5;
   }, [token.colorBgLayout]);
   ```
2. 根据明暗模式控制透明度/对比度。例如：
   ```ts
   const gridColor = hexToRgba(token.colorBorder, isDarkMode ? 0.35 : 0.16) ?? token.colorBorder;
   const tooltipBg = isDarkMode ? 'rgba(12, 18, 39, 0.92)' : 'rgba(255, 255, 255, 0.95)';
   ```
3. 避免使用固定的白/黑背景，优先使用 `token.colorBgLayout`、`token.colorBgContainer`、`token.colorTextSecondary` 等可自动切换的 token。

### 多主题下的 Recharts / 图表风格

```tsx
const { token } = theme.useToken();
const chartColors = useMemo(() => ({
  background: token.colorBgContainer,
  grid: hexToRgba(token.colorBorder, isDarkMode ? 0.35 : 0.16) ?? token.colorBorder,
  axisLine: hexToRgba(token.colorBorder, isDarkMode ? 0.65 : 0.35) ?? token.colorBorder,
  axisLabel: token.colorTextSecondary,
  stroke: token.colorPrimary,
  highlight: token.colorSuccess,
  brushFill: hexToRgba(token.colorPrimary, isDarkMode ? 0.20 : 0.12) ?? token.colorPrimary,
}), [token, isDarkMode]);

return (
  <ResponsiveContainer>
    <LineChart data={data}>
      <CartesianGrid stroke={chartColors.grid} />
      <XAxis tick={{ fill: chartColors.axisLabel }} axisLine={{ stroke: chartColors.axisLine }} />
      <Line stroke={chartColors.stroke} activeDot={{ stroke: chartColors.highlight }} />
      <Brush fill={chartColors.brushFill} />
    </LineChart>
  </ResponsiveContainer>
);
```

- 鼠标提示框建议使用主题背景：`token.colorBgElevated` 或根据主色转换。
- 如果组件需要渐变，可通过 `hexToRgba(token.colorPrimary, alpha)` 生成明暗兼容的渐变色。
- 避免单独写 `#0d1333` 等固定色值，除非已经确认该颜色在所有主题下都可读。

## 样式工具库

### 导入样式工具

```typescript
import {
  createGradientBg,
  createPrimaryGradient,
  createCardStyle,
  createContainerStyle,
  createPrimaryButtonStyle,
  createRoundedButtonStyle,
  createVerticalDivider,
  ELEVATIONS,
  TRANSITIONS,
} from "../styles/commonStyles";
import { theme } from "antd";

// 在组件中使用
const { token } = theme.useToken();
```

### 常用样式函数

#### 1. 容器样式

```typescript
// 创建美化的容器（带渐变背景）
<div style={createContainerStyle(token, true)}>
  {/* 内容 */}
</div>

// 创建信息展示容器
<div style={createInfoBoxStyle(token)}>
  {/* 内容 */}
</div>
```

#### 2. 卡片样式

```typescript
// 基础卡片样式
<Card style={createCardStyle(token)}>
  {/* 内容 */}
</Card>

// 带悬停效果的卡片
const hoverHandlers = createCardHoverHandlers(token);
<Card
  style={createCardStyle(token)}
  {...hoverHandlers}
>
  {/* 内容 */}
</Card>

// 创建卡片顶部渐变条
<div style={createCardAccentBar(token, 3)} />
```

#### 3. 按钮样式

```typescript
// 主要按钮
<Button
  type="primary"
  style={createPrimaryButtonStyle(token)}
>
  提交
</Button>

// 圆角按钮
<Button style={createRoundedButtonStyle(token)}>
  操作
</Button>
```

#### 4. 分隔线

```typescript
// 垂直分隔线
<div style={createVerticalDivider(token, 24)} />
```

#### 5. 模态框样式

```typescript
<Modal
  title="标题"
  open={visible}
  styles={{
    header: createModalHeaderStyle(token),
    body: createModalBodyStyle(token),
  }}
>
  {/* 代码展示区域 */}
  <div style={createCodeBlockStyle(token)}>
    <pre>{code}</pre>
  </div>
</Modal>
```

#### 6. 筛选面板和批量操作

```typescript
// 筛选面板样式
const filterPanelStyle = createFilterPanelStyle(token);

// 批量操作栏样式
<div style={createBatchActionsStyle(token)}>
  {/* 批量操作按钮 */}
</div>
```

### 样式常量

#### 阴影效果

```typescript
import { ELEVATIONS } from "../styles/commonStyles";

// 使用预定义的阴影
boxShadow: ELEVATIONS.sm    // 小阴影
boxShadow: ELEVATIONS.base  // 基础阴影
boxShadow: ELEVATIONS.md    // 中等阴影
boxShadow: ELEVATIONS.lg    // 大阴影
boxShadow: ELEVATIONS.xl    // 超大阴影
```

#### 过渡动画

```typescript
import { TRANSITIONS } from "../styles/commonStyles";

// 使用预定义的过渡
transition: `all ${TRANSITIONS.fast}`    // 快速过渡 0.15s
transition: `all ${TRANSITIONS.normal}`  // 正常过渡 0.3s
transition: `all ${TRANSITIONS.slow}`    // 慢速过渡 0.5s
```

### 工具函数

#### 合并样式

```typescript
import { mergeStyles } from "../styles/commonStyles";

const combinedStyle = mergeStyles(
  createCardStyle(token),
  { padding: 20 },
  conditionalStyle
);
```

#### 条件样式

```typescript
import { conditionalStyle } from "../styles/commonStyles";

const style = conditionalStyle(
  isActive,
  { background: token.colorPrimary },
  { background: token.colorBgContainer }
);
```

## 最佳实践

### 1. 始终使用 token

从 Ant Design 的 theme hook 获取 token，确保样式随主题变化：

```typescript
const { token } = theme.useToken();
```

### 2. 优先使用样式函数

不要手写重复的样式代码，使用 `commonStyles.ts` 中的工具函数：

❌ **不推荐：**
```typescript
<div style={{
  background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%)`,
  borderRadius: token.borderRadiusLG,
  padding: '16px 20px',
  border: `1px solid ${token.colorBorderSecondary}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
}}>
```

✅ **推荐：**
```typescript
<div style={createContainerStyle(token, true)}>
```

### 3. 保持一致的间距和圆角

使用 token 中的预定义值：
- `token.borderRadius` - 基础圆角
- `token.borderRadiusLG` - 大圆角
- `token.borderRadiusSM` - 小圆角

### 4. 统一的图标使用

在标题区域添加图标以提升视觉效果：

```typescript
<Space align="center">
  <CloudServerOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
  <Text strong style={{ fontSize: 15 }}>标题</Text>
</Space>
```

### 5. 表格分页行为

- 所有使用 Table 的列表，在“切换页码”和“更改每页条数”后，应自动滚动回到表格顶部，确保表头重新可见。
- 推荐实现：在表格前插入一个锚点元素并在分页/排序变更时调用 `scrollIntoView`。

示例：

```tsx
// 顶部锚点
const tableTopRef = useRef<HTMLDivElement | null>(null);
<div ref={tableTopRef} />

// Table 事件处理
<Table
  onChange={() => tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
  pagination={{
    onChange: () => tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  }}
/>
```

### 5. 响应式设计

使用 `useOrientation` hook 或 Ant Design 的 Grid 系统：

```typescript
import { useOrientation } from "../hooks/useOrientation";

const orientation = useOrientation();
const isLandscape = orientation === "landscape";

// 或使用 Grid
import { Grid } from "antd";
const screens = Grid.useBreakpoint();
const isMobile = !screens.md;
```

## 组件样式示例

### 顶部状态栏

```typescript
<div style={createContainerStyle(token, true)}>
  <FilterToolbar
    left={
      <Space size="middle" wrap align="center">
        <Space size="small" align="center">
          <DatabaseOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
          <Text strong style={{ fontSize: 15 }}>标题</Text>
        </Space>
        <div style={createVerticalDivider(token)} />
        <StatusTag variant="success">项目 100 条</StatusTag>
      </Space>
    }
    right={
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        style={createPrimaryButtonStyle(token)}
      >
        刷新
      </Button>
    }
  />
</div>
```

### 卡片列表

```typescript
<List
  grid={listGrid}
  dataSource={data}
  renderItem={(item) => (
    <List.Item>
      <Card
        style={{
          ...createCardStyle(token),
          position: 'relative',
          overflow: 'hidden',
          transition: `all ${TRANSITIONS.normal}`,
        }}
        {...createCardHoverHandlers(token)}
      >
        <div style={createCardAccentBar(token, 3)} />
        {/* 卡片内容 */}
      </Card>
    </List.Item>
  )}
/>
```

## 添加新的样式工具

如果需要添加新的可复用样式，请在 `src/styles/commonStyles.ts` 中添加：

1. 创建新的工具函数
2. 导出函数
3. 在本文档中添加使用说明
4. 更新相关组件使用新函数

## 贡献指南

1. 所有新组件都应使用统一的样式系统
2. 发现重复的样式代码时，应提取到 `commonStyles.ts`
3. 保持样式函数的命名一致性
4. 添加 TypeScript 类型定义
5. 更新此文档

## 常见问题

### Q: 如何自定义主题颜色？

A: 在 `App.tsx` 的 `themeVariants` 数组中添加新的主题配置。

### Q: 样式不生效怎么办？

A: 检查是否正确导入并使用了 `token`，确保在 `ConfigProvider` 内部使用。

### Q: 如何调试主题问题？

A: 使用浏览器开发者工具查看 CSS 变量，或在组件中打印 `token` 对象。

---

更新日期：2025-10
维护者：Nornir 开发团队
