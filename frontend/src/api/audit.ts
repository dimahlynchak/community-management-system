import { apiClient } from './client';
import type { AuditLogEntry, AuditVerifyResponse } from '../types/api';

export interface ListAuditParams {
  community_id: number;
  resource?: string | null;
  action?: string | null;
  limit?: number;
}

export async function listAuditLog(
  params: ListAuditParams,
): Promise<AuditLogEntry[]> {
  const query: Record<string, string | number> = {
    community_id: params.community_id,
  };
  if (params.resource) query.resource = params.resource;
  if (params.action) query.action = params.action;
  if (params.limit !== undefined) query.limit = params.limit;
  const res = await apiClient.get<AuditLogEntry[]>('/audit/', { params: query });
  return res.data;
}

export async function verifyAuditChain(): Promise<AuditVerifyResponse> {
  const res = await apiClient.get<AuditVerifyResponse>('/audit/verify');
  return res.data;
}
