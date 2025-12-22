import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Tabs,
  Statistic,
  Row,
  Col,
  Input,
  Button,
  Spin,
  Empty,
  Tag,
  Space,
  Typography,
  message,
  Select,
  Modal,
  Form,
  InputNumber,
  Checkbox,
  Pagination,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { TabsProps } from 'antd';
import { snmpApi, type SNMPMonitorTaskDetail, type SNMPMonitorStats } from '../../api/snmp';
import { naturalCompare } from '../../utils/sort';
import SNMPTaskManagement from './SNMPTaskManagement';
import SNMPMetricConfig from './SNMPMetricConfig';
import SNMPTaskHistoryModal from './SNMPTaskHistoryModal';

const { Search } = Input;
const { Text } = Typography;
const DEFAULT_REFRESH_INTERVAL = 30; // 秒
const REFRESH_MIN_SECONDS = 10;
const REFRESH_MAX_SECONDS = 600;
const PAGE_SIZE = 6;
interface SNMPMonitorDashboardProps {
  canManageBuiltin?: boolean;
}

export default function SNMPMonitorDashboard({ canManageBuiltin = false }: SNMPMonitorDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState<SNMPMonitorTaskDetail[]>([]);
  const [stats, setStats] = useState<SNMPMonitorStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [siteFilter, setSiteFilter] = useState<string | undefined>(undefined);
  const [historyTask, setHistoryTask] = useState<SNMPMonitorTaskDetail | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cleanupModalVisible, setCleanupModalVisible] = useState(false);
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const [cleanupForm] = Form.useForm();
  const deleteAllCleanup = Form.useWatch('deleteAll', cleanupForm) ?? false;
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('snmp_dashboard_auto_refresh');
      if (stored === 'false') {
        return false;
      }
    }
    return true;
  });
  const [refreshSeconds, setRefreshSeconds] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('snmp_dashboard_refresh');
      const parsed = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsed) && parsed >= REFRESH_MIN_SECONDS && parsed <= REFRESH_MAX_SECONDS) {
        return parsed;
      }
    }
    return DEFAULT_REFRESH_INTERVAL;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, statsData] = await Promise.all([
        snmpApi.getTasks({ enabled: true }),
        snmpApi.getStats(),
      ]);
      setTasks(tasksData);
      setStats(statsData);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snmp_dashboard_auto_refresh', autoRefreshEnabled ? 'true' : 'false');
    }
  }, [autoRefreshEnabled]);

  useEffect(() => {
    if (activeTab !== 'dashboard') {
      return;
    }
    loadData();
    if (!autoRefreshEnabled) {
      return;
    }
    const interval = setInterval(loadData, refreshSeconds * 1000);
    return () => clearInterval(interval);
  }, [activeTab, autoRefreshEnabled, loadData, refreshSeconds]);

  const siteOptions = useMemo(() => {
    const unique = Array.from(
      tasks.reduce((acc, task) => {
        if (task.host_site) {
          acc.add(task.host_site);
        }
        return acc;
      }, new Set<string>()),
    ).sort((a, b) => naturalCompare(a, b));
    return unique.map((site) => ({ label: site, value: site }));
  }, [tasks]);

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchText.toLowerCase();
    if (siteFilter && (task.host_site || '') !== siteFilter) {
      return false;
    }
    return (
      task.name.toLowerCase().includes(searchLower) ||
      task.host_name?.toLowerCase().includes(searchLower) ||
      task.metric_name?.toLowerCase().includes(searchLower)
    );
  });

  // 按主机分组
  const hostEntries = useMemo(() => {
    const groups = filteredTasks.reduce((acc, task) => {
      const hostName = task.host_name || 'Unknown';
      if (!acc[hostName]) {
        acc[hostName] = [] as SNMPMonitorTaskDetail[];
      }
      acc[hostName].push(task);
      return acc;
    }, {} as Record<string, SNMPMonitorTaskDetail[]>);

    return Object.entries(groups)
      .map(([hostName, tasks]) => {
        const sortedTasks = [...tasks].sort((a, b) => (a.metric_id ?? 0) - (b.metric_id ?? 0));
        return {
          hostName,
          hostHostname: sortedTasks[0]?.host_hostname,
          tasks: sortedTasks,
        };
      })
      .sort((a, b) => naturalCompare(a.hostName, b.hostName));
  }, [filteredTasks]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(hostEntries.length / PAGE_SIZE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [hostEntries, currentPage]);

  const pagedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return hostEntries.slice(start, start + PAGE_SIZE);
  }, [hostEntries, currentPage]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <WarningOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getValueColor = (value: string | undefined, unit: string | undefined): string => {
    if (!value || unit !== '%') return 'inherit';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'inherit';
    if (numValue >= 80) return '#ff4d4f';
    if (numValue >= 60) return '#faad14';
    return '#52c41a';
  };

  const handleOpenHistory = (task: SNMPMonitorTaskDetail) => {
    setHistoryTask(task);
    setHistoryOpen(true);
  };

  const handleCloseHistory = () => {
    setHistoryOpen(false);
    setHistoryTask(null);
  };

  const handleRefreshChange = (value: number | null) => {
    if (!value) return;
    const clamped = Math.min(Math.max(value, REFRESH_MIN_SECONDS), REFRESH_MAX_SECONDS);
    setRefreshSeconds(clamped);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snmp_dashboard_refresh', String(clamped));
    }
  };

  const handleOpenCleanup = () => {
    cleanupForm.setFieldsValue({ days: 90, deleteAll: false });
    setCleanupModalVisible(true);
  };

  const handleCleanupSubmit = async () => {
    try {
      const values = await cleanupForm.validateFields();
      setCleanupSubmitting(true);
      await snmpApi.cleanupHistory({
        days: values.deleteAll ? undefined : values.days,
        deleteAll: values.deleteAll,
      });
      message.success('历史数据清理完成');
      setCleanupModalVisible(false);
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.response?.data?.detail || '清理失败');
    } finally {
      setCleanupSubmitting(false);
    }
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'dashboard',
      label: '监控仪表板',
      children: (
        <div>
          {/* 统计卡片 */}
          {stats && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={24} md={6}>
                <Card>
                  <Statistic
                    title="总任务数"
                    value={stats.total_tasks}
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Card>
              </Col>
              <Col span={24} md={6}>
                <Card>
                  <Statistic
                    title="活动任务"
                    value={stats.active_tasks}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={24} md={6}>
                <Card>
                  <Statistic
                    title="失败任务"
                    value={stats.failed_tasks}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={24} md={6}>
                <Card>
                  <Statistic
                    title="监控主机"
                    value={stats.total_hosts}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* 搜索和刷新 */}
          <Card style={{ marginBottom: 16 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }} wrap>
              <Space size="middle" wrap>
                <Search
                  placeholder="搜索主机或指标..."
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: 260 }}
                  allowClear
                />
                <Select
                  allowClear
                  placeholder="按站点筛选"
                  style={{ minWidth: 180 }}
                  options={siteOptions}
                  value={siteFilter}
                  onChange={(value) => {
                    setSiteFilter(value ?? undefined);
                    setCurrentPage(1);
                  }}
                />
              </Space>
              <Space size="middle" align="center" wrap>
                <Space size={8} align="center">
                  <Button onClick={() => setAutoRefreshEnabled((prev) => !prev)}>
                    自动刷新：{autoRefreshEnabled ? '开启' : '关闭'}
                  </Button>
                  <InputNumber
                    min={REFRESH_MIN_SECONDS}
                    max={REFRESH_MAX_SECONDS}
                    value={refreshSeconds}
                    onChange={handleRefreshChange}
                    addonAfter="秒"
                    style={{ width: 140 }}
                    disabled={!autoRefreshEnabled}
                  />
                </Space>
                {canManageBuiltin && (
                  <Button onClick={handleOpenCleanup}>清理历史数据</Button>
                )}
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadData}
                  loading={loading}
                >
                  刷新
                </Button>
              </Space>
            </Space>
          </Card>

          {/* 设备监控卡片 */}
          {loading ? (
            <Card>
              <Spin tip="加载中..." />
            </Card>
          ) : hostEntries.length === 0 ? (
            <Card>
              <Empty description={searchText || siteFilter ? '没有找到匹配的监控任务' : '暂无监控任务'} />
            </Card>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {pagedEntries.map(({ hostName, hostHostname, tasks }) => (
                  <Col span={24} md={12} lg={8} key={hostName}>
                    <Card
                      title={
                        <Space>
                          <Text strong>{hostName}</Text>
                          <Tag>{hostHostname}</Tag>
                        </Space>
                      }
                      size="small"
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {tasks.map((task) => (
                          <Card
                            key={task.id}
                            hoverable
                            size="small"
                            style={{
                              backgroundColor: task.last_status === 'failed' ? '#fff1f0' : undefined,
                              cursor: 'pointer',
                            }}
                            onClick={() => handleOpenHistory(task)}
                          >
                            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Space size={8}>
                                  {getStatusBadge(task.last_status)}
                                  <Text strong style={{ fontSize: 13 }}>
                                    {task.metric_name}
                                  </Text>
                                </Space>
                                {task.last_value && (
                                  <Text
                                    strong
                                    style={{
                                      fontSize: 16,
                                      color: getValueColor(task.last_value, task.metric_unit),
                                    }}
                                  >
                                    {task.last_value}
                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 2 }}>
                                      {task.metric_unit}
                                    </Text>
                                  </Text>
                                )}
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {task.last_poll_at
                                  ? `最后采集: ${new Date(task.last_poll_at).toLocaleString('zh-CN')}`
                                  : '未采集'}
                              </Text>
                              {task.last_status === 'failed' && task.last_error && (
                                <Text type="danger" style={{ fontSize: 12 }}>
                                  错误: {task.last_error}
                                </Text>
                              )}
                              {task.alerts && task.alerts.length > 0 && (
                                <Space size={4} wrap>
                                  {task.alerts.map((alert) => (
                                    <Tag
                                      key={alert.id}
                                      color={alert.severity === 'critical' ? 'red' : 'orange'}
                                      style={{ fontSize: 11 }}
                                    >
                                      {alert.condition} {alert.threshold}
                                    </Tag>
                                  ))}
                                </Space>
                              )}
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
              {hostEntries.length > PAGE_SIZE && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Pagination
                    current={currentPage}
                    pageSize={PAGE_SIZE}
                    total={hostEntries.length}
                    onChange={(page) => setCurrentPage(page)}
                    showSizeChanger={false}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'tasks',
      label: '任务管理',
      children: <SNMPTaskManagement onTasksChange={loadData} />,
    },
    {
      key: 'metrics',
      label: '指标配置',
      children: <SNMPMetricConfig canManageBuiltin={canManageBuiltin} />,
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
      <SNMPTaskHistoryModal open={historyOpen} task={historyTask} onClose={handleCloseHistory} />
      <Modal
        open={cleanupModalVisible}
        title="清理历史数据"
        onCancel={() => setCleanupModalVisible(false)}
        onOk={handleCleanupSubmit}
        confirmLoading={cleanupSubmitting}
        destroyOnClose
      >
        <Form
          form={cleanupForm}
          layout="vertical"
          initialValues={{
            days: 90,
            deleteAll: false,
          }}
        >
          <Form.Item name="deleteAll" valuePropName="checked">
            <Checkbox>立刻清空所有历史数据</Checkbox>
          </Form.Item>
          <Form.Item
            label="保留天数"
            name="days"
            rules={[
              { required: true, message: '请输入保留的天数' },
              { type: 'number', min: 0, message: '天数不能为负' },
            ]}
          >
            <InputNumber
              min={0}
              addonAfter="天"
              style={{ width: '100%' }}
              disabled={deleteAllCleanup}
            />
          </Form.Item>
          <Text type="secondary">
            默认保留最近 90 天的数据。如需彻底清空历史，可勾选“立刻清空所有历史数据”。
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
