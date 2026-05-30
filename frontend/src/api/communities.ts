import { apiClient } from './client';
import type {
  Community,
  CommunityCreate,
  CommunityUpdate,
  TransferFounderRequest,
  UserRoleResponse,
} from '../types/api';

export async function listCommunities(): Promise<Community[]> {
  const res = await apiClient.get<Community[]>('/communities/');
  return res.data;
}

export async function getCommunity(id: number): Promise<Community> {
  const res = await apiClient.get<Community>(`/communities/${id}`);
  return res.data;
}

export async function createCommunity(payload: CommunityCreate): Promise<Community> {
  const res = await apiClient.post<Community>('/communities/', payload);
  return res.data;
}

export async function updateCommunity(
  id: number,
  payload: CommunityUpdate,
): Promise<Community> {
  const res = await apiClient.patch<Community>(`/communities/${id}`, payload);
  return res.data;
}

export async function deleteCommunity(id: number): Promise<void> {
  await apiClient.delete(`/communities/${id}`);
}

export async function listMembers(communityId: number): Promise<UserRoleResponse[]> {
  const res = await apiClient.get<UserRoleResponse[]>(
    `/communities/${communityId}/members`,
  );
  return res.data;
}

/** Власне membership поточного користувача — без доступу до чужих даних.
 *  Використовується сторінками лише для визначення своєї ролі/юніта
 *  (резидент не отримує списку всіх членів). 404 → не член спільноти. */
export async function getMyMembership(
  communityId: number,
): Promise<UserRoleResponse | null> {
  try {
    const res = await apiClient.get<UserRoleResponse>(
      `/communities/${communityId}/me/membership`,
    );
    return res.data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}

export async function transferFounder(
  communityId: number,
  payload: TransferFounderRequest,
): Promise<Community> {
  const res = await apiClient.post<Community>(
    `/communities/${communityId}/transfer-founder`,
    payload,
  );
  return res.data;
}
