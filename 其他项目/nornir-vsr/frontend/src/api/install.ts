import client from "./client";

export interface InstallStatus {
  install_mode: boolean;
  database_configured: boolean;
}

export interface DatabaseConfigPayload {
  connection_url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl_mode?: string;
}

export interface InstallActionResponse {
  success: boolean;
  message: string;
}

export const getInstallStatus = async (): Promise<InstallStatus> => {
  const { data } = await client.get<InstallStatus>("/install/status");
  return data;
};

export const testDatabaseConnection = async (payload: DatabaseConfigPayload): Promise<InstallActionResponse> => {
  const { data } = await client.post<InstallActionResponse>("/install/database/test", payload);
  return data;
};

export const applyDatabaseConfiguration = async (payload: DatabaseConfigPayload): Promise<InstallActionResponse> => {
  const { data } = await client.post<InstallActionResponse>("/install/database/apply", payload);
  return data;
};
