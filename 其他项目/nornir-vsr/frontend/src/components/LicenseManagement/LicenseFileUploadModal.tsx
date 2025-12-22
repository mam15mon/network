import { memo } from "react";
import { Alert, Modal, Select, Space, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

import type { Host } from "../../api/hosts";


interface LicenseFileUploadModalProps {
  visible: boolean;
  hosts: Host[];
  selectedHost: string;
  onHostChange: (host: string) => void;
  fileList: any[];
  onFileChange: (files: any[]) => void;
  onUpload: () => void;
  onCancel: () => void;
  loading: boolean;
}

const LicenseFileUploadModal = memo(({
  visible,
  hosts,
  selectedHost,
  onHostChange,
  fileList,
  onFileChange,
  onUpload,
  onCancel,
  loading,
}: LicenseFileUploadModalProps) => (
  <Modal
    title="上传许可证文件"
    open={visible}
    onOk={onUpload}
    confirmLoading={loading}
    onCancel={onCancel}
    okText="上传并安装"
    width={500}
  >
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        message="提示"
        description="请选择目标主机，然后上传对应的 .ak 激活文件。系统会自动执行启用与安装。"
        type="info"
        showIcon
      />
      <Select
        value={selectedHost || undefined}
        onChange={onHostChange}
        style={{ width: "100%" }}
        disabled
        options={hosts.map((host) => ({ label: `${host.name} (${host.hostname})`, value: host.name }))}
        optionFilterProp="label"
        showSearch
      />
      <Upload.Dragger
        accept=".ak"
        beforeUpload={() => false}
        fileList={fileList}
        onChange={({ fileList: list }: { fileList: any[] }) => onFileChange(list.slice(-1))}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 .ak 文件到此区域上传</p>
        <p className="ant-upload-hint">上传后将立即推送并安装到所选主机</p>
      </Upload.Dragger>
    </Space>
  </Modal>
));

export default LicenseFileUploadModal;
