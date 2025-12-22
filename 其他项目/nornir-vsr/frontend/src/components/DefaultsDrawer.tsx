import { useEffect } from "react";
import { Drawer, Form, InputNumber, Switch, Button, Typography, Divider } from "antd";
import { DefaultsConfig } from "../api/defaults";

interface DefaultsDrawerProps {
  visible: boolean;
  loading: boolean;
  defaults: DefaultsConfig | null;
  onSubmit: (payload: DefaultsConfig) => Promise<void>;
  onClose: () => void;
}

const DefaultsDrawer = ({ visible, loading, defaults, onSubmit, onClose }: DefaultsDrawerProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && defaults) {
      form.setFieldsValue(defaults);
    } else if (visible) {
      form.setFieldsValue({
        timeout: 60,
        global_delay_factor: 2,
        fast_cli: false,
        read_timeout: 30,
        num_workers: 30,
        license_module_enabled: true,
      });
    }
  }, [visible, defaults, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
      onClose();
    } catch (err) {
      // 错误已在外部处理
    }
  };

  return (
    <Drawer
      title="默认连接设置"
      placement="right"
      onClose={onClose}
      open={visible}
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Form.Item
          name="timeout"
          label="命令超时时间 (秒)"
          rules={[
            { required: true, message: "请输入命令超时时间" },
            { type: "number", min: 1, max: 600, message: "命令超时时间必须在 1-600 秒之间" }
          ]}
        >
          <InputNumber
            id="defaults-timeout"
            name="timeout"
            placeholder="请输入命令超时时间"
            style={{ width: "100%" }}
            min={1}
            max={600}
          />
        </Form.Item>

        <Form.Item
          name="global_delay_factor"
          label="全局延迟因子"
          rules={[
            { required: true, message: "请输入全局延迟因子" },
            { type: "number", min: 0, message: "全局延迟因子必须大于等于 0" }
          ]}
        >
          <InputNumber
            id="defaults-global-delay-factor"
            name="global_delay_factor"
            placeholder="请输入全局延迟因子"
            style={{ width: "100%" }}
            min={0}
            step={0.1}
          />
        </Form.Item>

        <Form.Item
          name="fast_cli"
          label="开启 Fast CLI"
          valuePropName="checked"
        >
          <Switch id="defaults-fast-cli" />
        </Form.Item>

        <Form.Item
          name="read_timeout"
          label="读取超时时间 (秒)"
          rules={[
            { required: true, message: "请输入读取超时时间" },
            { type: "number", min: 1, max: 600, message: "读取超时时间必须在 1-600 秒之间" }
          ]}
        >
          <InputNumber
            id="defaults-read-timeout"
            name="read_timeout"
            placeholder="请输入读取超时时间"
            style={{ width: "100%" }}
            min={1}
            max={600}
          />
        </Form.Item>

        <Form.Item
          name="num_workers"
          label="并发线程数"
          rules={[
            { required: true, message: "请输入并发线程数" },
            { type: "number", min: 1, max: 200, message: "并发线程数必须在 1-200 之间" }
          ]}
        >
          <InputNumber
            id="defaults-num-workers"
            name="num_workers"
            placeholder="请输入并发线程数"
            style={{ width: "100%" }}
            min={1}
            max={200}
          />
        </Form.Item>

        <Divider />

        <Form.Item
          name="license_module_enabled"
          label="启用许可证管理模块"
          valuePropName="checked"
        >
          <Switch id="defaults-license-module-enabled" />
        </Form.Item>
        <Typography.Text type="secondary">
          关闭后将从主界面隐藏许可证管理菜单，适用于未启用许可证业务的部署。
        </Typography.Text>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            {loading ? "保存中..." : "保存"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default DefaultsDrawer;
