import client from "./client";

export interface Host {
  id: number;
  name: string;
  hostname: string;
  platform: string;
  username?: string;
  password?: string;
  port?: number;
  site?: string;
  device_type?: string;
  device_model?: string;
  address_pool?: string;
  ppp_auth_mode?: string;
  snmp_version?: string;
  snmp_community?: string;
  snmp_port?: number;
}

export type HostPayload = Omit<Host, "id">;

export interface BatchEditPayload {
  names: string[];
  data: Partial<HostPayload>;
}

export const fetchHosts = async (params?: Record<string, string | undefined>): Promise<Host[]> => {
  const cleanParams: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        cleanParams[key] = value.trim();
      }
    });
  }
  const { data } = await client.get<Host[]>("/hosts", { params: cleanParams });
  return data;
};

export const getHosts = async (): Promise<Host[]> => {
  return fetchHosts();
};

export const createHost = async (payload: HostPayload): Promise<Host> => {
  const { data } = await client.post<Host>("/hosts", payload);
  return data;
};

export const updateHost = async (name: string, payload: Partial<HostPayload>): Promise<Host> => {
  const { data } = await client.put<Host>(`/hosts/${name}`, payload);
  return data;
};

export const deleteHost = async (name: string): Promise<void> => {
  await client.delete(`/hosts/${name}`);
};

export const batchUpsertHosts = async (hosts: HostPayload[]): Promise<{ inserted: number; updated: number }> => {
  const { data } = await client.post<{ inserted: number; updated: number }>("/hosts/batch", { hosts });
  return data;
};

export const batchDeleteHosts = async (names: string[]): Promise<{ deleted: number }> => {
  const { data } = await client.delete<{ deleted: number }>("/hosts/batch", { data: { names } });
  return data;
};

export const batchEditHosts = async (payload: BatchEditPayload): Promise<{ updated: number }> => {
  const { data } = await client.put<{ updated: number }>("/hosts/batch", payload);
  return data;
};

export const importHosts = async (file: File): Promise<{ inserted: number; updated: number; total: number }> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<{ inserted: number; updated: number; total: number }>("/hosts/import", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
};

export const exportHosts = async (): Promise<Blob> => {
  const response = await client.get<Blob>("/hosts/export", { responseType: "blob" });
  return response.data;
};

export interface AddressPoolSyncResult {
  processed: number;
  updated: number;
  unchanged: number;
  missing_hosts: string[];
  no_data: string[];
  no_ppp: string[];
  updated_address_pool: number;
  updated_ppp: number;
}

export const syncAddressPools = async (): Promise<AddressPoolSyncResult> => {
  const { data } = await client.post<AddressPoolSyncResult>("/hosts/sync-address-pools");
  return data;
};
