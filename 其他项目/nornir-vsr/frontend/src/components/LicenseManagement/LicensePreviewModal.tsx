import { memo } from "react";
import { Modal, Spin, theme } from "antd";

interface LicensePreviewModalProps {
  visible: boolean;
  title: string;
  content: string;
  loading: boolean;
  onClose: () => void;
}

const LicensePreviewModal = memo(({ visible, title, content, loading, onClose }: LicensePreviewModalProps) => {
  const { token } = theme.useToken();

  return (
    <Modal title={title} open={visible} onCancel={onClose} footer={null} width={720}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Spin />
        </div>
      ) : (
        <pre
          style={{
            background: token.colorFillSecondary,
            color: token.colorText,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            fontFamily: token.fontFamilyCode,
            padding: 16,
            maxHeight: 400,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {content}
        </pre>
      )}
    </Modal>
  );
});

export default LicensePreviewModal;
