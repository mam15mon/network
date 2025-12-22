import { memo } from "react";
import { Alert, Modal, Space, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

interface LicenseZipUploadModalProps {
  visible: boolean;
  fileList: any[];
  onFileChange: (files: any[]) => void;
  onUpload: () => void;
  onCancel: () => void;
  loading: boolean;
}

const LicenseZipUploadModal = memo(({
  visible,
  fileList,
  onFileChange,
  onUpload,
  onCancel,
  loading,
}: LicenseZipUploadModalProps) => (
  <Modal
    title="上传许可证包"
    open={visible}
    onOk={onUpload}
    confirmLoading={loading}
    onCancel={onCancel}
    width={500}
  >
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        message="提示"
        description="ZIP 需包含许可证激活 Excel（含‘自定义设备标识’与‘激活信息(AK 文件名)’列）以及对应 .ak 文件。上传后会先解析并预览，确认后才开始安装。"
        type="info"
        showIcon
      />
      <Upload.Dragger
        accept=".zip"
        beforeUpload={() => false}
        fileList={fileList}
        onChange={({ fileList: list }: { fileList: any[] }) => onFileChange(list.slice(-1))}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 ZIP 文件到此区域上传</p>
        <p className="ant-upload-hint">上传后先预览，确认后再安装</p>
      </Upload.Dragger>
    </Space>
  </Modal>
));

export default LicenseZipUploadModal;
