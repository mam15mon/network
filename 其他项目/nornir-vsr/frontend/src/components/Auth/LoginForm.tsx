import { useCallback, useState } from "react";
import { Button, Card, Form, Input, Typography, Alert } from "antd";
import type { LoginPayload } from "../../api/auth";

const { Title, Text } = Typography;

interface LoginFormProps {
  loading: boolean;
  onSubmit: (payload: LoginPayload) => Promise<void> | void;
}

const LoginForm = ({ loading, onSubmit }: LoginFormProps) => {
  const [form] = Form.useForm<LoginPayload>();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);

  const handleFinish = async (values: LoginPayload) => {
    try {
      setError(null);
      setInfo(null);
      await onSubmit(values);
      setOtpRequired(false);
      form.resetFields();
    } catch (err: any) {
      if (err?.code === "TOTP_REQUIRED") {
        setOtpRequired(true);
        setInfo(err?.message ?? "账户已启用二次认证，请输入验证码完成登录。");
        form.setFieldsValue({ otp: undefined });
        return;
      }
      const message = err?.response?.data?.detail ?? err?.message ?? "登录失败";
      setError(message);
    }
  };

  const handleValuesChange = useCallback(
    (changedValues: Partial<LoginPayload>) => {
      if (otpRequired && (Object.prototype.hasOwnProperty.call(changedValues, "username") || Object.prototype.hasOwnProperty.call(changedValues, "password"))) {
        setOtpRequired(false);
        setInfo(null);
        form.setFieldsValue({ otp: undefined });
      }
    },
    [form, otpRequired],
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 360 }} bordered={false}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <Title level={4} style={{ marginBottom: 8 }}>Nornir VSR</Title>
          <Text type="secondary">请登录后继续</Text>
        </div>
        {info ? (
          <Alert type="info" message={info} showIcon closable style={{ marginBottom: 16 }} onClose={() => setInfo(null)} />
        ) : null}
        {error ? (
          <Alert type="error" message={error} showIcon closable style={{ marginBottom: 16 }} onClose={() => setError(null)} />
        ) : null}
        <Form<LoginPayload> form={form} layout="vertical" onFinish={handleFinish} autoComplete="off" onValuesChange={handleValuesChange}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}> 
            <Input placeholder="admin" disabled={loading} />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}> 
            <Input.Password placeholder="••••••" disabled={loading} />
          </Form.Item>
          {otpRequired ? (
            <Form.Item
              name="otp"
              label="二次验证码"
              rules={[{ required: true, message: "请输入二次验证码" }]}
            >
              <Input placeholder="请输入六位验证码" disabled={loading} autoFocus inputMode="numeric" />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" block htmlType="submit" loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          首次使用请使用默认账户 admin / network123 登录，并及时修改密码。
        </Text>
      </Card>
    </div>
  );
};

export default LoginForm;
