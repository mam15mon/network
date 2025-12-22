import { useCallback, useState } from "react";
import { message } from "antd";

import type {
  DidCollectionResult,
  EnableSFTPRequest,
  LicenseCheckRequest,
  LicenseSnapshotRefreshResponse,
  LicenseRecord,
  LicenseUploadResult,
  LicensePackagePreviewResponse,
} from "../../../api/license";
import type { UploadModalState, ZipUploadModalState, LicenseTypeFilter } from "../types";
import { exportLicenseExcel } from "../actions/exportLicenseExcel";
import { downloadDidArchive } from "../actions/downloadDid";

interface UseLicenseOperationsParams {
  resolveActiveHosts: () => string[];
  filteredHostNames: string[];
  hostSiteMap: Map<string, string | undefined>;
  licenseRecords: LicenseRecord[];
  buildActionRequest: () => LicenseCheckRequest;
  buildBaseRequest: () => LicenseCheckRequest;
  loadLicenseData: (force?: boolean) => Promise<void>;
  loadLicenseRecords: (refresh: boolean, force?: boolean, requestOverride?: LicenseCheckRequest) => Promise<void>;
  refreshLicenseStatusFn: (request: LicenseCheckRequest) => Promise<LicenseSnapshotRefreshResponse>;
  enableSFTPFn: (request: EnableSFTPRequest) => Promise<unknown>;
  collectDidFn: (request: LicenseCheckRequest) => Promise<DidCollectionResult[]>;
  exportDidFn: (request: LicenseCheckRequest) => Promise<Blob>;
  getLicenseRecordAkFn: (recordId: number) => Promise<string>;
  uploadLicenseFileFn: (hostName: string, file: File) => Promise<{
    message: string;
    result: LicenseUploadResult;
    file_name: string;
  }>;
  uploadLicensePackagePreviewFn: (file: File) => Promise<LicensePackagePreviewResponse>;
  installLicensePackageFn: (payload: { plan_id: string; hosts: string[] }) => Promise<LicenseUploadResult[]>;
  fileUploadModal: UploadModalState;
  setFileUploadModal: React.Dispatch<React.SetStateAction<UploadModalState>>;
  zipUploadModal: ZipUploadModalState;
  setZipUploadModal: React.Dispatch<React.SetStateAction<ZipUploadModalState>>;
  packagePreview: LicensePackagePreviewResponse | null;
  setPackagePreview: React.Dispatch<React.SetStateAction<LicensePackagePreviewResponse | null>>;
  setUploadResults: React.Dispatch<React.SetStateAction<LicenseUploadResult[]>>;
  setSelectedHosts: React.Dispatch<React.SetStateAction<string[]>>;
  setIsHostSelectionDirty: (value: boolean) => void;
  licenseTypeFilter: LicenseTypeFilter;
}

interface UseLicenseOperationsResult {
  isProcessing: boolean;
  isDidProcessing: boolean;
  licenseExporting: boolean;
  zipUploading: boolean;
  packageInstalling: boolean;
  handleRefreshLicenseStatus: (targetHost?: string) => Promise<void>;
  handleEnableSFTP: () => Promise<void>;
  handleDownloadDid: () => Promise<void>;
  handleExportLicenseExcel: () => Promise<void>;
  handleFileUpload: () => Promise<void>;
  handleZipUpload: () => Promise<void>;
  handleConfirmPackageInstall: () => Promise<void>;
}

