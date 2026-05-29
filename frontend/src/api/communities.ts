import { apiClient } from './client';
import type {
  Community,
  CommunityCreate,
  CommunityUpdate,
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
