import { apiClient } from './client';
import type {
  CreateMemberWithUserResponse,
  MemberLookupResponse,
  PasswordResetResponse,
  Role,
  UserRoleResponse,
} from '../types/api';
import type { RoleName } from '../types/api';

export async function listRoles(): Promise<Role[]> {
  const res = await apiClient.get<Role[]>('/roles');
  return res.data;
}

export async function listMembers(communityId: number): Promise<UserRoleResponse[]> {
  const res = await apiClient.get<UserRoleResponse[]>(
    `/communities/${communityId}/members`,
  );
  return res.data;
}

export async function assignRole(
  communityId: number,
  payload: { user_id: number; role_name: RoleName; unit_id?: number | null },
): Promise<UserRoleResponse> {
  const res = await apiClient.post<UserRoleResponse>(
    `/communities/${communityId}/members`,
    payload,
  );
  return res.data;
}

export async function removeMember(communityId: number, userId: number): Promise<void> {
  await apiClient.delete(`/communities/${communityId}/members/${userId}`);
}

export async function lookupMember(
  communityId: number,
  email: string,
): Promise<MemberLookupResponse> {
  const res = await apiClient.get<MemberLookupResponse>(
    `/communities/${communityId}/members/lookup`,
    { params: { email } },
  );
  return res.data;
}

export async function createMemberWithUser(
  communityId: number,
  payload: {
    email: string;
    full_name: string;
    phone?: string | null;
    role_name: RoleName;
    unit_id?: number | null;
  },
): Promise<CreateMemberWithUserResponse> {
  const res = await apiClient.post<CreateMemberWithUserResponse>(
    `/communities/${communityId}/members/create-with-user`,
    payload,
  );
  return res.data;
}

export async function resetMemberPassword(
  communityId: number,
  userId: number,
): Promise<PasswordResetResponse> {
  const res = await apiClient.post<PasswordResetResponse>(
    `/communities/${communityId}/members/${userId}/reset-password`,
  );
  return res.data;
}
