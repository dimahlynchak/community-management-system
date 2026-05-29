import { apiClient } from './client';
import type { TokenResponse, User, UserCreate } from '../types/api';

export interface UserUpdate {
  full_name?: string;
  phone?: string | null;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set('username', email);
  body.set('password', password);
  const res = await apiClient.post<TokenResponse>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

export async function register(payload: UserCreate): Promise<User> {
  const res = await apiClient.post<User>('/auth/register', payload);
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me');
  return res.data;
}

export async function updateMe(payload: UserUpdate): Promise<User> {
  const res = await apiClient.patch<User>('/auth/me', payload);
  return res.data;
}

export async function changePassword(payload: PasswordChangeRequest): Promise<void> {
  await apiClient.post('/auth/change-password', payload);
}
