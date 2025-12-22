import { Modal, Space, Typography, Alert } from "antd";

import type { HistoryRecord } from "./types";
import StatusTag from "../common/StatusTag";
import { highlightTextWithRules, type HighlightRule } from "../../utils/commandHighlight";

const { Paragraph, Text } = Typography;

interface HistoryResultModalProps {
  visible: boolean;
  record: HistoryRecord | null;
  onClose: () => void;
  highlightRules?: HighlightRule[];
}

const HistoryResultModal = ({ visible, record, onClose, highlightRules }: HistoryResultModalProps) => (
  <Modal
    open={visible}
    title={record ? `命令输出 - ${record.host}` : "命令输出"}
    onCancel={onClose}
    footer={null}
    width={720}
    destroyOnHidden
  >
    {record ? (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space size="small" wrap>
          <StatusTag variant={record.failed ? "error" : "success"}>
            {record.failed ? "失败" : "成功"}
          </StatusTag>
          <Text type="secondary">执行时间：{new Date(record.executedAt).toLocaleString()}</Text>
          <Text type="secondary">命令类型：{record.commandType}</Text>
        </Space>
        <Paragraph copyable style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflowY: "auto", marginBottom: 0 }}>
          {highlightRules?.length
            ? highlightTextWithRules(record.result ?? "", highlightRules)
            : record.result || "(无输出)"}
        </Paragraph>
        {record.exception && <Alert type="error" showIcon message="执行异常" description={record.exception} />}
        {record.outputPath && <Text type="secondary">输出文件: {record.outputPath}</Text>}
      </Space>
    ) : (
      <Text type="secondary">暂无输出</Text>
    )}
  </Modal>
);

export default HistoryResultModal;