export const useLicenseOperations = ({
  resolveActiveHosts,
  filteredHostNames,
  hostSiteMap,
  licenseRecords,
  buildActionRequest,
  buildBaseRequest,
  loadLicenseData,
  loadLicenseRecords,
  refreshLicenseStatusFn,
  enableSFTPFn,
  collectDidFn,
  exportDidFn,
  getLicenseRecordAkFn,
  uploadLicenseFileFn,
  uploadLicensePackagePreviewFn,
  installLicensePackageFn,
  fileUploadModal,
  setFileUploadModal,
  zipUploadModal,
  setZipUploadModal,
  packagePreview,
  setPackagePreview,
  setUploadResults,
  setSelectedHosts,
  setIsHostSelectionDirty,
  licenseTypeFilter,
}: UseLicenseOperationsParams): UseLicenseOperationsResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDidProcessing, setIsDidProcessing] = useState(false);
  const [licenseExporting, setLicenseExporting] = useState(false);
  const [zipUploading, setZipUploadingState] = useState(false);
  const [packageInstalling, setPackageInstallingState] = useState(false);

  const handleRefreshLicenseStatus = useCallback(
    async (targetHost?: string) => {
      const request = buildBaseRequest();
      let targetHosts: string[] = [];
      if (targetHost) {
        targetHosts = [targetHost];
      } else {
        targetHosts = resolveActiveHosts();
      }
      if (targetHosts.length > 0) {
        request.hosts = targetHosts;
      } else {
        delete request.hosts;
      }
      setIsProcessing(true);
      try {
        const response = await refreshLicenseStatusFn(request);
        await loadLicenseData(true);
        await loadLicenseRecords(true, true, request);
        const summary = response.summary;
        if (summary) {
          const { processed, success, failed } = summary;
          if (processed === 0) {
            message.info("本次同步未匹配到设备");
          } else if (failed.length > 0) {
            const preview = failed.slice(0, 5).join(", ");
            message.warning(`同步完成: 成功 ${success}/${processed} 台，失败 ${failed.length} 台 (${preview}${failed.length > 5 ? " 等" : ""})`);
          } else {
            message.success(`同步完成: 成功 ${success}/${processed} 台设备`);
          }
        } else {
          message.success("设备许可证状态同步完成");
        }
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? error?.message ?? "同步失败";
        message.error(detail);
      } finally {
        setIsProcessing(false);
      }
    },
    [buildBaseRequest, loadLicenseData, loadLicenseRecords, refreshLicenseStatusFn, resolveActiveHosts],
  );

  const handleEnableSFTP = useCallback(async () => {
    setIsProcessing(true);
    try {
      const request = buildActionRequest() as EnableSFTPRequest;
      if ((!request.hosts || request.hosts.length === 0) && !request.site) {
        message.warning("请先选择至少一台设备或指定站点");
        return;
      }
      await enableSFTPFn(request);
      message.success("SFTP 启用指令已发送");
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "启用失败";
      message.error(detail);
    } finally {
      setIsProcessing(false);
    }
  }, [buildActionRequest, enableSFTPFn]);

  const handleDownloadDid = useCallback(async () => {
    const targetHosts = resolveActiveHosts();

    if (licenseTypeFilter === "manual" && targetHosts.length === 0) {
      message.warning("请先在手动选择模式下选择至少一台设备");
      return;
    }

    if (targetHosts.length === 0 && filteredHostNames.length === 0) {
      message.warning("当前筛选无可下载的主机");
      return;
    }

    setIsDidProcessing(true);
    try {
      const request = buildActionRequest();
      const { collection } = await downloadDidArchive({
        targetHosts,
        request,
        collectDid: collectDidFn,
        exportDid: exportDidFn,
      });

      if (collection.length > 0) {
        const successCount = collection.filter((item) => item.status === "success").length;
        const failedCount = collection.length - successCount;
        const text =
          failedCount > 0
            ? `DID 收集完成: ${successCount}/${collection.length} 台设备，${failedCount} 台失败`
            : `DID 收集完成: ${successCount}/${collection.length} 台设备`;
        (failedCount > 0 ? message.warning : message.success)(text);
      }

      await loadLicenseRecords(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "下载 DID 失败";
      message.error(detail);
    } finally {
      setIsDidProcessing(false);
    }
  }, [
    buildActionRequest,
    collectDidFn,
    exportDidFn,
    filteredHostNames.length,
    licenseTypeFilter,
    loadLicenseRecords,
    resolveActiveHosts,
  ]);

  const handleExportLicenseExcel = useCallback(async () => {
    setLicenseExporting(true);
    try {
      const { exportedCount, missingHosts } = await exportLicenseExcel({
        records: licenseRecords,
        resolveActiveHosts,
        filteredHostNames,
        hostSiteMap,
        fetchAkContent: getLicenseRecordAkFn,
      });

      if (exportedCount === 0) {
        message.warning("当前筛选下没有可导出的许可证记录");
        return;
      }

      if (missingHosts.length > 0) {
        const preview = missingHosts.slice(0, 5).join(", ");
        message.warning(
          `导出完成（${exportedCount} 条记录），但以下主机缺少 AK 详情：${preview}${missingHosts.length > 5 ? " 等" : ""}`,
        );
      } else {
        message.success(`导出成功，共 ${exportedCount} 条记录`);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "导出失败";
      message.error(detail);
    } finally {
      setLicenseExporting(false);
    }
  }, [filteredHostNames, getLicenseRecordAkFn, hostSiteMap, licenseRecords, resolveActiveHosts]);

  const handleFileUpload = useCallback(async () => {
    if (fileUploadModal.fileList.length === 0 || !fileUploadModal.targetHost) {
      message.warning("请选择要上传的设备和文件");
      return;
    }

    const file = fileUploadModal.fileList[0].originFileObj as File;
    const hostName = fileUploadModal.targetHost;

    setIsProcessing(true);
    try {
      const response = await uploadLicenseFileFn(hostName, file);
      const result = response.result;
      const success = result.upload_status === "成功" && result.install_status === "成功";

      if (success) {
        message.success(response.message || "许可证上传并安装完成");
        setSelectedHosts([hostName]);
        setIsHostSelectionDirty(true);
        await handleRefreshLicenseStatus(hostName);
      } else {
        message.warning(response.message || "许可证操作完成，但存在异常");
      }

      setFileUploadModal({ visible: false, targetHost: "", fileList: [] });
      await loadLicenseData(true);
      await loadLicenseRecords(false, true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "文件上传失败";
      message.error(detail);
    } finally {
      setIsProcessing(false);
    }
  }, [
    fileUploadModal,
    handleRefreshLicenseStatus,
    loadLicenseData,
    loadLicenseRecords,
    setFileUploadModal,
    setIsHostSelectionDirty,
    setSelectedHosts,
    uploadLicenseFileFn,
  ]);

  const handleZipUpload = useCallback(async () => {
    if (zipUploadModal.fileList.length === 0) {
      message.error("请选择 ZIP 文件");
      return;
    }

    setZipUploadingState(true);
    try {
      const file = zipUploadModal.fileList[0].originFileObj as File;
      const preview = await uploadLicensePackagePreviewFn(file);
      if (preview.items.length === 0) {
        message.warning("未解析到可安装的许可证条目");
      }
      setPackagePreview(preview);
      setZipUploadModal({ visible: false, fileList: [] });
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "预览解析失败";
      message.error(detail);
    } finally {
      setZipUploadingState(false);
    }
  }, [setPackagePreview, setZipUploadModal, uploadLicensePackagePreviewFn, zipUploadModal]);

  const handleConfirmPackageInstall = useCallback(async () => {
    if (!packagePreview) {
      return;
    }

    const readyHosts = packagePreview.items
      .filter((item) => item.status === "ready")
      .map((item) => item.host_name);

    if (readyHosts.length === 0) {
      message.warning("没有可安装的主机条目");
      return;
    }

    setPackageInstallingState(true);
    try {
      const results = await installLicensePackageFn({ plan_id: packagePreview.plan_id, hosts: readyHosts });
      setUploadResults(results);
      const successCount = results.filter((result) => result.upload_status === "成功" && result.install_status === "成功")
        .length;
      message.success(`许可证包安装完成: ${successCount}/${results.length} 台设备`);
      setPackagePreview(null);
      await loadLicenseData(true);
      await loadLicenseRecords(false, true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "许可证安装失败";
      message.error(detail);
    } finally {
      setPackageInstallingState(false);
    }
  }, [
    installLicensePackageFn,
    loadLicenseData,
    loadLicenseRecords,
    packagePreview,
    setPackagePreview,
    setUploadResults,
  ]);

  return {
    isProcessing,
    isDidProcessing,
    licenseExporting,
    zipUploading: zipUploading,
    packageInstalling,
    handleRefreshLicenseStatus,
    handleEnableSFTP,
    handleDownloadDid,
    handleExportLicenseExcel,
    handleFileUpload,
    handleZipUpload,
    handleConfirmPackageInstall,
  };
};
