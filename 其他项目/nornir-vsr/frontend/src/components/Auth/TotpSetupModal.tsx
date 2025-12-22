import { useEffect } from "react";
import { Button, Form, Input, Modal, QRCode, Space, Typography, message } from "antd";
import useTotpSetup from "./useTotpSetup";

const { Text } = Typography;

interface TotpSetupModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: () => Promise<boolean>;
  forceComplete?: boolean;
}

const TotpSetupModal = ({ open, onClose, onCompleted, forceComplete = false }: TotpSetupModalProps) => {
  const [form] = Form.useForm<{ code: string }>();
  const { secret, uri, loading, verifying, verify, reload } = useTotpSetup({
    active: open,
    onLoadError: (detail) => {
      message.error(detail);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleVerify = async () => {
    try {
      const values = await form.validateFields();
      await verify(values.code);
      const completed = await onCompleted();
      if (!completed) {
        return;
      }
      message.success("二次认证已启用");
      onClose();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "验证失败";
      message.error(detail);
    }
  };

  const handleCancel = () => {
    if (!forceComplete) {
      onClose();
    }
  };

  const handleResetInput = () => {
    form.resetFields();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title="启用二次认证"
      okText="完成"
      onOk={handleVerify}
      confirmLoading={verifying}
      okButtonProps={{ disabled: loading }}
      cancelButtonProps={{
        disabled: verifying || forceComplete,
        style: forceComplete ? { display: "none" } : undefined,
      }}
      maskClosable={!forceComplete}
      closable={!forceComplete}
      keyboard={!forceComplete}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {forceComplete ? (
          <Text type="danger">
            管理员已要求启用二次认证，请完成绑定后才能继续使用系统。
          </Text>
        ) : null}
        <Text type="secondary">
          使用 Google Authenticator、Authy 或微软验证器扫描二维码，或手动输入密钥。
        </Text>
        {uri ? <QRCode value={uri} status={loading ? "loading" : "active"} /> : null}
        {secret ? (
          <Text code copyable>{secret}</Text>
        ) : null}
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="code"
            label="验证码"
            rules={[{ required: true, message: "请输入 6 位验证码" }, { len: 6, message: "验证码长度为 6 位" }]}
          >
            <Input placeholder="123456" maxLength={6} disabled={loading || verifying} />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          请妥善保存密钥，如丢失可联系超级管理员重置二次认证。
        </Text>
        <Space size="small">
          <Button type="link" onClick={handleResetInput} disabled={verifying}>
            重置输入
          </Button>
          <Button type="link" onClick={() => void reload()} disabled={loading || verifying}>
            重新获取二维码
          </Button>
        </Space>
      </Space>
    </Modal>
  );
};

export default TotpSetupModal;
