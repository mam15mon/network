import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { snmpApi, type SNMPMetric, type SNMPTestRequest, type SNMPTestValue } from '../../api/snmp';
import { getHosts, type Host } from '../../api/hosts';

const { TextArea } = Input;
const { Text } = Typography;
const DEFAULT_COLLECTOR = 'snmp';

interface SNMPMetricConfigProps {
  canManageBuiltin?: boolean;
}

export default function SNMPMetricConfig({ canManageBuiltin = false }: SNMPMetricConfigProps) {
  const [metrics, setMetrics] = useState<SNMPMetric[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [editingMetric, setEditingMetric] = useState<SNMPMetric | null>(null);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<SNMPTestValue[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, hostsData] = await Promise.all([
        snmpApi.getMetrics(),
        getHosts(),
      ]);
      setMetrics(metricsData);
      setHosts(hostsData);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = () => {
    setEditingMetric(null);
    form.resetFields();
    form.setFieldsValue({ value_type: 'gauge', collector: DEFAULT_COLLECTOR });
    setModalVisible(true);
  };

  const handleEdit = (metric: SNMPMetric) => {
    setEditingMetric(metric);
    form.setFieldsValue({
      name: metric.name,
      oid: metric.oid,
      value_type: metric.value_type,
      unit: metric.unit,
      value_parser: metric.value_parser,
      collector: DEFAULT_COLLECTOR,
      collector_config: metric.collector === DEFAULT_COLLECTOR ? metric.collector_config : undefined,
      description: metric.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (metricId: number) => {
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
          loadData();
        } catch (error: any) {
          message.error(error.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingMetric) {
        await snmpApi.updateMetric(editingMetric.id, values);
        message.success('更新成功');
      } else {
        await snmpApi.createMetric(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const handleTestOID = async () => {
    try {
      const values = await testForm.validateFields();
      setTestLoading(true);

      const host = hosts.find((h) => h.id === values.host_id);
      if (!host) {
        message.error('未找到主机信息');
        return;
      }

      const testRequest: SNMPTestRequest = {
        host_id: values.host_id,
        oid: values.oid,
        snmp_version: host.snmp_version || '2c',
        snmp_community: host.snmp_community || 'public',
      };

      const response = await snmpApi.testOID(testRequest);

      if (response.success) {
        const parsedValues = response.parsed_values ?? [];
        setTestResults(parsedValues);
        if (parsedValues.length > 0) {
          message.success(`成功获取 ${parsedValues.length} 条数据`);
        } else {
          message.warning('查询成功但未返回数据');
        }
      } else {
        message.error(response.error || '查询失败');
        setTestResults([]);
      }
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.detail || '测试失败');
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  };

  const handleShowTestModal = () => {
    testForm.resetFields();
    setTestResults([]);
    setTestModalVisible(true);
  };

  const columns: ColumnsType<SNMPMetric> = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'OID',
      dataIndex: 'oid',
      key: 'oid',
      width: 250,
      render: (val: string) => <Text code>{val}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'value_type',
      key: 'value_type',
      width: 100,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: '值解析器',
      dataIndex: 'value_parser',
      key: 'value_parser',
      width: 150,
      render: (val: string) => (val ? <Text code>{val}</Text> : '-'),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'is_builtin',
      key: 'is_builtin',
      width: 100,
      render: (isBuiltin: boolean) => (
        <Tag color={isBuiltin ? 'blue' : 'default'}>
          {isBuiltin ? '内置' : '自定义'}
        </Tag>
      ),
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
            disabled={record.is_builtin && !canManageBuiltin}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            disabled={record.is_builtin && !canManageBuiltin}
          />
        </Space>
      ),
    },
  ];

  const testResultColumns: ColumnsType<SNMPTestValue> = [
    {
      title: 'OID',
      dataIndex: 'oid',
      key: 'oid',
      width: 300,
      render: (val: string) => <Text code style={{ fontSize: 12 }}>{val}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (val: string) => <Text strong>{val}</Text>,
    },
  ];

  return (
    <div>
      <Card
        extra={
          <Space>
            <Button
              icon={<ExperimentOutlined />}
              onClick={handleShowTestModal}
            >
              测试 OID
            </Button>
            <Button
              type="primary"
              onClick={handleCreate}
              icon={<PlusOutlined />}
            >
              添加指标
            </Button>
            <Button
              onClick={loadData}
              icon={<ReloadOutlined />}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={metrics}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 指标表单 */}
      <Modal
        title={editingMetric ? '编辑指标' : '添加指标'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="collector" initialValue={DEFAULT_COLLECTOR} hidden>
            <Input type="hidden" />
          </Form.Item>

          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="例如: CPU使用率" />
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
            extra="留空表示使用原始值。支持格式: regex:正则表达式, last_integer, last_word"
          >
            <Input placeholder="例如: regex:(\d+)" />
          </Form.Item>

          <Form.Item
            name="collector_config"
            label="采集配置 (JSON，可选)"
            extra="可覆盖默认 OID、解析器、SNMP 版本/团体字以及超时时间。也可以通过 domain_base_oid 自动根据主机的 PPP 认证模式生成域 OID。"
          >
            <TextArea
              rows={4}
              placeholder='例如 {"domain_base_oid":"1.3.6.1.4.1.25506.2.46.2.4.1.9","value_parser":"regex:Gauge32:\\s*(\\d+)","domain_fallback":"imc"} 或 {"oid":"1.3.6.1.4.1.25506.2.6.1.1.1.1.6"}'
            />
          </Form.Item>

          <Form.Item name="description" label="说明">
            <TextArea
              rows={3}
              placeholder="简要说明该指标的用途和含义"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* OID 测试模态框 */}
      <Modal
        title="测试 SNMP OID"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setTestModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Form form={testForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="host_id"
                label="选择主机"
                rules={[{ required: true, message: '请选择主机' }]}
              >
                <Select
                  placeholder="选择要测试的主机"
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
            </Col>
            <Col span={12}>
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
              block
            >
              执行测试
            </Button>
          </Form.Item>
        </Form>

        <Divider>测试结果</Divider>

        {testResults.length > 0 ? (
          <>
            <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
              共返回 {testResults.length} 条数据，您可以根据需要选择性使用：
            </Text>
            <Table
              columns={testResultColumns}
              dataSource={testResults}
              rowKey={(record, index) => `${record.oid}-${index}`}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ y: 300 }}
            />
          </>
        ) : (
          <Card>
            <Text type="secondary">
              点击"执行测试"按钮后，这里将显示 SNMP 查询结果。
              您可以查看返回的所有 OID 和对应的值，避免"垃圾数据"。
            </Text>
          </Card>
        )}
      </Modal>
    </div>
  );
}
