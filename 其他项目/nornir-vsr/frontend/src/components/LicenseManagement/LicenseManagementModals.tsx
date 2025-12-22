import { Suspense, lazy } from "react";

import type { Host } from "../../api/hosts";
import type {
  LicensePackagePreviewResponse,
  LicenseRecord,
  LicenseUploadResult,
} from "../../api/license";
import type { UploadModalState, ZipUploadModalState, PreviewModalState, HistoryModalState } from "./types";
import type { SortOrder as TwoStateSortOrder } from "../../hooks/useTwoStateSort";

const LicenseFileUploadModal = lazy(() => import("./LicenseFileUploadModal"));
const LicenseZipUploadModal = lazy(() => import("./LicenseZipUploadModal"));
const LicensePackagePreviewModal = lazy(() => import("./LicensePackagePreviewModal"));
const LicenseHistoryModal = lazy(() => import("./LicenseHistoryModal"));
const LicensePreviewModal = lazy(() => import("./LicensePreviewModal"));
const UploadResultsModal = lazy(() => import("./UploadResultsModal"));

interface LicenseManagementModalsProps {
  hostsForFilters: Host[];
  fileUploadModal: UploadModalState;
  onFileHostChange: (value: string) => void;
  onFileChange: (files: any[]) => void;
  onFileUpload: () => Promise<void>;
  onFileCancel: () => void;
  isProcessing: boolean;
  zipUploadModal: ZipUploadModalState;
  onZipFileChange: (files: any[]) => void;
  onZipUpload: () => Promise<void>;
  onZipCancel: () => void;
  zipUploading: boolean;
  packagePreview: LicensePackagePreviewResponse | null;
  onConfirmPackageInstall: () => Promise<void>;
  onCancelPackagePreview: () => void;
  packageInstalling: boolean;
  historyModal: HistoryModalState;
  filteredHistoryRecords: LicenseRecord[];
  historyLoading: boolean;
  getRecordSortOrder: (key?: string) => TwoStateSortOrder | undefined;
  handleRecordSortChange: (columnKey: string | undefined, order: TwoStateSortOrder | undefined) => void;
  closeHistoryModal: () => void;
  handlePreview: (record: LicenseRecord, type: "did" | "ak") => Promise<void>;
  handleDeleteRecord: (recordId: number, hostName: string) => Promise<void>;
  scrollToTop: () => void;
  previewModal: PreviewModalState;
  closePreviewModal: () => void;
  uploadResults: LicenseUploadResult[];
  onUploadResultsClose: () => void;
}

const LicenseManagementModals = ({
  hostsForFilters,
  fileUploadModal,
  onFileHostChange,
  onFileChange,
  onFileUpload,
  onFileCancel,
  isProcessing,
  zipUploadModal,
  onZipFileChange,
  onZipUpload,
  onZipCancel,
  zipUploading,
  packagePreview,
  onConfirmPackageInstall,
  onCancelPackagePreview,
  packageInstalling,
  historyModal,
  filteredHistoryRecords,
  historyLoading,
  getRecordSortOrder,
  handleRecordSortChange,
  closeHistoryModal,
  handlePreview,
  handleDeleteRecord,
  scrollToTop,
  previewModal,
  closePreviewModal,
  uploadResults,
  onUploadResultsClose,
}: LicenseManagementModalsProps) => (
  <Suspense fallback={null}>
    <LicenseFileUploadModal
      visible={fileUploadModal.visible}
      hosts={hostsForFilters}
      selectedHost={fileUploadModal.targetHost}
      onHostChange={onFileHostChange}
      fileList={fileUploadModal.fileList}
      onFileChange={onFileChange}
      onUpload={onFileUpload}
      onCancel={onFileCancel}
      loading={isProcessing}
    />

    <LicenseZipUploadModal
      visible={zipUploadModal.visible}
      fileList={zipUploadModal.fileList}
      onFileChange={onZipFileChange}
      onUpload={onZipUpload}
      onCancel={onZipCancel}
      loading={zipUploading}
    />

    <LicensePackagePreviewModal
      preview={packagePreview}
      onConfirm={onConfirmPackageInstall}
      onCancel={onCancelPackagePreview}
      confirming={packageInstalling}
    />

    <LicenseHistoryModal
      visible={historyModal.visible}
      host={historyModal.host}
      records={filteredHistoryRecords}
      loading={historyLoading}
      getSortOrderForColumn={getRecordSortOrder}
      onSortChange={handleRecordSortChange}
      onClose={closeHistoryModal}
      onPreview={handlePreview}
      onDeleteRecord={handleDeleteRecord}
      scrollToTop={scrollToTop}
    />

    <LicensePreviewModal
      visible={previewModal.visible}
      title={previewModal.title}
      content={previewModal.content}
      loading={previewModal.loading}
      onClose={closePreviewModal}
    />

    <UploadResultsModal results={uploadResults} onClose={onUploadResultsClose} />
  </Suspense>
);

export default LicenseManagementModals;

