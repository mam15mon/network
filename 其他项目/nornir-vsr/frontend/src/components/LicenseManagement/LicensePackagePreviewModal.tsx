import { memo, useMemo } from "react";
import { Modal, Table, Typography } from "antd";
import type { TableProps } from "antd";

import type { LicensePackagePreviewResponse } from "../../api/license";
import StatusTag from "../common/StatusTag";

interface LicensePackagePreviewModalProps {
  preview: LicensePackagePreviewResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

const statusVariantMap: Record<string, "success" | "error" | "warning"> = {
  ready: "success",
  error: "error",
};

const statusLabelMap: Record<string, string> = {
  ready: "就绪",
  error: "失败",
};

const LicensePackagePreviewModal = memo(({
  preview,
  onConfirm,
  onCancel,
  confirming,
}: LicensePackagePreviewModalProps) => {
  const readyCount = useMemo(
    () => preview?.items.filter((item) => item.status === "ready").length ?? 0,
    [preview],
  );

  const columns: TableProps<LicensePackagePreviewResponse["items"][number]>["columns"] = [
    {
      title: "主机名",
      dataIndex: "host_name",
      key: "host_name",
      width: 200,
      render: (text: string, record) => (
        <Typography.Text
          ellipsis={{ tooltip: record.hostname ? `${text} (${record.hostname})` : text }}
        >
          {record.hostname ? `${text} (${record.hostname})` : text}
        </Typography.Text>
      ),
    },
    {
      title: "AK 文件",
      dataIndex: "ak_filename",
      key: "ak_filename",
      width: 280,
      render: (value: string) => (
        <Typography.Text ellipsis={{ tooltip: value || "" }}>
          {value || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "DID 文件",
      dataIndex: "did_filename",
      key: "did_filename",
      width: 220,
      render: (value: string | null | undefined) => (
        <Typography.Text ellipsis={{ tooltip: value || "" }}>
          {value || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "检查状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      align: "center",
      render: (value: string) => (
        <StatusTag variant={statusVariantMap[value] ?? "warning"}>
          {statusLabelMap[value] ?? value}
        </StatusTag>
      ),
    },
    {
      title: "提示",
      dataIndex: "message",
      key: "message",
      width: 260,
      render: (value: string | null | undefined) => (
        value
          ? <Typography.Text type="danger">{value}</Typography.Text>
          : <Typography.Text type="secondary">-</Typography.Text>
      ),
    },
  ];

  return (
    <Modal
      title="许可证包解析结果"
      open={Boolean(preview)}
      onCancel={onCancel}
      onOk={onConfirm}
      okButtonProps={{ disabled: readyCount === 0, loading: confirming }}
      okText="开始安装"
      cancelText="取消"
      width={960}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary">
        已解析 {preview?.items.length ?? 0} 条记录，{readyCount} 条可执行安装。
      </Typography.Paragraph>
      <div style={{ overflowX: "auto" }}>
        <Table
          columns={columns}
          dataSource={preview?.items ?? []}
          rowKey={(record: LicensePackagePreviewResponse["items"][number]) => `${record.host_name}-${record.ak_filename}`}
          pagination={false}
          size="small"
          scroll={{ x: 1080 }}
        />
      </div>
    </Modal>
  );
});

export default LicensePackagePreviewModal;
