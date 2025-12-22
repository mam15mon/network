import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Grid, Typography, message, theme } from "antd";

import type {
  LicenseCheckRequest,
  LicenseOverview,
  LicenseRecord,
} from "../../api/license";
import {
  collectDid,
  deleteLicenseRecord,
  deleteLicenseSnapshot,
  enableSFTP,
  exportDid,
  fetchLicenseOverview,
  getLicenseRecordAk,
  getLicenseRecordDid,
  getLicenseRecords,
  refreshLicenseRecords,
  refreshLicenseStatus,
  uploadLicenseFile,
  uploadLicensePackagePreview,
  installLicensePackage,
} from "../../api/license";
import { fetchHosts, type Host } from "../../api/hosts";
import { naturalCompare } from "../../utils/sort";
import { useTwoStateSort, SortOrder as TwoStateSortOrder } from "../../hooks/useTwoStateSort";

import LicenseFilters from "./LicenseFilters";
import LicenseActions from "./LicenseActions";
import LicenseOverviewTable from "./LicenseOverviewTable";
import LicenseManagementContent from "./LicenseManagementContent";
import LicenseManagementModals from "./LicenseManagementModals";
import {
  hostHasPermanentLicense,
  licenseComparators,
  licenseRecordComparators,
} from "./constants";
import type { LicenseTypeFilter } from "./types";
import { createContainerStyle, createInfoBoxStyle, mergeStyles } from "../../styles/commonStyles";
import { useLicenseModals } from "./hooks/useLicenseModals";
import { useLicenseOperations } from "./hooks/useLicenseOperations";

const { Text } = Typography;

interface LicenseManagementProps {
  hosts: Host[];
  loading: boolean;
}

