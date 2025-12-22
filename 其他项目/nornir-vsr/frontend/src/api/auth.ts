import client from "./client";

export interface AuthUser {
  id: number;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  totp_enabled: boolean;
  totp_required: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginPayload {
  username: string;
  password: string;
  otp?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
  require_totp: boolean;
  expires_in: number;
}

export const login = async (payload: LoginPayload): Promise<TokenResponse> => {
  const { data } = await client.post<TokenResponse>("/auth/login", payload);
  return data;
};

export const refreshToken = async (): Promise<TokenResponse> => {
  const { data } = await client.post<TokenResponse>("/auth/refresh");
  return data;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const { data } = await client.get<AuthUser>("/auth/me");
  return data;
};

export const changePassword = async (payload: { current_password: string; new_password: string }): Promise<void> => {
  await client.post("/auth/change-password", payload);
};

export interface TotpSetupResponse {
  secret: string;
  provisioning_uri: string;
}

export const setupTotp = async (): Promise<TotpSetupResponse> => {
  const { data } = await client.post<TotpSetupResponse>("/auth/totp/setup");
  return data;
};

export const verifyTotp = async (payload: { code: string }): Promise<void> => {
  await client.post("/auth/totp/verify", payload);
};

export const disableTotp = async (payload: { password: string }): Promise<void> => {
  await client.post("/auth/totp/disable", payload);
};
