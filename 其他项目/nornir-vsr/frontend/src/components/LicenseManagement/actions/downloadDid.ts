import type { DidCollectionResult, LicenseCheckRequest } from "../../../api/license";

interface DownloadDidOptions {
  targetHosts: string[];
  request: LicenseCheckRequest;
  collectDid: (request: LicenseCheckRequest) => Promise<DidCollectionResult[]>;
  exportDid: (request: LicenseCheckRequest) => Promise<Blob>;
}

interface DownloadDidResult {
  collection: DidCollectionResult[];
  hostCount: number;
}

const triggerDownload = (blob: Blob, hostCount: number) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  link.download = `vsr_did_${hostCount}_${timestamp}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadDidArchive = async ({
  targetHosts,
  request,
  collectDid,
  exportDid,
}: DownloadDidOptions): Promise<DownloadDidResult> => {
  const results = await collectDid(request);

  if (targetHosts.length === 0) {
    return { collection: results, hostCount: targetHosts.length };
  }

  const exportRequest = targetHosts.length > 0 ? { ...request, hosts: targetHosts } : request;
  const blob = await exportDid(exportRequest);
  triggerDownload(blob, targetHosts.length);

  return { collection: results, hostCount: targetHosts.length };
};
