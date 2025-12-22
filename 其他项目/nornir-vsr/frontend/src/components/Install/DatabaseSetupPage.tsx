import { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";

import {
  type DatabaseConfigPayload,
  applyDatabaseConfiguration,
  testDatabaseConnection,
} from "../../api/install";

const { Title, Paragraph, Text } = Typography;

interface DatabaseSetupPageProps {
  onConfigured: () => Promise<void> | void;
}

const sslModeOptions = [
  { label: "prefer (默认)", value: "prefer" },
  { label: "disable", value: "disable" },
  { label: "allow", value: "allow" },
  { label: "require", value: "require" },
  { label: "verify-ca", value: "verify-ca" },
  { label: "verify-full", value: "verify-full" },
];

const DatabaseSetupPage = ({ onConfigured }: DatabaseSetupPageProps) => {
  const [form] = Form.useForm<DatabaseConfigPayload>();
  const [testing, setTesting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);
  const [testResultType, setTestResultType] = useState<"success" | "error">("success");

  const handleTestConnection = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const response = await testDatabaseConnection(values);
      setLastTestResult(response.message);
      setTestResultType("success");
      message.success(response.message);
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "连接失败";
      setLastTestResult(detail);
      setTestResultType("error");
      message.error(detail);
    } finally {
      setTesting(false);
    }
  }, [form]);

  const handleApply = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setApplying(true);
      const response = await applyDatabaseConfiguration(values);
      setLastTestResult(response.message);
      setTestResultType("success");
      message.success(`${response.message}，即将进入登录界面`);
      await onConfigured();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "保存失败";
      setLastTestResult(detail);
      setTestResultType("error");
      message.error(detail);
    } finally {
      setApplying(false);
    }
  }, [form, onConfigured]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(17, 128, 255, 0.05) 0%, rgba(0, 0, 0, 0.05) 100%)",
        padding: 32,
      }}
    >
      <Card style={{ width: 560, maxWidth: "100%", boxShadow: "0 24px 64px -36px rgba(15, 64, 128, 0.35)" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>欢迎使用 Nornir VSR</Title>
            <Text type="secondary">首次启动检测到尚未配置数据库，请按步骤完成初始化。</Text>
          </div>

          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            提示：
            <br />1. 仅支持 PostgreSQL。
            <br />2. 需要具备对目标数据库的建库和建表权限。
            <br />3. 保存成功后系统会自动创建默认管理员账号（admin / network123）。
          </Paragraph>

          {lastTestResult ? (
            <Alert
              type={testResultType}
              message={lastTestResult}
              showIcon
              closable
              onClose={() => setLastTestResult(null)}
            />
          ) : null}

          <Form<DatabaseConfigPayload>
            form={form}
            layout="vertical"
            initialValues={{ port: 5432, ssl_mode: "prefer" }}
          >
            <Form.Item
              name="connection_url"
              label="自定义连接串（可选）"
              tooltip="填写后将忽略下方详细字段，格式示例：postgresql+psycopg://user:pass@host:5432/dbname"
            >
              <Input placeholder="postgresql+psycopg://user:pass@host:5432/dbname" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.connection_url !== curr.connection_url}>
              {({ getFieldValue }) => {
                const useUrl = Boolean(getFieldValue("connection_url"));
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="host"
                        label="数据库地址"
                        rules={useUrl ? [] : [{ required: true, message: "请输入数据库地址" }]}
                      >
                        <Input placeholder="127.0.0.1" disabled={useUrl} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="port"
                        label="端口"
                        rules={useUrl ? [] : [{ required: true, message: "请输入端口号" }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={1} max={65535} disabled={useUrl} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="username"
                        label="用户名"
                        rules={useUrl ? [] : [{ required: true, message: "请输入用户名" }]}
                      >
                        <Input placeholder="postgres" disabled={useUrl} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="password"
                        label="密码"
                        rules={useUrl ? [] : [{ required: true, message: "请输入密码" }]}
                      >
                        <Input.Password placeholder="••••••" disabled={useUrl} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="database"
                        label="数据库名称"
                        rules={useUrl ? [] : [{ required: true, message: "请输入数据库名称" }]}
                      >
                        <Input placeholder="nornir_vsr" disabled={useUrl} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="ssl_mode"
                        label="sslmode"
                        rules={useUrl ? [] : [{ required: true, message: "请选择 sslmode" }]}
                      >
                        <Select options={sslModeOptions} disabled={useUrl} />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }}
            </Form.Item>
          </Form>

          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={handleTestConnection} loading={testing}>
              测试连接
            </Button>
            <Button type="primary" onClick={handleApply} loading={applying}>
              保存并继续
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default DatabaseSetupPage;
