import { Alert, Button, Modal, Space, Spin, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

import type { ConfigSnapshotDetail } from "../../api/nornir";
import { highlightTextWithRules, type HighlightRule } from "../../utils/commandHighlight";

const { Paragraph, Text } = Typography;

interface SnapshotPreviewModalProps {
  visible: boolean;
  loading: boolean;
  data: ConfigSnapshotDetail | null;
  onClose: () => void;
  onDownloadSnapshot: (snapshotId: number, host: string, executedAt: string) => void;
  highlightRules?: HighlightRule[];
}

const SnapshotPreviewModal = ({
  visible,
  loading,
  data,
  onClose,
  onDownloadSnapshot,
  highlightRules,
}: SnapshotPreviewModalProps) => (
  <Modal
    open={visible}
    title={data ? `配置快照 - ${data.host}` : "配置快照"}
    onCancel={onClose}
    footer={null}
    width={900}
    destroyOnHidden
  >
    {loading ? (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin />
      </div>
    ) : data ? (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space size="large" wrap>
          <Text type="secondary">执行时间：{new Date(data.executedAt).toLocaleString()}</Text>
          {data.filePath && <Text type="secondary">文件：{data.filePath}</Text>}
        </Space>
        <Space size="small" wrap>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => onDownloadSnapshot(data.id, data.host, data.executedAt)}
          >
            下载配置
          </Button>
        </Space>
        <Paragraph copyable style={{ whiteSpace: "pre-wrap", maxHeight: 480, overflow: "auto" }}>
          {highlightRules?.length
            ? highlightTextWithRules(data.content ?? "", highlightRules)
            : data.content}
        </Paragraph>
      </Space>
    ) : (
      <Alert message="未获取到配置内容" type="warning" showIcon />
    )}
  </Modal>
);

export default SnapshotPreviewModal;