const LicenseManagement = ({ hosts, loading }: LicenseManagementProps) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const pageContainerStyle = useMemo(
    () =>
      mergeStyles(createContainerStyle(token, true), {
        border: "none",
        boxShadow: "none",
        padding: isMobile ? 16 : 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }),
    [token, isMobile],
  );
  const filtersSectionStyle = useMemo(
    () =>
      mergeStyles(createInfoBoxStyle(token), {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: isMobile ? 16 : 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }),
    [token, isMobile],
  );
  const tableSectionStyle = useMemo(
    () =>
      mergeStyles(createInfoBoxStyle(token), {
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: isMobile ? 8 : 12,
        overflowX: "auto",
      }),
    [token, isMobile],
  );

  const [licenseData, setLicenseData] = useState<LicenseOverview[]>([]);
  const [licenseRecords, setLicenseRecords] = useState<LicenseRecord[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [isHostSelectionDirty, setIsHostSelectionDirty] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [licenseTypeFilter, setLicenseTypeFilter] = useState<LicenseTypeFilter>("manual");
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const mergeHosts = useCallback((base: Host[], incoming: Host[]): Host[] => {
    const map = new Map<string, Host>();
    const append = (list: Host[]) => {
      list.forEach((host) => {
        const key = host?.name?.trim();
        if (!key) {
          return;
        }
        if (!map.has(key)) {
          map.set(key, host);
        }
      });
    };
    append(base);
    append(incoming);
    return Array.from(map.values());
  }, []);

  const [availableHosts, setAvailableHosts] = useState<Host[]>(() => mergeHosts([], hosts));

  useEffect(() => {
    setAvailableHosts((prev) => mergeHosts(prev, hosts));
  }, [hosts, mergeHosts]);

  useEffect(() => {
    let cancelled = false;

    const loadAllHosts = async () => {
      try {
        const data = await fetchHosts();
        if (!cancelled) {
          setAvailableHosts((prev) => mergeHosts(prev, data));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("加载许可证页面可用设备列表失败", error);
      }
    };

    void loadAllHosts();

    return () => {
      cancelled = true;
    };
  }, []);

  const combinedHosts = useMemo(() => {
    const hostMap = new Map<string, Host>();
    availableHosts.forEach((host) => {
      const name = host?.name?.trim();
      if (!name) {
        return;
      }
      hostMap.set(name, host);
    });

    let syntheticId = -1;
    licenseData.forEach((record) => {
      const hostName = record.host_name?.trim();
      if (!hostName || hostMap.has(hostName)) {
        return;
      }
      hostMap.set(hostName, {
        id: syntheticId--,
        name: hostName,
        hostname: hostName,
        platform: "",
        site: record.site?.toString().trim(),
      } as Host);
    });

    return Array.from(hostMap.values());
  }, [availableHosts, licenseData]);

  const {
    historyModal,
    setHistoryModal,
    previewModal,
    setPreviewModal,
    fileUploadModal,
    setFileUploadModal,
    zipUploadModal,
    setZipUploadModal,
    packagePreview,
    setPackagePreview,
    uploadResults,
    setUploadResults,
    openHistoryModal,
    closeHistoryModal,
    closePreviewModal,
  } = useLicenseModals();

  const lastLicenseRequestKeyRef = useRef<string>("");
  const lastRecordsRequestKeyRef = useRef<string>("");

  const sortedHosts = useMemo(
    () => [...combinedHosts].sort((a, b) => naturalCompare(a.name ?? "", b.name ?? "")),
    [combinedHosts],
  );

  const sites = useMemo(() => {
    const siteSet = new Set<string>();
    sortedHosts.forEach((host) => {
      const value = host.site?.trim();
      if (value) {
        siteSet.add(value);
      }
    });
    licenseData.forEach((item) => {
      const value = item.site?.toString().trim();
      if (value) {
        siteSet.add(value);
      }
    });
    return Array.from(siteSet).sort((a, b) => naturalCompare(a, b));
  }, [sortedHosts, licenseData]);

  const {
    sortedData: sortedLicenseData,
    handleChange: handleLicenseSortChange,
    getSortOrderForColumn: getLicenseSortOrder,
  } = useTwoStateSort<LicenseOverview>({
    data: licenseData,
    comparators: licenseComparators,
    defaultColumnKey: "host_name",
  });

  const normalizedSite = useMemo(() => selectedSite.trim(), [selectedSite]);
  const normalizedSelectedHosts = useMemo(
    () => selectedHosts.map((item) => item?.trim()).filter((item): item is string => Boolean(item)),
    [selectedHosts],
  );

  const filteredLicenseData = useMemo(() => {
    const matchesSite = (record: LicenseOverview) => {
      if (!normalizedSite) {
        return true;
      }
      return record.site?.toString().trim() === normalizedSite;
    };

    if (licenseTypeFilter === "manual") {
      const manualSet = new Set(normalizedSelectedHosts);
      return sortedLicenseData.filter((record) => {
        if (!matchesSite(record)) {
          return false;
        }
        if (manualSet.size === 0) {
          return true;
        }
        const hostName = record.host_name?.trim();
        return Boolean(hostName && manualSet.has(hostName));
      });
    }

    const base = sortedLicenseData.filter(matchesSite);
    if (licenseTypeFilter === "all") {
      return base;
    }

    return base.filter((record) => {
      const hasPermanent = hostHasPermanentLicense(record);
      return licenseTypeFilter === "permanent" ? hasPermanent : !hasPermanent;
    });
  }, [licenseTypeFilter, normalizedSelectedHosts, normalizedSite, sortedLicenseData]);

  const filteredHostNames = useMemo(() => {
    const hostNames = new Set<string>();
    filteredLicenseData.forEach((record) => {
      const name = record.host_name?.trim();
      if (name) {
        hostNames.add(name);
      }
    });
    return Array.from(hostNames).sort((a, b) => naturalCompare(a, b));
  }, [filteredLicenseData]);

  const licenseHostSiteMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    licenseData.forEach((record) => {
      const name = record.host_name?.trim();
      if (!name || map.has(name)) {
        return;
      }
      const site = record.site?.toString().trim();
      map.set(name, site);
    });
    return map;
  }, [licenseData]);

  const hostSiteMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    combinedHosts.forEach((host) => {
      const name = host.name?.trim();
      if (!name) {
        return;
      }
      const site = host.site?.toString().trim();
      if (site) {
        map.set(name, site);
      }
    });
    licenseHostSiteMap.forEach((site, name) => {
      if (!map.has(name)) {
        map.set(name, site);
      }
    });
    return map;
  }, [combinedHosts, licenseHostSiteMap]);

  const hostsForFilters = useMemo(() => {
    if (!normalizedSite) {
      return sortedHosts;
    }
    return sortedHosts.filter((host) => {
      const name = host.name?.trim();
      if (!name) {
        return false;
      }
      const site = host.site?.toString().trim() ?? hostSiteMap.get(name) ?? "";
      return site === normalizedSite;
    });
  }, [hostSiteMap, normalizedSite, sortedHosts]);

  const selectedHostsCount = selectedHosts.length;

  useEffect(() => {
    if (licenseTypeFilter !== "manual" && selectedHostsCount === 0) {
      setIsHostSelectionDirty(false);
    }
  }, [licenseTypeFilter, selectedHostsCount]);

  useEffect(() => {
    if (!normalizedSite || licenseTypeFilter !== "manual") {
      return;
    }
    setSelectedHosts((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const filtered = prev.filter((name) => (hostSiteMap.get(name) ?? "") === normalizedSite);
      if (filtered.length === prev.length) {
        return prev;
      }
      setIsHostSelectionDirty(filtered.length > 0);
      return filtered;
    });
  }, [hostSiteMap, licenseTypeFilter, normalizedSite]);

  const {
    sortedData: sortedLicenseRecords,
    handleChange: handleRecordSortChange,
    getSortOrderForColumn: getRecordSortOrder,
  } = useTwoStateSort<LicenseRecord>({
    data: licenseRecords,
    comparators: licenseRecordComparators,
    defaultColumnKey: "host_name",
  });

  const filteredHistoryRecords = useMemo(() => {
    if (!historyModal.host) {
      return sortedLicenseRecords;
    }
    return sortedLicenseRecords.filter((record) => record.host_name === historyModal.host);
  }, [sortedLicenseRecords, historyModal.host]);

  const activeSelection = isHostSelectionDirty ? selectedHosts : filteredHostNames;
  const selectionMode = isHostSelectionDirty ? "手动选择" : "自动匹配";
  const selectionDescription = isHostSelectionDirty
    ? "仅操作手动选中的主机"
    : "根据筛选结果自动包含所有主机";
  const selectionModeVariant = isHostSelectionDirty ? "info" : "neutral";
  const selectedCount = activeSelection.length;
  const totalFilteredHosts = filteredHostNames.length;
  const selectedHostsForFilters = selectedHosts;

  const scrollToTop = useCallback(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const extractHostIdentifiers = useCallback((values: string[]): string[] => {
    return values
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));
  }, []);

  const resolveActiveHosts = useCallback((): string[] => {
    if (licenseTypeFilter === "manual") {
      const manualHosts = extractHostIdentifiers(selectedHosts);
      if (normalizedSite) {
        return manualHosts.filter((name) => (hostSiteMap.get(name) ?? "") === normalizedSite);
      }
      return manualHosts;
    }

    const matchedHosts = filteredLicenseData
      .map((record) => record.host_name?.trim())
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(matchedHosts));
  }, [extractHostIdentifiers, filteredLicenseData, hostSiteMap, licenseTypeFilter, normalizedSite, selectedHosts]);

  const buildBaseRequest = useCallback((): LicenseCheckRequest => {
    const request: LicenseCheckRequest = {};
    const manualHosts = extractHostIdentifiers(selectedHosts);
    if (licenseTypeFilter === "manual" && manualHosts.length > 0) {
      request.hosts = manualHosts;
    } else if (isHostSelectionDirty && manualHosts.length > 0) {
      request.hosts = manualHosts;
    }

    if (selectedSite) {
      request.site = selectedSite;
    }

    return request;
  }, [extractHostIdentifiers, isHostSelectionDirty, licenseTypeFilter, selectedHosts, selectedSite]);

  const buildActionRequest = useCallback((): LicenseCheckRequest => {
    const request = buildBaseRequest();
    const actionHosts = resolveActiveHosts();
    if (actionHosts.length > 0) {
      request.hosts = actionHosts;
    } else {
      delete request.hosts;
    }

    return request;
  }, [buildBaseRequest, resolveActiveHosts]);

  const buildRequestKey = useCallback((request: LicenseCheckRequest) => {
    const hostsKey = request.hosts
      ? [...request.hosts]
        .map((host) => (typeof host === "string" ? host.trim() : String(host)))
        .filter(Boolean)
        .sort()
        .join("|")
      : "";
    const siteKey = request.site?.trim() ?? "";
    return `${siteKey}::${hostsKey}`;
  }, []);

  const loadLicenseData = useCallback(async (force = false) => {
    try {
      const request = buildBaseRequest();
      const requestKey = buildRequestKey(request);

      if (!force && lastLicenseRequestKeyRef.current === requestKey) {
        return;
      }

      const data = await fetchLicenseOverview(request);
      setLicenseData(data);
      lastLicenseRequestKeyRef.current = requestKey;
    } catch (error: any) {
      message.error("加载许可证数据失败: " + (error.response?.data?.detail || error.message));
    }
  }, [buildBaseRequest, buildRequestKey]);

  const loadLicenseRecords = useCallback(
    async (refresh: boolean, force = false, requestOverride?: LicenseCheckRequest) => {
      const request = requestOverride ?? buildBaseRequest();
      const requestKey = buildRequestKey(request);

      if (!force && !refresh && lastRecordsRequestKeyRef.current === requestKey) {
        return;
      }

      try {
        setRecordsLoading(true);
        const records = refresh ? await refreshLicenseRecords(request) : await getLicenseRecords();
        setLicenseRecords(records);
        lastRecordsRequestKeyRef.current = requestKey;
      } catch (error: any) {
        message.error("加载许可证记录失败: " + (error.response?.data?.detail || error.message));
      } finally {
        setRecordsLoading(false);
      }
    },
    [buildBaseRequest, buildRequestKey],
  );

  useEffect(() => {
    if (hosts.length > 0) {
      loadLicenseData();
    }
  }, [hosts, loadLicenseData]);

  useEffect(() => {
    loadLicenseRecords(false);
  }, [loadLicenseRecords]);

  const {
    isProcessing,
    isDidProcessing,
    licenseExporting,
    zipUploading,
    packageInstalling,
    handleRefreshLicenseStatus,
    handleEnableSFTP,
    handleDownloadDid,
    handleExportLicenseExcel,
    handleFileUpload,
    handleZipUpload,
    handleConfirmPackageInstall,
  } = useLicenseOperations({
    resolveActiveHosts,
    filteredHostNames,
    hostSiteMap,
    licenseRecords,
    buildActionRequest,
    buildBaseRequest,
    loadLicenseData,
    loadLicenseRecords,
    refreshLicenseStatusFn: refreshLicenseStatus,
    enableSFTPFn: enableSFTP,
    collectDidFn: collectDid,
    exportDidFn: exportDid,
    getLicenseRecordAkFn: getLicenseRecordAk,
    uploadLicenseFileFn: uploadLicenseFile,
    uploadLicensePackagePreviewFn: uploadLicensePackagePreview,
    installLicensePackageFn: installLicensePackage,
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
  });

  const handleLicenseTypeFilterChange = useCallback((value: LicenseTypeFilter) => {
    setLicenseTypeFilter(value);
    if (value === "manual") {
      setSelectedHosts([]);
      setIsHostSelectionDirty(true);
    } else {
      setIsHostSelectionDirty(false);
    }
  }, []);

  useEffect(() => {
    if (!normalizedSite || licenseTypeFilter !== "manual") {
      return;
    }
    setSelectedHosts((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const filtered = prev.filter((name) => (hostSiteMap.get(name) ?? "") === normalizedSite);
      if (filtered.length === prev.length) {
        return prev;
      }
      setIsHostSelectionDirty(filtered.length > 0);
      return filtered;
    });
  }, [hostSiteMap, licenseTypeFilter, normalizedSite]);

  const handleCancelPackagePreview = useCallback(() => {
    setPackagePreview(null);
  }, []);

  const handleOpenZipUpload = useCallback(() => {
    setZipUploadModal((prev) => ({ ...prev, visible: true }));
  }, []);

  const handleFileModalHostChange = useCallback((value: string) => {
    setFileUploadModal((prev) => ({ ...prev, targetHost: value }));
  }, []);

  const handleFileModalChange = useCallback((files: any[]) => {
    setFileUploadModal((prev) => ({ ...prev, fileList: files }));
  }, []);

  const handleFileModalCancel = useCallback(() => {
    setFileUploadModal({ visible: false, targetHost: "", fileList: [] });
  }, []);

  const handleZipModalChange = useCallback((files: any[]) => {
    setZipUploadModal((prev) => ({ ...prev, fileList: files }));
  }, []);

  const handleZipModalCancel = useCallback(() => {
    setZipUploadModal({ visible: false, fileList: [] });
  }, []);

  const handleHistoryModalClose = useCallback(() => {
    closeHistoryModal();
    setHistoryLoading(false);
  }, [closeHistoryModal]);

  const handleOpenFileUpload = useCallback(() => {
    const activeHosts = resolveActiveHosts();
    if (activeHosts.length === 0) {
      message.warning("当前没有可操作的主机，请先筛选或手动选择设备");
      return;
    }
    if (activeHosts.length !== 1) {
      message.warning("上传许可证文件需单台设备，请仅保留一台主机");
      return;
    }
    setFileUploadModal({ visible: true, targetHost: activeHosts[0], fileList: [] });
  }, [resolveActiveHosts]);

  const handlePreview = useCallback(async (record: LicenseRecord, type: "did" | "ak") => {
    try {
      setPreviewModal((prev) => ({ ...prev, visible: true, loading: true }));
      if (type === "did") {
        setPreviewModal((prev) => ({ ...prev, title: `${record.host_name} · ${record.did_filename ?? "DID"}` }));
        const content = await getLicenseRecordDid(record.id);
        setPreviewModal({ visible: true, title: `${record.host_name} · ${record.did_filename ?? "DID"}`, content, loading: false });
      } else {
        setPreviewModal((prev) => ({ ...prev, title: `${record.host_name} · ${record.ak_filename ?? "AK"}` }));
        const content = await getLicenseRecordAk(record.id);
        setPreviewModal({ visible: true, title: `${record.host_name} · ${record.ak_filename ?? "AK"}`, content, loading: false });
      }
    } catch (error: any) {
      setPreviewModal((prev) => ({ ...prev, visible: false, loading: false }));
      message.error("加载文件失败: " + (error.response?.data?.detail || error.message));
    }
  }, []);

  const handleDeleteRecord = useCallback(
    async (recordId: number, hostName: string) => {
      try {
        await deleteLicenseRecord(recordId);
        message.success("许可证记录删除成功");
        await loadLicenseRecords(false, true);
      } catch (error: any) {
        message.error("删除失败: " + (error.response?.data?.detail || error.message));
      }
    },
    [loadLicenseRecords],
  );

  const handleDeleteSnapshot = useCallback(
    async (hostName: string) => {
      try {
        await deleteLicenseSnapshot(hostName);
        message.success("许可证状态删除成功");
        await loadLicenseData(true);
      } catch (error: any) {
        message.error("删除失败: " + (error.response?.data?.detail || error.message));
      }
    },
    [loadLicenseData],
  );

  const handleUploadResultsClose = useCallback(() => {
    setUploadResults([]);
  }, []);

  const filtersNode = (
    <LicenseFilters
      sites={sites}
      hosts={hostsForFilters}
      selectedSite={selectedSite}
      onSiteChange={(value) => setSelectedSite(value ?? "")}
      selectedHosts={selectedHostsForFilters}
      onSelectedHostsChange={setSelectedHosts}
      onHostSelectionDirtyChange={setIsHostSelectionDirty}
      licenseTypeFilter={licenseTypeFilter}
      onLicenseTypeFilterChange={handleLicenseTypeFilterChange}
      selectionMode={selectionMode}
      selectionDescription={selectionDescription}
      selectionModeVariant={selectionModeVariant}
      selectedCount={selectedCount}
      totalFilteredHosts={totalFilteredHosts}
      isMobile={isMobile}
    />
  );

  const actionsNode = (
    <LicenseActions
      onRefreshStatus={handleRefreshLicenseStatus}
      onEnableSFTP={handleEnableSFTP}
      onDownloadDid={handleDownloadDid}
      onExportLicense={handleExportLicenseExcel}
      onOpenZipUpload={handleOpenZipUpload}
      onOpenFileUpload={handleOpenFileUpload}
      isProcessing={isProcessing}
      isDidProcessing={isDidProcessing}
      isExporting={licenseExporting}
      zipUploading={zipUploading}
    />
  );

  const alertNode = (
    <Alert
      message="操作说明"
      description={'系统会自动启用SFTP、上传许可证文件并执行安装，可随时通过"同步设备许可证数据"获取最新结果。'}
      type="info"
      showIcon
      style={{ margin: 0 }}
    />
  );

  const tableNode = (
    <LicenseOverviewTable
      data={filteredLicenseData}
      isMobile={isMobile}
      getSortOrderForColumn={(key) => (key ? getLicenseSortOrder(key) : undefined)}
      onSortChange={handleLicenseSortChange}
      onShowHistory={async (record) => {
        openHistoryModal(record.host_name ?? null);
        setHistoryLoading(true);
        try {
          await loadLicenseRecords(false, true);
        } finally {
          setHistoryLoading(false);
        }
      }}
      onDeleteSnapshot={handleDeleteSnapshot}
      onPageChange={scrollToTop}
    />
  );

  return (
    <>
      <LicenseManagementContent
        pageContainerStyle={pageContainerStyle}
        filtersSectionStyle={filtersSectionStyle}
        tableSectionStyle={tableSectionStyle}
        loading={loading}
        filters={filtersNode}
        actions={actionsNode}
        alert={alertNode}
        table={tableNode}
      />

      <LicenseManagementModals
        hostsForFilters={hostsForFilters}
        fileUploadModal={fileUploadModal}
        onFileHostChange={handleFileModalHostChange}
        onFileChange={handleFileModalChange}
        onFileUpload={handleFileUpload}
        onFileCancel={handleFileModalCancel}
        isProcessing={isProcessing}
        zipUploadModal={zipUploadModal}
        onZipFileChange={handleZipModalChange}
        onZipUpload={handleZipUpload}
        onZipCancel={handleZipModalCancel}
        zipUploading={zipUploading}
        packagePreview={packagePreview}
        onConfirmPackageInstall={handleConfirmPackageInstall}
        onCancelPackagePreview={handleCancelPackagePreview}
        packageInstalling={packageInstalling}
        historyModal={historyModal}
        filteredHistoryRecords={filteredHistoryRecords}
        historyLoading={historyLoading}
        getRecordSortOrder={(key) => (key ? getRecordSortOrder(key) : undefined)}
        handleRecordSortChange={handleRecordSortChange}
        closeHistoryModal={handleHistoryModalClose}
        handlePreview={handlePreview}
        handleDeleteRecord={handleDeleteRecord}
        scrollToTop={scrollToTop}
        previewModal={previewModal}
        closePreviewModal={closePreviewModal}
        uploadResults={uploadResults}
        onUploadResultsClose={handleUploadResultsClose}
      />
    </>
  );
};

export default LicenseManagement;
