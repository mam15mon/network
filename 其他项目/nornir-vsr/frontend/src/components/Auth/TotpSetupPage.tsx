import { useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, QRCode, Space, Typography, message } from "antd";
import type { AuthUser } from "../../api/auth";
import useTotpSetup from "./useTotpSetup";

const { Title, Text } = Typography;

interface TotpSetupPageProps {
  user: AuthUser;
  onCompleted: () => Promise<boolean>;
  onLogout: () => void;
}

const TotpSetupPage = ({ user, onCompleted, onLogout }: TotpSetupPageProps) => {
  const [form] = Form.useForm<{ code: string }>();
  const [loadError, setLoadError] = useState<string | null>(null);

  const { secret, uri, loading, verifying, reload, verify } = useTotpSetup({
    active: true,
    onLoadError: (detail) => {
      setLoadError(detail);
      message.error(detail);
    },
  });

  const instructions = useMemo(
    () => [
      "管理员已要求启用二次认证。",
      "请使用手机认证器扫描二维码或输入密钥完成绑定。",
      "绑定完成前无法访问系统其他功能。",
    ],
    [],
  );

  const handleVerify = async () => {
    try {
      const values = await form.validateFields();
      await verify(values.code);
      const completed = await onCompleted();
      if (!completed) {
        return;
      }
      message.success("二次认证已启用");
      form.resetFields();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "验证失败";
      message.error(detail);
    }
  };

  const handleResetInput = () => {
    form.resetFields();
  };

  const handleReload = async () => {
    setLoadError(null);
    await reload();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Card style={{ width: 420, maxWidth: "100%" }} bordered={false}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>启用二次认证</Title>
            <Text type="secondary">当前账户：{user.username}</Text>
          </div>
          <Alert type="warning" message={instructions.join(" ")} showIcon />
          {loadError ? (
            <Alert
              type="error"
              message={loadError}
              showIcon
              closable
              onClose={() => setLoadError(null)}
            />
          ) : null}
          <Text type="secondary">
            使用 Google Authenticator、Authy 或微软验证器扫描下方二维码，或手动输入密钥。
          </Text>
          <div style={{ display: "flex", justifyContent: "center" }}>
            {uri ? <QRCode value={uri} status={loading ? "loading" : "active"} /> : null}
          </div>
          {secret ? (
            <Text code copyable style={{ display: "block" }}>
              {secret}
            </Text>
          ) : null}
          <Form<{ code: string }> form={form} layout="vertical">
            <Form.Item
              name="code"
              label="验证码"
              rules={[{ required: true, message: "请输入 6 位验证码" }, { len: 6, message: "验证码长度为 6 位" }]}
            >
              <Input placeholder="123456" maxLength={6} disabled={loading || verifying} />
            </Form.Item>
          </Form>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space>
              <Button type="primary" loading={verifying} onClick={handleVerify} disabled={loading}>
                完成绑定
              </Button>
              <Button onClick={handleResetInput} disabled={verifying}>
                重置输入
              </Button>
              <Button onClick={handleReload} loading={loading} disabled={verifying}>
                重新获取二维码
              </Button>
            </Space>
            <Button danger type="link" onClick={() => onLogout()}>
              退出登录
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            如遇问题请联系超级管理员重置二次认证。
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default TotpSetupPage;
