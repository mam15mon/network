import { ReactNode } from "react";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";

import type { LicenseOverview, LicenseRecord } from "../../api/license";
import { naturalCompare } from "../../utils/sort";

const parseDays = (value: unknown): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const text = String(value).trim();
  if (!text) {
    return undefined;
  }
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : undefined;
};

const getRemainingDays = (license: any): number | undefined => {
  const candidates = [license?.time_left_days, license?.trial_time_left_days];
  let result: number | undefined;
  candidates.forEach((candidate) => {
    const parsed = parseDays(candidate);
    if (parsed === undefined) {
      return;
    }
    result = result === undefined ? parsed : Math.min(result, parsed);
  });
  return result;
};

export const getLicenseStatusOrder = (license: any) => {
  if (!license) {
    return { group: -1, days: Number.NEGATIVE_INFINITY };
  }

  const remaining = getRemainingDays(license);
  const state = String(license.current_state || "").toLowerCase();
  const type = String(license.license_type || "").toLowerCase();
  const isPermanentType = type.includes("permanent") || type.includes("永久");

  if (isPermanentType) {
    return { group: 3, days: Number.POSITIVE_INFINITY };
  }

  if (state === "expired") {
    if (remaining === undefined) {
      return { group: 0, days: Number.NEGATIVE_INFINITY };
    }
    return { group: 1, days: remaining };
  }

  return { group: 2, days: remaining ?? Number.POSITIVE_INFINITY };
};

export const getHostLicenseOrder = (record: LicenseOverview) => {
  if (!record.licenses || record.licenses.length === 0) {
    return { group: 0, days: Number.NEGATIVE_INFINITY };
  }

  let hasPermanent = false;
  let candidate: { group: number; days: number } | null = null;

  record.licenses.forEach((license) => {
    const current = getLicenseStatusOrder(license);
    if (current.group === 3) {
      hasPermanent = true;
    }
    if (!candidate) {
      candidate = current;
      return;
    }
    if (current.group < candidate.group || (current.group === candidate.group && current.days < candidate.days)) {
      candidate = current;
    }
  });

  if (hasPermanent) {
    return { group: 3, days: Number.POSITIVE_INFINITY };
  }

  return candidate ?? { group: 0, days: Number.NEGATIVE_INFINITY };
};

export const hostHasPermanentLicense = (record: LicenseOverview) => getHostLicenseOrder(record).group === 3;

export const licenseComparators: Record<string, (a: LicenseOverview, b: LicenseOverview) => number> = {
  host_name: (a, b) => naturalCompare(a.host_name ?? "", b.host_name ?? ""),
  site: (a, b) => naturalCompare(a.site ?? "", b.site ?? ""),
  updated_at: (a, b) => naturalCompare(a.updated_at ?? "", b.updated_at ?? ""),
  licenses: (a, b) => {
    const orderA = getHostLicenseOrder(a);
    const orderB = getHostLicenseOrder(b);
    if (orderA.group !== orderB.group) {
      return orderA.group - orderB.group;
    }
    if (orderA.days !== orderB.days) {
      return orderA.days - orderB.days;
    }
    return naturalCompare(a.host_name ?? "", b.host_name ?? "");
  },
};

export const licenseRecordComparators: Record<string, (a: LicenseRecord, b: LicenseRecord) => number> = {
  host_name: (a, b) => naturalCompare(a.host_name ?? "", b.host_name ?? ""),
  status: (a, b) => naturalCompare(a.status ?? "", b.status ?? ""),
  license_sn: (a, b) => naturalCompare(a.license_sn ?? "", b.license_sn ?? ""),
  license_key: (a, b) => naturalCompare(a.license_key ?? "", b.license_key ?? ""),
  file_creation_time: (a, b) => naturalCompare(a.file_creation_time ?? "", b.file_creation_time ?? ""),
  updated_at: (a, b) => naturalCompare(a.updated_at ?? "", b.updated_at ?? ""),
};

export const getLicenseStatusColor = (license: any): "success" | "warning" | "error" | "info" | "neutral" => {
  const state = String(license?.current_state || "").toLowerCase();
  const type = String(license?.license_type || "").toLowerCase();
  const isPermanent = type.includes("permanent") || type.includes("永久");
  const daysLeft = getRemainingDays(license);

  if (isPermanent) {
    return state === "expired" ? "error" : "success";
  }

  if (state === "expired") {
    return "error";
  }

  if (state === "in use") {
    if (daysLeft === undefined) {
      return "info";
    }
    if (daysLeft <= 0) {
      return "error";
    }
    if (daysLeft <= 7) {
      return "error";
    }
    if (daysLeft <= 30) {
      return "warning";
    }
    return "info";
  }

  return "neutral";
};

export const getLicenseStatusText = (license: any) => {
  if (license.current_state === "In use") {
    if (license.license_type === "Permanent") {
      return "永久授权";
    }
    const daysLeft = license.time_left_days || license.trial_time_left_days;
    return daysLeft ? `剩余 ${daysLeft} 天` : "使用中";
  }
  if (license.current_state === "Expired") {
    return "已过期";
  }
  return "未知";
};

export const getLicenseStatusIcon = (license: any): ReactNode => {
  if (license.current_state === "In use") {
    if (license.license_type === "Permanent") {
      return <CheckCircleOutlined />;
    }
    return <ClockCircleOutlined />;
  }
  if (license.current_state === "Expired") {
    return <ExclamationCircleOutlined />;
  }
  return <ExclamationCircleOutlined />;
};

export const formatRecordDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export const sortLicenses = (licenses: any[]) => {
  return [...licenses].sort((a, b) => {
    const orderA = getLicenseStatusOrder(a);
    const orderB = getLicenseStatusOrder(b);
    if (orderA.group !== orderB.group) {
      return orderA.group - orderB.group;
    }
    if (orderA.days !== orderB.days) {
      return orderA.days - orderB.days;
    }
    return naturalCompare(a.file_name ?? "", b.file_name ?? "");
  });
};
