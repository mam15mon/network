import client from "./client";

const LONG_LICENSE_OPERATION_TIMEOUT = 180000; // 涉及设备交互的操作可能耗时，延长至3分钟以容纳批量请求
// 上传/解析体积较大的 ZIP 包、批量安装可能超过 60s，这里单独拉长超时
const LONG_LICENSE_UPLOAD_TIMEOUT = 300000; // 5 分钟

export interface LicenseInfo {
  file_name: string;
  license_type: string;
  current_state: string;
  time_left_days?: number;
  trial_time_left_days?: number;
}

export interface HostLicenseInfo {
  host_name: string;
  site?: string | null;
  licenses: LicenseInfo[];
  updated_at?: string | null;
}

export interface LicenseSnapshot extends HostLicenseInfo {
  snapshot_updated_at?: string | null;
}

export interface LicenseSnapshotRefreshSummary {
  requested_hosts: string[];
  processed: number;
  success: number;
  failed: string[];
}

export interface LicenseSnapshotRefreshResponse {
  snapshots: LicenseSnapshot[];
  summary: LicenseSnapshotRefreshSummary;
}

export interface LicenseOverview extends HostLicenseInfo {
  snapshot_updated_at?: string | null;
  latest_record?: LicenseRecord | null;
}

export interface LicenseUploadResult {
  host_name: string;
  upload_status: string;
  install_status: string;
  trial_days?: string;
}

export interface LicenseFileUploadResponse {
  message: string;
  result: LicenseUploadResult;
  file_name: string;
}

export interface LicensePackagePlanItemPreview {
  host_name: string;
  hostname?: string | null;
  ak_filename: string;
  did_filename?: string | null;
  status: "ready" | "error";
  message?: string | null;
}

export interface LicensePackagePreviewResponse {
  plan_id: string;
  items: LicensePackagePlanItemPreview[];
}

export interface LicensePackageInstallRequest {
  plan_id: string;
  hosts?: string[];
}

export interface DidCollectionResult {
  host_name: string;
  status: string;
  did_filename?: string;
  message?: string;
}

export interface LicenseRecord {
  id: number;
  host_name: string;
  activation_info?: string | null;
  custom_identifier: string;
  did_filename?: string | null;
  ak_filename?: string | null;
  status?: string | null;
  message?: string | null;
  updated_at?: string | null;
  license_sn?: string | null;
  license_key?: string | null;
  file_creation_time?: string | null;
}

export interface LicenseCheckRequest {
  hosts?: string[];
  site?: string;
}

export interface EnableSFTPRequest {
  hosts?: string[];
  site?: string;
}

export interface SFTPResult {
  host: string;
  status: string;
  message: string;
}

// 启用SFTP服务
export const enableSFTP = async (request: EnableSFTPRequest): Promise<SFTPResult[]> => {
  const response = await client.post("/license/enable-sftp", request);
  return response.data;
};

// 检查许可证状态
export const checkLicenses = async (request: LicenseCheckRequest): Promise<HostLicenseInfo[]> => {
  const response = await client.post("/license/status", request);
  return response.data;
};

export const fetchLicenseOverview = async (request: LicenseCheckRequest): Promise<LicenseOverview[]> => {
  const response = await client.post("/license/overview", request);
  return response.data;
};

export const refreshLicenseStatus = async (
  request: LicenseCheckRequest
): Promise<LicenseSnapshotRefreshResponse> => {
  const response = await client.post<LicenseSnapshotRefreshResponse>("/license/status/refresh", request, {
    timeout: LONG_LICENSE_OPERATION_TIMEOUT,
  });
  return response.data;
};

// 上传许可证文件到服务器
export const uploadLicenseFile = async (
  hostName: string,
  file: File
): Promise<LicenseFileUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post(`/license/upload-file/${hostName}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: LONG_LICENSE_OPERATION_TIMEOUT,
  });
  return response.data;
};

// 收集 DID 文件
export const collectDid = async (
  request: LicenseCheckRequest
): Promise<DidCollectionResult[]> => {
  const response = await client.post("/license/collect-did", request, {
    timeout: LONG_LICENSE_OPERATION_TIMEOUT,
  });
  return response.data;
};

// 导出 DID ZIP
export const exportDid = async (request: LicenseCheckRequest): Promise<Blob> => {
  const params: Record<string, string | string[]> = {};
  if (request.hosts && request.hosts.length > 0) {
    params.hosts = request.hosts;
  } else if (request.site) {
    params.site = request.site;
  }

  const response = await client.get("/license/did/export", {
    params,
    responseType: "blob",
    timeout: LONG_LICENSE_OPERATION_TIMEOUT,
    paramsSerializer: parameters => {
      const searchParams = new URLSearchParams();
      Object.entries(parameters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, item));
        } else if (value) {
          searchParams.append(key, value);
        }
      });
      return searchParams.toString();
    },
  });
  return response.data;
};

// 获取许可证记录
export const getLicenseRecords = async (): Promise<LicenseRecord[]> => {
  const response = await client.get("/license/records");
  return response.data;
};

export const getLicenseRecordDid = async (recordId: number): Promise<string> => {
  const response = await client.get(`/license/records/${recordId}/did`, {
    responseType: "text",
  });
  return response.data;
};

export const getLicenseRecordAk = async (recordId: number): Promise<string> => {
  const response = await client.get(`/license/records/${recordId}/ak`, {
    responseType: "text",
  });
  return response.data;
};

// 删除许可证记录
export const deleteLicenseRecord = async (recordId: number): Promise<void> => {
  await client.delete(`/license/records/${recordId}`);
};

// 删除许可证状态快照
export const deleteLicenseSnapshot = async (hostName: string): Promise<void> => {
  await client.delete(`/license/status/${hostName}`);
};

// 刷新许可证记录（同时触发设备同步）
export const refreshLicenseRecords = async (
  request: LicenseCheckRequest
): Promise<LicenseRecord[]> => {
  const response = await client.post("/license/records/refresh", request, {
    timeout: LONG_LICENSE_OPERATION_TIMEOUT,
  });
  return response.data;
};

// 上传许可证包
export const uploadLicensePackage = async (file: File): Promise<LicenseUploadResult[]> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post("/license/upload-package", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: LONG_LICENSE_UPLOAD_TIMEOUT,
  });

  return response.data;
};

export const uploadLicensePackagePreview = async (file: File): Promise<LicensePackagePreviewResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post<LicensePackagePreviewResponse>("/license/upload-package/preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: LONG_LICENSE_UPLOAD_TIMEOUT,
  });

  return response.data;
};

export const installLicensePackage = async (
  payload: LicensePackageInstallRequest
): Promise<LicenseUploadResult[]> => {
  const response = await client.post<LicenseUploadResult[]>("/license/upload-package/install", payload, {
    timeout: LONG_LICENSE_UPLOAD_TIMEOUT,
  });
  return response.data;
};
