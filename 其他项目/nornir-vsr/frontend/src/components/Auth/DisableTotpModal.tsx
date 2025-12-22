import { useCallback, useState } from "react";
import { Alert, Form, Input, Modal, Typography, message } from "antd";
import { disableTotp } from "../../api/auth";

const { Paragraph, Text } = Typography;

interface DisableTotpModalProps {
  open: boolean;
  onClose: () => void;
  onDisabled: () => void;
}

const DisableTotpModal = ({ open, onClose, onDisabled }: DisableTotpModalProps) => {
  const [form] = Form.useForm<{ password: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    form.resetFields();
    setError(null);
    onClose();
  }, [form, onClose]);

  const handleSubmit = useCallback(
    async (values: { password: string }) => {
      try {
        setSubmitting(true);
        setError(null);
        await disableTotp({ password: values.password });
        message.success("二次认证已关闭，可随时重新启用");
        form.resetFields();
        onDisabled();
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? err?.message ?? "关闭失败";
        setError(detail);
      } finally {
        setSubmitting(false);
      }
    },
    [form, onDisabled],
  );

  return (
    <Modal
      title="关闭二次认证"
      open={open}
      onCancel={resetAndClose}
      onOk={() => form.submit()}
      okText="确认关闭"
      okButtonProps={{ danger: true }}
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      centered
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        关闭二次认证后，将只需密码即可登录。建议确保您的账户密码强度充足。
      </Paragraph>
      {error ? (
        <Alert
          type="error"
          message="操作失败"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError(null)}
        />
      ) : null}
      <Form<{ password: string }>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="password"
          label="登录密码"
          rules={[{ required: true, message: "请输入登录密码以确认关闭二次认证" }]}
        >
          <Input.Password autoComplete="current-password" disabled={submitting} />
        </Form.Item>
        <Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            如果遗忘密码或二次认证设备，可联系超级管理员重置。
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DisableTotpModal;
