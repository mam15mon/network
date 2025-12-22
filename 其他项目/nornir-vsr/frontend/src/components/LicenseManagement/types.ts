import type { LicenseUploadResult, LicenseOverview, LicenseRecord } from "../../api/license";

export type LicenseTypeFilter = "all" | "permanent" | "non-permanent" | "manual";

export interface HistoryModalState {
  visible: boolean;
  host: string | null;
}

export interface PreviewModalState {
  visible: boolean;
  title: string;
  content: string;
  loading: boolean;
}

export interface UploadModalState {
  visible: boolean;
  targetHost: string;
  fileList: any[]; // Antd UploadFile, keep as any for compatibility
}

export interface ZipUploadModalState {
  visible: boolean;
  fileList: any[];
}

export interface LicenseDataContext {
  overview: LicenseOverview[];
  records: LicenseRecord[];
}

export interface UploadResultsModalProps {
  results: LicenseUploadResult[];
  onClose: () => void;
}
