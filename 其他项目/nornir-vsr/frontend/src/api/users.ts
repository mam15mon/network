import client from "./client";
import type { AuthUser } from "./auth";

export interface UserCreatePayload {
  username: string;
  password: string;
  is_superuser?: boolean;
  is_active?: boolean;
  totp_required?: boolean;
}

export interface UserUpdatePayload {
  password?: string;
  is_superuser?: boolean;
  is_active?: boolean;
  totp_required?: boolean;
}

export const listUsers = async (): Promise<AuthUser[]> => {
  const { data } = await client.get<AuthUser[]>("/users");
  return data;
};

export const createUser = async (payload: UserCreatePayload): Promise<AuthUser> => {
  const { data } = await client.post<AuthUser>("/users", payload);
  return data;
};

export const updateUser = async (userId: number, payload: UserUpdatePayload): Promise<AuthUser> => {
  const { data } = await client.put<AuthUser>(`/users/${userId}`, payload);
  return data;
};

export const deleteUser = async (userId: number): Promise<void> => {
  await client.delete(`/users/${userId}`);
};

export const resetUserPassword = async (userId: number, newPassword: string): Promise<void> => {
  await client.post(`/users/${userId}/reset-password`, { new_password: newPassword });
};

export const resetUserTotp = async (userId: number): Promise<void> => {
  await client.post(`/users/${userId}/reset-totp`, { confirm: true });
};
