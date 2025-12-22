import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Switch,
  Space,
  message,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { snmpApi, type SNMPMonitorTaskDetail, type SNMPMetric } from '../../api/snmp';
import { getHosts, type Host } from '../../api/hosts';

interface SNMPTaskManagementProps {
  onTasksChange?: () => void;
}

export default function SNMPTaskManagement({ onTasksChange }: SNMPTaskManagementProps) {
  const [tasks, setTasks] = useState<SNMPMonitorTaskDetail[]>([]);
  const [metrics, setMetrics] = useState<SNMPMetric[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<SNMPMonitorTaskDetail | null>(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [taskHostFilter, setTaskHostFilter] = useState<number[]>([]);
  const [taskMetricFilter, setTaskMetricFilter] = useState<number[]>([]);
  const [batchSiteSelection, setBatchSiteSelection] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, metricsData, hostsData] = await Promise.all([
        snmpApi.getTasks(),
        snmpApi.getMetrics(),
        getHosts(),
      ]);
      setTasks(tasksData);
      setMetrics(metricsData);
      setHosts(hostsData);
      setSelectedRowKeys([]);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hostOptions = useMemo(() => {
    return hosts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map((h) => ({
        label: `${h.name} (${h.hostname})`,
        value: h.id,
        siteKey: (h.site && h.site.trim().length > 0) ? h.site.trim() : '__NO_SITE__',
        siteLabel: h.site && h.site.trim().length > 0 ? h.site.trim() : '未分组',
      }));
  }, [hosts]);

  const metricOptions = useMemo(
    () =>
      metrics
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        .map((m) => ({ label: m.name, value: m.id })),
    [metrics]
  );

  const siteOptions = useMemo(() => {
    const siteMap = new Map<string, { display: string; count: number }>();
    hosts.forEach((host) => {
      const siteKey = (host.site && host.site.trim().length > 0) ? host.site.trim() : '__NO_SITE__';
      const display = siteKey === '__NO_SITE__' ? '未分组' : siteKey;
      const current = siteMap.get(siteKey) ?? { display, count: 0 };
      current.count += 1;
      siteMap.set(siteKey, current);
    });
    return Array.from(siteMap.entries())
      .sort((a, b) => a[1].display.localeCompare(b[1].display, 'zh-CN'))
      .map(([key, value]) => ({ label: `${value.display} (${value.count})`, value: key }));
  }, [hosts]);

  const handleBatchSiteChange = (sites: string[]) => {
    setBatchSiteSelection(sites);
    if (sites.length === 0) {
      return;
    }
    const siteHostIds = hostOptions
      .filter((option) => sites.includes(option.siteKey))
      .map((option) => option.value);
    const currentHostIds: number[] = batchForm.getFieldValue('host_ids') || [];
    const merged = Array.from(new Set([...currentHostIds, ...siteHostIds]));
    batchForm.setFieldsValue({ host_ids: merged });
  };

  const handleBatchSelectAllHosts = () => {
    batchForm.setFieldsValue({ host_ids: hostOptions.map((option) => option.value) });
    setBatchSiteSelection([]);
  };

  const handleBatchClearHosts = () => {
    batchForm.setFieldsValue({ host_ids: [] });
    setBatchSiteSelection([]);
  };

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (taskHostFilter.length > 0 && !taskHostFilter.includes(task.host_id)) {
          return false;
        }
        if (taskMetricFilter.length > 0 && !taskMetricFilter.includes(task.metric_id)) {
          return false;
        }
        return true;
      }),
    [taskHostFilter, taskMetricFilter, tasks]
  );

  const sortedTasks = useMemo(() => {
    const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
    return filteredTasks
      .slice()
      .sort((a, b) => {
        const hostCompare = collator.compare(a.host_name || '', b.host_name || '');
        if (hostCompare !== 0) return hostCompare;
        const metricCompare = (a.metric_id ?? 0) - (b.metric_id ?? 0);
        if (metricCompare !== 0) return metricCompare;
        return a.id - b.id;
      });
  }, [filteredTasks]);

  useEffect(() => {
    setSelectedRowKeys((prev) =>
      prev.filter((key) => filteredTasks.some((task) => task.id === key))
    );
  }, [filteredTasks]);

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ interval: 300, enabled: true });
    setModalVisible(true);
  };

  const handleEdit = (task: SNMPMonitorTaskDetail) => {
    setEditingTask(task);
    form.setFieldsValue({
      name: task.name,
      host_id: task.host_id,
      metric_id: task.metric_id,
      interval: task.interval,
      enabled: task.enabled,
    });
    setModalVisible(true);
  };

  const handleDelete = (taskId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该监控任务吗？相关的历史数据和告警也会被一并删除。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await snmpApi.deleteTask(taskId);
          message.success('删除成功');
          setSelectedRowKeys((prev) => prev.filter((key) => key !== taskId));
          loadData();
          onTasksChange?.();
        } catch (error: any) {
          message.error(error.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    const taskIds = [...selectedRowKeys];
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${taskIds.length} 个监控任务吗？相关的历史数据和告警将一并删除。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await snmpApi.deleteTasks(taskIds);
          message.success(`已删除 ${taskIds.length} 个任务`);
          setSelectedRowKeys([]);
          loadData();
          onTasksChange?.();
        } catch (error: any) {
          message.error(error.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingTask) {
        await snmpApi.updateTask(editingTask.id, values);
        message.success('更新成功');
      } else {
        const host = hosts.find((h) => h.id === values.host_id);
        const metric = metrics.find((m) => m.id === values.metric_id);
        await snmpApi.createTask({
          ...values,
          name: `${host?.name} - ${metric?.name}`,
        });
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
      onTasksChange?.();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const handleBatchCreate = async () => {
    try {
      const values = await batchForm.validateFields();
      await snmpApi.createBatchTasks(values);
      message.success('批量创建成功');
      setBatchModalVisible(false);
      batchForm.resetFields();
      loadData();
      onTasksChange?.();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.detail || '批量创建失败');
    }
  };

  const handleToggleEnabled = async (task: SNMPMonitorTaskDetail) => {
    try {
      await snmpApi.updateTask(task.id, { enabled: !task.enabled });
      message.success('更新成功');
      loadData();
      onTasksChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '更新失败');
    }
  };

  const columns: ColumnsType<SNMPMonitorTaskDetail> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '主机',
      dataIndex: 'host_name',
      key: 'host_name',
      width: 150,
    },
    {
      title: '监控指标',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 150,
    },
    {
      title: '间隔(秒)',
      dataIndex: 'interval',
      key: 'interval',
      width: 100,
      render: (val: number) => `${val}s`,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          size="small"
        />
      ),
    },
    {
      title: '采集状态',
      dataIndex: 'last_status',
      key: 'last_status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          success: 'success',
          failed: 'error',
          pending: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '最新值',
      dataIndex: 'last_value',
      key: 'last_value',
      width: 120,
      render: (val: string, record) => (val ? `${val}${record.metric_unit || ''}` : '-'),
    },
    {
      title: '最后采集',
      dataIndex: 'last_poll_at',
      key: 'last_poll_at',
      width: 160,
      render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: Key[]) => setSelectedRowKeys(keys as number[]),
  };

  return (
    <div>
      <Card
        extra={
          <Space>
            <Button onClick={() => setBatchModalVisible(true)} icon={<PlusOutlined />}>
              批量添加
            </Button>
            <Button type="primary" onClick={handleCreate} icon={<PlusOutlined />}>
              添加任务
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
            <Button onClick={loadData} icon={<ReloadOutlined />} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            placeholder="按主机筛选"
            value={taskHostFilter}
            options={hostOptions}
            showSearch
            style={{ minWidth: 260 }}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            onChange={setTaskHostFilter}
          />

          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            placeholder="按监控指标筛选"
            value={taskMetricFilter}
            options={metricOptions}
            style={{ minWidth: 220 }}
            onChange={setTaskMetricFilter}
          />

          <Select
            allowClear
            placeholder="按站点快速选择主机"
            style={{ minWidth: 220 }}
            options={siteOptions}
            onChange={(siteKey) => {
              if (!siteKey) {
                return;
              }
              const matchingHostIds = hostOptions
                .filter((option) => option.siteKey === siteKey)
                .map((option) => option.value);
              setTaskHostFilter((prev) => Array.from(new Set([...prev, ...matchingHostIds])));
            }}
          />

          {(taskHostFilter.length > 0 || taskMetricFilter.length > 0) && (
            <Button onClick={() => {
              setTaskHostFilter([]);
              setTaskMetricFilter([]);
            }}>
              清除筛选
            </Button>
          )}
        </Space>

        <Table
          columns={columns}
          dataSource={sortedTasks}
          rowSelection={rowSelection}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 任务表单 */}
      <Modal
        title={editingTask ? '编辑任务' : '添加任务'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="host_id"
            label="主机"
            rules={[{ required: true, message: '请选择主机' }]}
          >
            <Select
              placeholder="请选择主机"
              disabled={!!editingTask}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={hosts.map((h) => ({
                label: `${h.name} (${h.hostname})`,
                value: h.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="metric_id"
            label="监控指标"
            rules={[{ required: true, message: '请选择监控指标' }]}
          >
            <Select
              placeholder="请选择监控指标"
              disabled={!!editingTask}
              options={metrics.map((m) => ({
                label: m.name,
                value: m.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="interval"
            label="采集间隔（秒）"
            rules={[{ required: true, message: '请输入采集间隔' }]}
          >
            <InputNumber min={10} max={86400} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enabled" label="启用监控" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量添加 */}
      <Modal
        title="批量添加监控任务"
        open={batchModalVisible}
        onOk={handleBatchCreate}
        onCancel={() => setBatchModalVisible(false)}
        width={600}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item label="按站点快速选择主机">
            <Space wrap>
              <Select
                mode="multiple"
                allowClear
                placeholder="请选择站点"
                maxTagCount="responsive"
                value={batchSiteSelection}
                options={siteOptions}
                style={{ minWidth: 260 }}
                onChange={handleBatchSiteChange}
              />
              <Button onClick={handleBatchSelectAllHosts}>全选主机</Button>
              <Button onClick={handleBatchClearHosts}>清空主机</Button>
            </Space>
          </Form.Item>

          <Form.Item
            name="host_ids"
            label="选择主机"
            rules={[{ required: true, message: '请至少选择一个主机' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择主机"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={hostOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="metric_ids"
            label="选择监控指标"
            rules={[{ required: true, message: '请至少选择一个指标' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择监控指标"
              options={metrics.map((m) => ({
                label: m.name,
                value: m.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="interval"
            label="采集间隔（秒）"
            initialValue={300}
            rules={[{ required: true, message: '请输入采集间隔' }]}
          >
            <InputNumber min={10} max={86400} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enabled" label="启用监控" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
