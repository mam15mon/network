import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Space, Spin, Statistic, Typography, DatePicker, Radio, theme } from 'antd';
import type { RadioChangeEvent } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';

import { hexToRgba, hexToRgb } from '../../utils/colorUtils';

import { snmpApi, type SNMPDataPoint, type SNMPMonitorTaskDetail } from '../../api/snmp';

const { RangePicker } = DatePicker;
const { Text } = Typography;

type ChartDatum = SNMPDataPoint & {
  numericValue: number;
  timestampDate: Date;
  timestampMs: number;
};

interface SNMPTaskHistoryModalProps {
  open: boolean;
  task: SNMPMonitorTaskDetail | null;
  onClose: () => void;
}

const QUICK_RANGES: Array<{ label: string; hours: number }> = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '24 小时', hours: 24 },
  { label: '3 天', hours: 72 },
];

const toRgb = (value: string): { r: number; g: number; b: number } | null => {
  if (!value) return null;
  if (value.startsWith('#')) {
    return hexToRgb(value);
  }
  const match = value.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
};

export default function SNMPTaskHistoryModal({ open, task, onClose }: SNMPTaskHistoryModalProps) {
  const [rangeValue, setRangeValue] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(24, 'hour'),
    dayjs(),
  ]);
  const [activeRange, setActiveRange] = useState<[Dayjs, Dayjs]>(rangeValue);
  const [quickRange, setQuickRange] = useState<number>(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<ChartDatum[]>([]);
  const { token } = theme.useToken();

  const isDarkMode = useMemo(() => {
    const bg = token.colorBgLayout || '#ffffff';
    const rgb = toRgb(bg) ?? { r: 255, g: 255, b: 255 };
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.5;
  }, [token.colorBgLayout]);

  const chartColors = useMemo(() => {
    const primary = token.colorPrimary || '#1677ff';
    const success = token.colorSuccess || '#52c41a';
    const axisLabel = token.colorTextSecondary || '#8c8c8c';
    const border = token.colorBorder || '#2f3a55';
    const borderSecondary = token.colorBorderSecondary || border;
    const cardBg = token.colorBgContainer || '#ffffff';
    const elevatedBg = token.colorBgElevated || cardBg;
    const tooltipText = token.colorText || '#1f2937';

    const grid = hexToRgba(border, isDarkMode ? 0.35 : 0.16) ?? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)');
    const axisBase = hexToRgba(border, isDarkMode ? 0.65 : 0.35) ?? border;
    const brushFill = hexToRgba(primary, isDarkMode ? 0.2 : 0.12) ?? primary;
    const tooltipBg = isDarkMode ? 'rgba(12, 18, 39, 0.92)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = hexToRgba(primary, isDarkMode ? 0.55 : 0.28) ?? primary;

    return {
      background: isDarkMode ? elevatedBg : cardBg,
      border: hexToRgba(borderSecondary, isDarkMode ? 0.45 : 0.18) ?? borderSecondary,
      grid,
      axisLine: axisBase,
      axisLabel,
      lineGradientTop: hexToRgba(primary, isDarkMode ? 0.92 : 0.85) ?? primary,
      lineGradientBottom: hexToRgba(primary, isDarkMode ? 0.28 : 0.18) ?? primary,
      lineHighlight: success,
      brushStroke: primary,
      brushFill,
      tooltipBg,
      tooltipBorder,
      tooltipText: isDarkMode ? '#f5f9ff' : tooltipText,
    };
  }, [isDarkMode, token]);

  const yAxisDomain = useMemo(() => {
    if (rawData.length === 0) {
      return ['auto', 'auto'] as const;
    }
    const values = rawData.map((item) => item.numericValue);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      const base = min;
      if (base === 0) {
        return [-1, 1] as const;
      }
      if (base > 0) {
        return [Math.max(0, base * 0.5), base * 1.5] as const;
      }
      return [base * 1.5, Math.min(0, base * 0.5)] as const;
    }
    return ['auto', 'auto'] as const;
  }, [rawData]);

  const loadData = useCallback(async () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const [start, end] = activeRange;
      const hoursDiff = Math.ceil(end.diff(start, 'hour', true));
      const data = await snmpApi.getTaskData(task.id, {
        hours: hoursDiff > 0 ? hoursDiff : 24,
      });

      // 过滤数据到选定的时间范围
      const startMs = start.valueOf();
      const endMs = end.valueOf();

      const processed: ChartDatum[] = data
        .map((point) => {
          const numericValue = Number.parseFloat(point.value);
          const timestampDate = new Date(point.timestamp);
          return {
            ...point,
            numericValue,
            timestampDate,
            timestampMs: timestampDate.getTime(),
          } satisfies ChartDatum;
        })
        .filter((point) => {
          if (!Number.isFinite(point.numericValue)) {
            return false;
          }
          // 过滤到选定的时间范围内
          const inRange = point.timestampMs >= startMs && point.timestampMs <= endMs;
          return inRange;
        })
        .sort((a, b) => a.timestampMs - b.timestampMs);

      setRawData(processed);
    } catch (err: any) {
      setError(err?.response?.data?.detail || '加载历史数据失败');
    } finally {
      setLoading(false);
    }
  }, [activeRange, task]);

  useEffect(() => {
    if (open && task) {
      loadData();
    }
  }, [open, task, loadData]);

  useEffect(() => {
    if (!open) {
      const defaultRange: [Dayjs, Dayjs] = [dayjs().subtract(24, 'hour'), dayjs()];
      setRangeValue(defaultRange);
      setActiveRange(defaultRange);
      setQuickRange(24);
      setRawData([]);
      setError(null);
    }
  }, [open]);

  const unitSuffix = task?.metric_unit ? ` ${task.metric_unit}` : '';

  const handleRangeChange = (value: null | [Dayjs | null, Dayjs | null]) => {
    if (!value) return;
    const [start, end] = value;
    if (start && end) {
      setRangeValue([start, end]);
    }
  };

  const applyRange = () => {
    if (!rangeValue?.[0] || !rangeValue?.[1]) return;
    setActiveRange(rangeValue);
  };

  const handleQuickRangeChange = (event: RadioChangeEvent) => {
    const hours = event.target.value as number;
    setQuickRange(hours);
    const newRange: [Dayjs, Dayjs] = [dayjs().subtract(hours, 'hour'), dayjs()];
    setRangeValue(newRange);
    setActiveRange(newRange);
  };

  const formatXAxis = useCallback((timestamp: number) => dayjs(timestamp).format('MM-DD HH:mm'), []);
  const formatTooltipLabel = useCallback((timestamp: number) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'), []);

  const renderTooltip = useCallback(
    ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number | string }) => {
      if (!active || !payload || payload.length === 0) {
        return null;
      }
      const datum = payload[0]?.payload as ChartDatum | undefined;
      if (!datum) return null;
      const resolvedLabel = formatTooltipLabel(typeof label === 'number' ? label : datum.timestampMs);
      return (
        <div
          style={{
            background: chartColors.tooltipBg,
            border: `1px solid ${chartColors.tooltipBorder}`,
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ color: chartColors.tooltipText, fontSize: 12, marginBottom: 4 }}>{resolvedLabel}</div>
          <div style={{ color: chartColors.tooltipText, fontWeight: 600 }}>
            值: {datum.numericValue}
            {unitSuffix}
          </div>
        </div>
      );
    },
    [chartColors.tooltipBg, chartColors.tooltipBorder, chartColors.tooltipText, formatTooltipLabel, unitSuffix]
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      title={task ? `${task.host_name || task.name} - ${task.metric_name}` : '历史数据'}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Radio.Group value={quickRange} onChange={handleQuickRangeChange} optionType="button">
            {QUICK_RANGES.map((item) => (
              <Radio.Button key={item.hours} value={item.hours}>
                {item.label}
              </Radio.Button>
            ))}
          </Radio.Group>

          <Space size="middle" align="center">
            <RangePicker
              value={rangeValue}
              showTime
              format="YYYY-MM-DD HH:mm"
              onChange={handleRangeChange}
              onOk={applyRange}
              allowClear={false}
              style={{ width: 320 }}
            />
            <Button type="primary" onClick={applyRange}>
              应用
            </Button>
          </Space>
        </Space>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="加载中..." />
          </div>
        ) : error ? (
          <Alert type="error" message={error} showIcon />
        ) : rawData.length === 0 ? (
          <Alert type="info" message="选定时间范围内暂无数据" showIcon />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space size="large">
              <Statistic title="数据点数量" value={rawData.length} />
            </Space>
            <div
              style={{
                height: 420,
                background: chartColors.background,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${chartColors.border}`,
                padding: 12,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rawData} margin={{ top: 16, right: 28, left: 8, bottom: 12 }}>
                  <defs>
                    <linearGradient id="metricLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.lineGradientTop} />
                      <stop offset="100%" stopColor={chartColors.lineGradientBottom} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="timestampMs"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatXAxis}
                    tick={{ fill: chartColors.axisLabel, fontSize: 12 }}
                    axisLine={{ stroke: chartColors.axisLine }}
                    tickLine={{ stroke: chartColors.axisLine }}
                    label={{ value: '采集时间', position: 'insideBottom', offset: -4, fill: chartColors.axisLabel }}
                  />
                  <YAxis
                    label={{
                      value: `指标值${unitSuffix}`.trim(),
                      angle: -90,
                      position: 'insideLeft',
                      fill: chartColors.axisLabel,
                    }}
                    tick={{ fill: chartColors.axisLabel, fontSize: 12 }}
                    axisLine={{ stroke: chartColors.axisLine }}
                    tickLine={{ stroke: chartColors.axisLine }}
                    domain={yAxisDomain as [number | 'auto', number | 'auto']}
                  />
                  <Tooltip content={renderTooltip} />
                  <Line
                    type="monotone"
                    dataKey="numericValue"
                    stroke={chartColors.lineGradientTop}
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 5, stroke: chartColors.lineHighlight, strokeWidth: 2 }}
                  />
                  <Brush
                    dataKey="timestampMs"
                    height={30}
                    stroke={chartColors.brushStroke}
                    tickFormatter={formatXAxis}
                    fill={chartColors.brushFill}
                    travellerWidth={12}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Text type="secondary">
              使用底部滑块缩放时间范围，鼠标悬停可查看采集明细。
            </Text>
          </Space>
        )}
      </Space>
    </Modal>
  );
}
