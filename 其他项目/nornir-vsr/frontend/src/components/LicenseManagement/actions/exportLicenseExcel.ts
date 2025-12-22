import dayjs from "dayjs";

import type { LicenseRecord } from "../../../api/license";

interface ExportLicenseExcelOptions {
  records: LicenseRecord[];
  resolveActiveHosts: () => string[];
  filteredHostNames: string[];
  hostSiteMap: Map<string, string | undefined>;
  fetchAkContent: (recordId: number) => Promise<string>;
  chunkSize?: number;
}

interface ExportLicenseExcelResult {
  exportedCount: number;
  missingHosts: string[];
}

interface ParsedAkMetadata {
  licenseSn: string;
  licenseKey: string;
  fileCreationTime: string;
}

const normalize = (value?: string | null) => (value ?? "").trim();

const extractAkField = (content: string, label: string): string => {
  const regex = new RegExp(`^${label}\\s*:\\s*(.+)$`, "mi");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
};

const parseAkMetadata = (content: string): ParsedAkMetadata => ({
  licenseSn: extractAkField(content, "License SN"),
  licenseKey: extractAkField(content, "License key"),
  fileCreationTime: extractAkField(content, "File creation time"),
});

export const exportLicenseExcel = async ({
  records,
  resolveActiveHosts,
  filteredHostNames,
  hostSiteMap,
  fetchAkContent,
  chunkSize = 8,
}: ExportLicenseExcelOptions): Promise<ExportLicenseExcelResult> => {
  const { utils, writeFileXLSX } = await import("xlsx");
  const activeHosts = resolveActiveHosts();
  const hostSet = new Set(activeHosts.length > 0 ? activeHosts : filteredHostNames);
  const recordsToExport = records.filter((record) => {
    if (hostSet.size === 0) {
      return true;
    }
    return hostSet.has(record.host_name);
  });

  if (recordsToExport.length === 0) {
    return { exportedCount: 0, missingHosts: [] };
  }

  const metadataById = new Map<number, ParsedAkMetadata>();
  const missingHosts: string[] = [];

  recordsToExport.forEach((record) => {
    metadataById.set(record.id, {
      licenseSn: normalize(record.license_sn),
      licenseKey: normalize(record.license_key),
      fileCreationTime: normalize(record.file_creation_time),
    });
  });

  const needsFetch = recordsToExport.filter(
    (record) =>
      record.ak_filename &&
      (!normalize(record.license_sn) || !normalize(record.license_key) || !normalize(record.file_creation_time)),
  );

  if (needsFetch.length > 0) {
    for (let index = 0; index < needsFetch.length; index += chunkSize) {
      const chunk = needsFetch.slice(index, index + chunkSize);
      const results = await Promise.all(
        chunk.map(async (record) => {
          try {
            const content = await fetchAkContent(record.id);
            return { record, metadata: parseAkMetadata(content) };
          } catch (_error) {
            return { record, metadata: null };
          }
        }),
      );

      results.forEach(({ record, metadata }) => {
        if (!metadata) {
          missingHosts.push(record.host_name);
          return;
        }
        metadataById.set(record.id, {
          licenseSn: normalize(metadata.licenseSn),
          licenseKey: normalize(metadata.licenseKey),
          fileCreationTime: normalize(metadata.fileCreationTime),
        });
      });
    }
  }

  const rows = recordsToExport.map((record) => {
    const site = hostSiteMap.get(record.host_name) ?? "";
    const metadata =
      metadataById.get(record.id) ?? ({ licenseSn: "", licenseKey: "", fileCreationTime: "" } as ParsedAkMetadata);

    return [
      record.host_name,
      site || "",
      record.did_filename ?? "",
      record.ak_filename ?? "",
      metadata.licenseSn,
      metadata.licenseKey,
      metadata.fileCreationTime,
    ];
  });

  const header = [
    "主机名",
    "站点",
    "DID 文件名",
    "AK 文件名",
    "License SN",
    "License key",
    "File creation time",
  ];
  const worksheet = utils.aoa_to_sheet([header, ...rows]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "许可证记录");

  const timestamp = dayjs().format("YYYYMMDD_HHmmss");
  writeFileXLSX(workbook, `license_records_${timestamp}.xlsx`);

  return {
    exportedCount: rows.length,
    missingHosts: Array.from(new Set(missingHosts)),
  };
};
