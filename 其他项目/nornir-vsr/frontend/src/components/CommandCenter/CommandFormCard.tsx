import { memo, useCallback, useMemo } from "react";
import { Alert, Button, Checkbox, Form, Input, Segmented, Typography, theme } from "antd";
import type { FormInstance } from "antd";
import { SendOutlined } from "@ant-design/icons";

import type { CommandType } from "../../api/nornir";
import { DEFAULT_COMMANDS } from "./constants";
import {
  createAccentCardStyle,
  createCardAccentBar,
  createCardHoverHandlers,
  createInputStyle,
  createPrimaryButtonStyle,
  mergeStyles,
} from "../../styles/commonStyles";

const { TextArea } = Input;
const { Text } = Typography;

interface CommandFormCardProps {
  form: FormInstance;
  executing: boolean;
  onExecute: () => void;
  variant?: 'accent' | 'plain';
}

const CommandFormCard = ({ form, executing, onExecute, variant = 'accent' }: CommandFormCardProps) => {
  const { token } = theme.useToken();
  const hoverHandlers = useMemo(() => createCardHoverHandlers(token), [token]);

  const commandType = Form.useWatch<CommandType>("commandType", form) || "display";

  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      if (changedValues.commandType) {
        const nextType = changedValues.commandType as CommandType;
        form.setFieldsValue({
          command: DEFAULT_COMMANDS[nextType] ?? "",
          commands: DEFAULT_COMMANDS.config,
          useTiming: false,
        });
      }
    },
    [form],
  );

  return (
    <div
      style={mergeStyles(
        variant === 'accent' ? createAccentCardStyle(token) : {},
        {
          padding: 20,
        },
      )}
      {...(variant === 'accent' ? hoverHandlers : {})}
    >
      {variant === 'accent' ? <div style={createCardAccentBar(token)} /> : null}
    <Form
      layout="vertical"
      form={form}
      initialValues={{
        commandType: "display" as CommandType,
        command: DEFAULT_COMMANDS.display,
        commands: DEFAULT_COMMANDS.config,
        useTiming: false,
      }}
      onValuesChange={handleValuesChange}
    >
      <Form.Item
        label="命令类型"
        name="commandType"
        rules={[{ required: true, message: "请选择命令类型" }]}
      >
        <Segmented
          id="commandType"
          name="commandType"
          block
          options={[
            { label: "显示命令", value: "display" },
            { label: "配置命令", value: "config" },
            { label: "多行命令", value: "multiline" },
            { label: "连通性测试", value: "connectivity" },
            { label: "配置备份", value: "config_download" },
          ]}
        />
      </Form.Item>

      {commandType === "display" && (
        <Form.Item
          label="命令"
          name="command"
          rules={[{ required: true, message: "请输入命令" }]}
        >
          <TextArea
            id="commandField"
            name="command"
            rows={4}
            placeholder="例如: display version"
            style={createInputStyle(token)}
          />
        </Form.Item>
      )}

      {(["config", "multiline"] as CommandType[]).includes(commandType) && (
        <Form.Item
          label="命令列表"
          name="commands"
          rules={[{ required: true, message: "请输入命令，每行一条" }]}
        >
          <TextArea
            id="commandsField"
            name="commands"
            rows={6}
            placeholder="每行一条命令"
            style={createInputStyle(token)}
          />
        </Form.Item>
      )}

      {commandType === "multiline" && (
        <>
          <Form.Item name="useTiming" valuePropName="checked">
            <Checkbox name="useTiming">使用 timing 模式</Checkbox>
          </Form.Item>
          <Text type="secondary">提示: 非 timing 模式可使用 `命令 | 期望匹配` 格式。</Text>
        </>
      )}

      {commandType === "connectivity" && (
        <Alert type="info" showIcon message="连通性测试固定检测 SSH 端口 22" />
      )}

      {commandType === "config_download" && (
        <Alert type="info" showIcon message="固定执行 display current-configuration 并保存备份" />
      )}

      <Form.Item style={{ marginTop: 16 }}>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={executing}
          onClick={onExecute}
          block
          style={createPrimaryButtonStyle(token)}
        >
          执行命令
        </Button>
      </Form.Item>
    </Form>
    </div>
  );
};

export default memo(CommandFormCard);
