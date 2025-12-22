import client from "./client";

export type CommandType =
  | "display"
  | "config"
  | "connectivity"
  | "multiline"
  | "config_download";

export interface CommandPayload {
  hosts?: string[];
  commandType: CommandType;
  command?: string;
  commands?: string[];
  useTiming?: boolean;
}

export interface CommandResult {
  host: string;
  logId?: number | null;
  snapshotId?: number | null;
  commandType: CommandType;
  command: string;
  result: string;
  failed: boolean;
  exception?: string | null;
  executedAt: string;
  outputPath?: string | null;
}

export const executeCommand = async (payload: CommandPayload): Promise<CommandResult[]> => {
  const { data } = await client.post<CommandResult[]>("/nornir/commands", payload, {
    // 前端不设超时，完全由后端控制
    timeout: 0,
  });
  return data;
};

export interface CommandHistoryQuery {
  limit?: number;
  host?: string;
  commandType?: CommandType;
  includeConfigDownload?: boolean;
}

export const fetchCommandHistory = async (
  params: CommandHistoryQuery = {}
): Promise<CommandResult[]> => {
  const { data } = await client.get<CommandResult[]>("/nornir/commands/history", {
    params,
    timeout: 0,
  });
  return data;
};

export const deleteCommandHistory = async (logId: number): Promise<void> => {
  await client.delete(`/nornir/commands/history/${logId}`, { timeout: 0 });
};

export interface ConfigSnapshotDetail {
  id: number;
  host: string;
  site?: string | null;
  command: string;
  content: string;
  executedAt: string;
  filePath?: string | null;
}

export const fetchConfigSnapshot = async (snapshotId: number): Promise<ConfigSnapshotDetail> => {
  const { data } = await client.get<ConfigSnapshotDetail>(`/nornir/config-snapshots/${snapshotId}`, {
    timeout: 0,
  });
  return data;
};

export interface ConfigSnapshotSummary {
  id: number;
  host: string;
  site?: string | null;
  command: string;
  executedAt: string;
  filePath?: string | null;
}

export interface ConfigSnapshotQuery {
  limit?: number;
  host?: string;
  site?: string;
}

export const fetchConfigSnapshots = async (
  params: ConfigSnapshotQuery = {}
): Promise<ConfigSnapshotSummary[]> => {
  const { data } = await client.get<ConfigSnapshotSummary[]>("/nornir/config-snapshots", {
    params,
    timeout: 0,
  });
  return data;
};

export const fetchLatestConfigSnapshots = async (
  params: ConfigSnapshotQuery = {}
): Promise<ConfigSnapshotSummary[]> => {
  const { data } = await client.get<ConfigSnapshotSummary[]>("/nornir/config-snapshots/latest", {
    params,
    timeout: 0,
  });
  return data;
};

export const deleteConfigSnapshot = async (snapshotId: number): Promise<void> => {
  await client.delete(`/nornir/config-snapshots/${snapshotId}`, { timeout: 0 });
};

export const deleteConfigSnapshots = async (snapshotIds: number[]): Promise<number> => {
  const { data } = await client.delete(`/nornir/config-snapshots/batch`, {
    data: { ids: snapshotIds },
    timeout: 0,
  });
  return (data?.deleted as number) ?? 0;
};

export const downloadConfigSnapshot = async (snapshotId: number): Promise<Blob> => {
  const response = await client.get(`/nornir/config-snapshots/${snapshotId}/download`, {
    responseType: "blob",
    timeout: 0,
  });
  return response.data;
};
