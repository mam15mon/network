import client from "./client";

export interface DefaultsConfig {
  timeout: number;
  global_delay_factor: number;
  fast_cli: boolean;
  read_timeout: number;
  num_workers: number;
  license_module_enabled: boolean;
}

export const fetchDefaults = async (): Promise<DefaultsConfig> => {
  const { data } = await client.get<DefaultsConfig>("/defaults");
  return data;
};

export const updateDefaults = async (payload: DefaultsConfig): Promise<DefaultsConfig> => {
  const { data } = await client.put<DefaultsConfig>("/defaults", payload);
  return data;
};
