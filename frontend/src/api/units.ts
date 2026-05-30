import { apiClient } from './client';
import type { Unit, UnitCreate, UnitUpdate } from '../types/api';

export async function listUnits(
  communityId: number,
  options?: { includeInactive?: boolean },
): Promise<Unit[]> {
  const params = options?.includeInactive ? { include_inactive: true } : {};
  const res = await apiClient.get<Unit[]>(
    `/communities/${communityId}/units`,
    { params },
  );
  return res.data;
}

export async function getUnit(communityId: number, unitId: number): Promise<Unit> {
  const res = await apiClient.get<Unit>(
    `/communities/${communityId}/units/${unitId}`,
  );
  return res.data;
}

export async function createUnit(
  communityId: number,
  payload: UnitCreate,
): Promise<Unit> {
  const res = await apiClient.post<Unit>(
    `/communities/${communityId}/units`,
    payload,
  );
  return res.data;
}

export async function updateUnit(
  communityId: number,
  unitId: number,
  payload: UnitUpdate,
): Promise<Unit> {
  const res = await apiClient.patch<Unit>(
    `/communities/${communityId}/units/${unitId}`,
    payload,
  );
  return res.data;
}

export async function deleteUnit(communityId: number, unitId: number): Promise<void> {
  await apiClient.delete(`/communities/${communityId}/units/${unitId}`);
}
