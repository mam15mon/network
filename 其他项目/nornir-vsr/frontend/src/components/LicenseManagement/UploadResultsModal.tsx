import { memo } from "react";
import { Modal, Table, Typography } from "antd";
import type { TableProps } from "antd";

import type { LicenseUploadResult } from "../../api/license";
import StatusTag from "../common/StatusTag";

interface UploadResultsModalProps {
  results: LicenseUploadResult[];
  onClose: () => void;
}

const UploadResultsModal = memo(({ results, onClose }: UploadResultsModalProps) => {
  const total = results.length;
  const successCount = results.filter(
    (item) => item.upload_status === "成功" && item.install_status === "成功",
  ).length;
  const failureCount = total - successCount;

  const columns: TableProps<LicenseUploadResult>["columns"] = [
    { title: "主机名", dataIndex: "host_name", key: "host_name" },
    {
      title: "上传状态",
      dataIndex: "upload_status",
      key: "upload_status",
      render: (text: string) => (
        <StatusTag variant={text === "成功" ? "success" : "error"}>{text}</StatusTag>
      ),
    },
    {
      title: "安装状态",
      dataIndex: "install_status",
      key: "install_status",
      render: (text: string) => (
        <StatusTag variant={text === "成功" ? "success" : "error"}>{text}</StatusTag>
      ),
    },
    {
      title: "试用剩余时间",
      dataIndex: "trial_days",
      key: "trial_days",
      render: (value: string | null | undefined, record) => {
        const normalized = (value ?? "").trim();
        if (!normalized || normalized.toUpperCase() === "N/A") {
          return record.install_status === "成功" ? "永久授权" : "-";
        }
        return normalized;
      },
    },
  ];

  return (
    <Modal
      title="上传安装结果"
      open={results.length > 0}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div style={{ overflowX: "auto" }}>
        {total > 0 && (
          <Typography.Paragraph
            type={failureCount === 0 ? "secondary" : "danger"}
            style={{ marginBottom: 16 }}
          >
            共 {total} 台设备：成功 {successCount} 台
            {failureCount > 0 ? `，失败 ${failureCount} 台。` : "。"}
          </Typography.Paragraph>
        )}
        <Table
          columns={columns}
          dataSource={results}
          rowKey="host_name"
          pagination={false}
          showSorterTooltip={false}
          bordered
          scroll={{ x: "max-content" }}
        />
      </div>
    </Modal>
  );
});

export default UploadResultsModal;
