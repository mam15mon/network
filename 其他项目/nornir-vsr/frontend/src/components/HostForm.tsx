import { useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Spin,
  Row,
  Col,
  Space,
  Select
} from "antd";
import { Host, HostPayload } from "../api/hosts";

const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

interface HostFormProps {
  visible: boolean;
  loading: boolean;
  host?: Host;
  onSubmit: (payload: HostPayload) => Promise<void>;
  onCancel: () => void;
}

const HostForm = ({ visible, loading, host, onSubmit, onCancel }: HostFormProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (host) {
        form.setFieldsValue({
          name: host.name,
          hostname: host.hostname,
          platform: host.platform || "hp_comware",
          port: host.port || 22,
          username: host.username || "",
          password: host.password || "",
          site: host.site || "",
          device_type: host.device_type || "",
          device_model: host.device_model || "",
          address_pool: host.address_pool || "",
          ppp_auth_mode: host.ppp_auth_mode || "",
          snmp_version: host.snmp_version || "v2c",
          snmp_community: host.snmp_community || "public",
          snmp_port: host.snmp_port || 161,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          platform: "hp_comware",
          port: 22,
          snmp_version: "v2c",
          snmp_community: "public",
          snmp_port: 161
        });
      }
    }
  }, [visible, host, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
      form.resetFields();
    } catch (err) {
      // 错误已在调用方处理
    }
  };

  return (
    <Modal
      title={host ? `编辑 ${host.name}` : "新增设备"}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="设备名称"
              rules={[{ required: true, message: "请输入设备名称" }]}
            >
              <Input
                id="host-name"
                name="name"
                placeholder="请输入设备名称"
                disabled={Boolean(host)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="hostname"
              label="地址"
              rules={[
                { required: true, message: "请输入 IP 地址" },
                { pattern: IPV4_PATTERN, message: "请输入有效的 IPv4 地址 (例如 192.168.1.1)" },
              ]}
            >
              <Input id="host-hostname" name="hostname" placeholder="请输入 IPv4 地址" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="platform"
              label="平台"
            >
              <Input id="host-platform" name="platform" placeholder="hp_comware" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="username"
              label="用户名"
            >
              <Input id="host-username" name="username" placeholder="请输入用户名" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="password"
              label="密码"
            >
              <Input.Password id="host-password" name="password" placeholder="请输入密码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="port"
              label="端口"
              rules={[
                { required: true, message: "请输入端口" },
                { type: "number", min: 1, max: 65535, message: "端口必须在 1-65535 之间" }
              ]}
            >
              <InputNumber
                id="host-port"
                name="port"
                placeholder="请输入端口"
                style={{ width: "100%" }}
                min={1}
                max={65535}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="snmp_version"
              label="SNMP 版本"
              rules={[{ required: true, message: "请选择 SNMP 版本" }]}
            >
              <Select
                placeholder="选择 SNMP 版本"
                options={[
                  { label: "v1", value: "v1" },
                  { label: "v2c", value: "v2c" },
                  { label: "v3", value: "v3" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="snmp_port"
              label="SNMP 端口"
              rules={[
                { required: true, message: "请输入 SNMP 端口" },
                { type: "number", min: 1, max: 65535, message: "端口必须在 1-65535 之间" },
              ]}
            >
              <InputNumber
                id="host-snmp-port"
                name="snmp_port"
                placeholder="161"
                style={{ width: "100%" }}
                min={1}
                max={65535}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="snmp_community"
              label="SNMP 团体字"
            >
              <Input
                id="host-snmp-community"
                name="snmp_community"
                placeholder="例如: public"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="site"
              label="站点"
            >
              <Input id="host-site" name="site" placeholder="请输入站点" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="device_type"
              label="设备类型"
            >
              <Input id="host-device-type" name="device_type" placeholder="请输入设备类型" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="device_model"
              label="设备型号"
            >
              <Input id="host-device-model" name="device_model" placeholder="请输入设备型号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="address_pool"
              label="地址池"
            >
              <Input id="host-address-pool" name="address_pool" placeholder="请输入地址池" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="ppp_auth_mode"
          label="PPP认证模式"
        >
          <Input id="host-ppp-auth-mode" name="ppp_auth_mode" placeholder="请输入PPP认证模式" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Space>
            <Button onClick={onCancel}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
            >
              {loading ? "保存中..." : "保存"}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default HostForm;
