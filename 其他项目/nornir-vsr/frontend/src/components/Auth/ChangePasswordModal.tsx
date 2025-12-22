import { useCallback, useState } from "react";
import { Modal, Form, Input, Typography, message, Alert } from "antd";
import { changePassword } from "../../api/auth";

const { Paragraph, Text } = Typography;

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface ChangePasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const ChangePasswordModal = ({ open, onClose }: ChangePasswordModalProps) => {
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    form.resetFields();
    setError(null);
    onClose();
  }, [form, onClose]);

  const handleSubmit = useCallback(
    async (values: ChangePasswordFormValues) => {
      try {
        setSubmitting(true);
        setError(null);
        await changePassword({
          current_password: values.current_password,
          new_password: values.new_password,
        });
        message.success("密码修改成功，请妥善保管");
        resetAndClose();
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? err?.message ?? "修改密码失败";
        setError(detail);
      } finally {
        setSubmitting(false);
      }
    },
    [resetAndClose],
  );

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={resetAndClose}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      centered
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        建议定期更新密码，并确保与其他平台不同。
      </Paragraph>
      {error ? (
        <Alert
          type="error"
          message="修改失败"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError(null)}
        />
      ) : null}
      <Form<ChangePasswordFormValues>
        form={form}
        layout="vertical"
        autoComplete="off"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="current_password"
          label="当前密码"
          rules={[{ required: true, message: "请输入当前密码" }]}
        >
          <Input.Password autoComplete="current-password" disabled={submitting} />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: "请输入新密码" },
            { min: 8, message: "至少 8 位字符" },
          ]}
        >
          <Input.Password autoComplete="new-password" disabled={submitting} />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="确认新密码"
          dependencies={["new_password"]}
          rules={[
            { required: true, message: "请再次输入新密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" disabled={submitting} />
        </Form.Item>
        <Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            修改密码后需使用新密码重新登录系统。
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
