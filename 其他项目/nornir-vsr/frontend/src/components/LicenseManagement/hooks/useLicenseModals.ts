import { useCallback, useState } from "react";

import type {
  HistoryModalState,
  PreviewModalState,
  UploadModalState,
  ZipUploadModalState,
} from "../types";
import type { LicensePackagePreviewResponse, LicenseUploadResult } from "../../../api/license";

interface UseLicenseModalsResult {
  historyModal: HistoryModalState;
  setHistoryModal: React.Dispatch<React.SetStateAction<HistoryModalState>>;
  previewModal: PreviewModalState;
  setPreviewModal: React.Dispatch<React.SetStateAction<PreviewModalState>>;
  fileUploadModal: UploadModalState;
  setFileUploadModal: React.Dispatch<React.SetStateAction<UploadModalState>>;
  zipUploadModal: ZipUploadModalState;
  setZipUploadModal: React.Dispatch<React.SetStateAction<ZipUploadModalState>>;
  packagePreview: LicensePackagePreviewResponse | null;
  setPackagePreview: React.Dispatch<React.SetStateAction<LicensePackagePreviewResponse | null>>;
  uploadResults: LicenseUploadResult[];
  setUploadResults: React.Dispatch<React.SetStateAction<LicenseUploadResult[]>>;
  openHistoryModal: (host: string | null) => void;
  closeHistoryModal: () => void;
  closePreviewModal: () => void;
  resetUploadModals: () => void;
}

export const useLicenseModals = (): UseLicenseModalsResult => {
  const [historyModal, setHistoryModal] = useState<HistoryModalState>({ visible: false, host: null });
  const [previewModal, setPreviewModal] = useState<PreviewModalState>({
    visible: false,
    title: "文件预览",
    content: "",
    loading: false,
  });
  const [fileUploadModal, setFileUploadModal] = useState<UploadModalState>({
    visible: false,
    targetHost: "",
    fileList: [],
  });
  const [zipUploadModal, setZipUploadModal] = useState<ZipUploadModalState>({
    visible: false,
    fileList: [],
  });
  const [packagePreview, setPackagePreview] = useState<LicensePackagePreviewResponse | null>(null);
  const [uploadResults, setUploadResults] = useState<LicenseUploadResult[]>([]);

  const openHistoryModal = useCallback((host: string | null) => {
    setHistoryModal({ visible: true, host });
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryModal({ visible: false, host: null });
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewModal((prev) => ({ ...prev, visible: false }));
  }, []);

  const resetUploadModals = useCallback(() => {
    setFileUploadModal({ visible: false, targetHost: "", fileList: [] });
    setZipUploadModal({ visible: false, fileList: [] });
  }, []);

  return {
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
    resetUploadModals,
  };
};

