import { memo, useMemo } from "react";
import { Button, Space, Tooltip, Typography, theme } from "antd";
import {
  DownloadOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  createPrimaryButtonStyle,
  createRoundedButtonStyle,
  createVerticalDivider,
  mergeStyles,
} from "../../styles/commonStyles";

const { Text } = Typography;

interface LicenseActionsProps {
  onRefreshStatus: () => void;
  onEnableSFTP: () => void;
  onDownloadDid: () => void;
  onExportLicense: () => void;
  onOpenZipUpload: () => void;
  onOpenFileUpload: () => void;
  isProcessing: boolean;
  isDidProcessing: boolean;
  isExporting: boolean;
  zipUploading: boolean;
}

const LicenseActions = memo(({
  onRefreshStatus,
  onEnableSFTP,
  onDownloadDid,
  onExportLicense,
  onOpenZipUpload,
  onOpenFileUpload,
  isProcessing,
  isDidProcessing,
  isExporting,
  zipUploading,
}: LicenseActionsProps) => {
  const { token } = theme.useToken();
  const roundedButtonStyle = useMemo(() => createRoundedButtonStyle(token), [token]);
  const primaryButtonStyle = useMemo(() => createPrimaryButtonStyle(token), [token]);
  const dividerStyle = useMemo(() => createVerticalDivider(token, 36), [token]);

  return (
    <Space size="large" wrap align="center">
      <Space size="small" wrap>
        <Text strong>系统操作：</Text>
        <Tooltip title="从设备同步最新 DID 与许可证状态到系统数据库">
          <Button
            type="primary"
            onClick={() => onRefreshStatus()}
            loading={isProcessing}
            icon={<ReloadOutlined />}
            size="small"
            style={mergeStyles(roundedButtonStyle, primaryButtonStyle)}
          >
            同步设备许可证数据
          </Button>
        </Tooltip>
        <Button
          onClick={onEnableSFTP}
          loading={isProcessing}
          size="small"
          style={roundedButtonStyle}
        >
          启用SFTP
        </Button>
      </Space>
      <div style={dividerStyle} />
      <Space size="small" wrap>
        <Text strong>许可证操作：</Text>
        <Button
          icon={<DownloadOutlined />}
          onClick={onDownloadDid}
          loading={isDidProcessing}
          size="small"
          style={roundedButtonStyle}
        >
          下载 DID 文件
        </Button>
        <Button
          icon={<FileExcelOutlined />}
          onClick={onExportLicense}
          loading={isExporting}
          disabled={isProcessing}
          size="small"
          style={roundedButtonStyle}
        >
          导出许可证 Excel
        </Button>
        <Button
          icon={<UploadOutlined />}
          onClick={onOpenZipUpload}
          loading={zipUploading}
          size="small"
          style={roundedButtonStyle}
        >
          上传许可证包 (ZIP)
        </Button>
        <Button
          icon={<PlusOutlined />}
          onClick={onOpenFileUpload}
          disabled={isProcessing}
          size="small"
          style={roundedButtonStyle}
        >
          上传许可证文件
        </Button>
      </Space>
    </Space>
  );
});

export default LicenseActions;
