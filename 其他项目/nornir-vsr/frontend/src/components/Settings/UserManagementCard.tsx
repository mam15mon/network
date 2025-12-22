import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { AuthUser } from "../../api/auth";
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  resetUserTotp,
  updateUser,
  type UserCreatePayload,
} from "../../api/users";

const { Title, Text } = Typography;

interface UserManagementCardProps {
  currentUser: AuthUser;
}

const UserManagementCard = ({ currentUser }: UserManagementCardProps) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<AuthUser | null>(null);
  const [createForm] = Form.useForm<UserCreatePayload & { confirm_password: string }>();
  const [passwordForm] = Form.useForm<{ new_password: string }>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "加载用户失败";
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    async (
      user: AuthUser,
      key: "is_active" | "is_superuser" | "totp_required",
      value: boolean,
    ) => {
      try {
        await updateUser(user.id, { [key]: value });
        if (user.id === currentUser.id && key === "is_active" && !value) {
          message.warning("已禁用当前账户，请重新登录");
        }
        if (key === "totp_required") {
          message.success(value ? "已要求启用二次认证" : "已取消强制二次认证");
          if (user.id === currentUser.id && value) {
            message.warning("当前账户已被强制启用二次认证，请尽快完成绑定。");
          }
        }
        await refresh();
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? error?.message ?? "更新失败";
        message.error(detail);
      }
    },
    [currentUser.id, refresh],
  );

  const handleDelete = useCallback(
    async (user: AuthUser) => {
      try {
        await deleteUser(user.id);
        message.success("已删除用户");
        await refresh();
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? error?.message ?? "删除失败";
        message.error(detail);
      }
    },
    [refresh],
  );

  const handleResetTotp = useCallback(
    async (user: AuthUser) => {
      try {
        await resetUserTotp(user.id);
        message.success("已重置二次认证");
        await refresh();
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? error?.message ?? "重置失败";
        message.error(detail);
      }
    },
    [refresh],
  );

  const columns: ColumnsType<AuthUser> = useMemo(
    () => [
      {
        title: "用户名",
        dataIndex: "username",
        key: "username",
      },
      {
        title: "角色",
        dataIndex: "is_superuser",
        key: "role",
        render: (value: boolean) => (value ? <Tag color="purple">超级管理员</Tag> : <Tag>普通用户</Tag>),
      },
      {
        title: "状态",
        dataIndex: "is_active",
        key: "active",
        render: (value: boolean) => (value ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>),
      },
      {
        title: "二次认证",
        key: "totp",
        render: (_, record) => (
          <Space size="small">
            <Tag color={record.totp_required ? "red" : undefined}>
              {record.totp_required ? "已强制" : "可选"}
            </Tag>
            <Tag color={record.totp_enabled ? "blue" : undefined}>
              {record.totp_enabled ? "已绑定" : "未绑定"}
            </Tag>
          </Space>
        ),
      },
      {
        title: "操作",
        key: "actions",
        render: (_, record) => (
          <Space size="small">
            <Switch
              size="small"
              checkedChildren="超管"
              unCheckedChildren="普通"
              checked={record.is_superuser}
              disabled={record.id === currentUser.id}
              onChange={(checked) => handleToggle(record, "is_superuser", checked)}
            />
            <Switch
              size="small"
              checkedChildren="启用"
              unCheckedChildren="禁用"
              checked={record.is_active}
              disabled={record.id === currentUser.id}
              onChange={(checked) => handleToggle(record, "is_active", checked)}
            />
            <Switch
              size="small"
              checkedChildren="强制"
              unCheckedChildren="可选"
              checked={record.totp_required}
              onChange={(checked) => handleToggle(record, "totp_required", checked)}
            />
            <Button size="small" onClick={() => {
              setTargetUser(record);
              setPasswordModalOpen(true);
              passwordForm.resetFields();
            }}>
              重置密码
            </Button>
            <Button size="small" onClick={() => handleResetTotp(record)}>
              重置二次认证
            </Button>
            <Popconfirm
              title="确定删除该用户？"
              disabled={record.id === currentUser.id}
              onConfirm={() => handleDelete(record)}
            >
              <Button size="small" danger disabled={record.id === currentUser.id}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [currentUser.id, handleDelete, handleResetTotp, handleToggle],
  );

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      if (values.password !== values.confirm_password) {
        message.error("两次输入的密码不一致");
        return;
      }
      await createUser({
        username: values.username,
        password: values.password,
        is_superuser: values.is_superuser,
        is_active: values.is_active,
        totp_required: values.totp_required,
      });
      message.success("已创建用户");
      setCreateModalOpen(false);
      createForm.resetFields();
      await refresh();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "创建失败";
      message.error(detail);
    }
  };

  const handleResetPassword = async () => {
    if (!targetUser) {
      return;
    }
    try {
      const values = await passwordForm.validateFields();
      await resetUserPassword(targetUser.id, values.new_password);
      message.success("密码已重置");
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      const detail = error?.response?.data?.detail ?? error?.message ?? "重置失败";
      message.error(detail);
    }
  };

  return (
    <Card bordered={false} style={{ marginTop: 24 }}>
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>用户管理</Title>
            <Text type="secondary">仅超级管理员可见，可创建、禁用或删除账户。</Text>
          </div>
          <Button type="primary" onClick={() => { setCreateModalOpen(true); createForm.resetFields(); }}>
            新增用户
          </Button>
        </div>

        <Table<AuthUser>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Space>

      <Modal
        title="新增用户"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ is_active: true, is_superuser: false, totp_required: false }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }, { min: 3, message: "至少 3 位" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="临时密码"
            rules={[{ required: true, message: "请输入密码" }, { min: 8, message: "至少 8 位" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            rules={[{ required: true, message: "请再次输入密码" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="is_superuser" label="超级管理员" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="totp_required" label="强制二次认证" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${targetUser?.username ?? ""}`}
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={handleResetPassword}
        okText="保存"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: "请输入新密码" }, { min: 8, message: "至少 8 位" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagementCard;
