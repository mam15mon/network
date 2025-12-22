import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
  Table,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TabsProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  snmpApi,
  type SNMPBuiltinMetric,
  type SNMPMetric,
  type SNMPMetricCreate,
  type SNMPTestRequest,
  type SNMPTestResponse,
  type SNMPTestValue,
} from '../../api/snmp';
import { getHosts, type Host } from '../../api/hosts';

const { Title, Text } = Typography;

interface SNMPConfigPageProps {
  canManageBuiltin?: boolean;
}

export default function SNMPConfigPage({ canManageBuiltin = false }: SNMPConfigPageProps) {
  const [activeTab, setActiveTab] = useState<string>('metrics');
  const [metrics, setMetrics] = useState<SNMPMetric[]>([]);
  const [builtinMetrics, setBuiltinMetrics] = useState<SNMPBuiltinMetric[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);

  const [metricModalVisible, setMetricModalVisible] = useState(false);
  const [editingMetric, setEditingMetric] = useState<SNMPMetric | null>(null);
  const [metricForm] = Form.useForm<SNMPMetricCreate>();

  const [testForm] = Form.useForm<SNMPTestRequest>();
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<SNMPTestValue[]>([]);
  const [testResponse, setTestResponse] = useState<SNMPTestResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, builtinData, hostsData] = await Promise.all([
        snmpApi.getMetrics(),
        snmpApi.getBuiltinMetrics(),
        getHosts(),
      ]);
      setMetrics(metricsData);
      setBuiltinMetrics(builtinData);
      setHosts(hostsData);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateMetric = () => {
    setEditingMetric(null);
    metricForm.resetFields();
    metricForm.setFieldsValue({ value_type: 'gauge' });
    setMetricModalVisible(true);
  };

  const handleEditMetric = (metric: SNMPMetric) => {
    setEditingMetric(metric);
    metricForm.setFieldsValue({
      name: metric.name,
      oid: metric.oid,
      value_type: metric.value_type,
      unit: metric.unit,
      value_parser: metric.value_parser,
      description: metric.description,
    });
    setMetricModalVisible(true);
  };

  const handleUseBuiltinMetric = (metric: SNMPBuiltinMetric) => {
    metricForm.setFieldsValue({
      name: metric.name,
      oid: metric.oid,
      description: metric.description,
      value_type: metric.value_type ?? 'gauge',
      unit: metric.unit,
      value_parser: metric.value_parser,
    });
    setEditingMetric(null);
    setMetricModalVisible(true);
  };

  const handleMetricSubmit = async () => {
    try {
      const values = await metricForm.validateFields();
      if (editingMetric) {
        await snmpApi.updateMetric(editingMetric.id, values);
        message.success('更新成功');
      } else {
        await snmpApi.createMetric(values);
        message.success('创建成功');
      }
      setMetricModalVisible(false);
      setEditingMetric(null);
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const handleDeleteMetric = (metricId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该监控指标吗？相关的监控任务也将受到影响。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await snmpApi.deleteMetric(metricId);
          message.success('删除成功');
          await loadData();
        } catch (error: any) {
          message.error(error.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleTestOID = async () => {
    try {
      const values = await testForm.validateFields();
      const host = hosts.find((h) => h.id === values.host_id);
      if (!host) {
        message.error('未找到主机信息');
        return;
      }

      setTestLoading(true);
      setTestResponse(null);
      setTestResults([]);

      const request: SNMPTestRequest = {
        host_id: values.host_id,
        oid: values.oid,
        snmp_version: host.snmp_version,
        snmp_community: host.snmp_community,
      };

      const response = await snmpApi.testOID(request);
      setTestResponse(response);

      if (response.success) {
        const parsedValues = response.parsed_values ?? [];
        setTestResults(parsedValues);
        if (parsedValues.length > 0) {
          message.success(`测试成功，返回 ${parsedValues.length} 条数据`);
        } else {
          message.warning('测试成功但没有返回数据');
        }
      } else {
        message.error(response.error || '测试失败');
      }
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.response?.data?.detail || '测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  const metricColumns: ColumnsType<SNMPMetric> = useMemo(
    () => [
      {
        title: '指标名称',
        dataIndex: 'name',
        key: 'name',
        width: 180,
      },
      {
        title: 'OID',
        dataIndex: 'oid',
        key: 'oid',
        width: 260,
        render: (value: string) => <Text code>{value}</Text>,
      },
      {
        title: '说明',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'value_type',
        key: 'value_type',
        width: 120,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: '单位',
        dataIndex: 'unit',
        key: 'unit',
        width: 100,
        render: (value?: string) => value ?? '-',
      },
      {
        title: '内置',
        dataIndex: 'is_builtin',
        key: 'is_builtin',
        width: 80,
        render: (value: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? '是' : '否'}</Tag>,
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
              icon={<EditOutlined />}
              onClick={() => handleEditMetric(record)}
              disabled={record.is_builtin && !canManageBuiltin}
            />
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteMetric(record.id)}
              disabled={record.is_builtin && !canManageBuiltin}
            />
          </Space>
        ),
      },
    ],
    [handleEditMetric, handleDeleteMetric, canManageBuiltin],
  );

  const testResultColumns: ColumnsType<SNMPTestValue> = useMemo(
    () => [
      {
        title: 'OID',
        dataIndex: 'oid',
        key: 'oid',
        width: 280,
        render: (value: string) => <Text code>{value}</Text>,
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 120,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      {
        title: '值',
        dataIndex: 'value',
        key: 'value',
      },
    ],
    [],
  );

  const tabItems: TabsProps['items'] = [
    {
      key: 'metrics',
      label: '监控指标配置',
      children: (
        <Card
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateMetric}
              >
                添加指标
              </Button>
            </Space>
          }
        >
          <Space wrap style={{ marginBottom: 16 }}>
            {builtinMetrics.map((metric) => (
              <Tag
                key={`${metric.name}-${metric.oid}`}
                color="blue"
                style={{ cursor: 'pointer' }}
                onClick={() => handleUseBuiltinMetric(metric)}
              >
                {metric.name}
              </Tag>
            ))}
          </Space>
          <Table<SNMPMetric>
            rowKey="id"
            columns={metricColumns}
            dataSource={metrics}
            loading={loading}
            scroll={{ x: 900 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      ),
    },
    {
      key: 'test',
      label: 'OID 测试',
      children: (
        <Card>
          <Form form={testForm} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="host_id"
                  label="选择主机"
                  rules={[{ required: true, message: '请选择主机' }]}
                >
                  <Select
                    placeholder="选择要测试的主机"
                    showSearch
                    optionFilterProp="label"
                    options={hosts.map((host) => ({
                      label: `${host.name} (${host.hostname})`,
                      value: host.id,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="oid"
                  label="OID"
                  rules={[{ required: true, message: '请输入 OID' }]}
                >
                  <Input placeholder="例如: 1.3.6.1.4.1.25506.2.6.1.1.1.1.6" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                onClick={handleTestOID}
                loading={testLoading}
              >
                执行测试
              </Button>
            </Form.Item>
          </Form>

          <Divider />

          {testLoading ? (
            <Spin />
          ) : testResponse ? (
            <>
              <Alert
                type={testResponse.success ? 'success' : 'error'}
                message={testResponse.success ? '测试成功' : '测试失败'}
                description={
                  testResponse.success
                    ? '以下为解析结果'
                    : testResponse.error || '请确认设备与 OID 配置'
                }
                showIcon
                style={{ marginBottom: 16 }}
              />
              {testResults.length > 0 ? (
                <Table<SNMPTestValue>
                  rowKey={(record, index) => `${record.oid}-${index}`}
                  columns={testResultColumns}
                  dataSource={testResults}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: false,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  scroll={{ y: 360 }}
                  size="small"
                />
              ) : (
                <Card>
                  <Text type="secondary">
                    测试成功但未返回数据，尝试调整 OID 或检查设备返回值。
                  </Text>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <Text type="secondary">
                执行测试后将显示 SNMP 查询结果，便于确认 OID 与返回值是否符合预期。
              </Text>
            </Card>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        SNMP 配置中心
      </Title>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />

      <Modal
        title={editingMetric ? '编辑监控指标' : '添加监控指标'}
        open={metricModalVisible}
        onCancel={() => {
          setMetricModalVisible(false);
          setEditingMetric(null);
        }}
        onOk={handleMetricSubmit}
        destroyOnClose
        width={720}
      >
        <Form form={metricForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="例如: CPU 使用率" />
          </Form.Item>
          <Form.Item
            name="oid"
            label="SNMP OID"
            rules={[{ required: true, message: '请输入 OID' }]}
            extra="例如: 1.3.6.1.4.1.25506.2.6.1.1.1.1.6"
          >
            <Input placeholder="输入完整的 OID" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="value_type"
                label="值类型"
                rules={[{ required: true, message: '请选择值类型' }]}
              >
                <Select
                  options={[
                    { label: 'Gauge (仪表)', value: 'gauge' },
                    { label: 'Counter (计数器)', value: 'counter' },
                    { label: 'String (字符串)', value: 'string' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="单位">
                <Input placeholder="例如: %, Mbps, °C" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="value_parser"
            label="值解析器（可选）"
            extra="留空表示使用原始值。支持: regex:正则表达式, last_integer, last_word"
          >
            <Input placeholder="例如: regex:(\d+)" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="简要说明该指标的用途和含义" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
