import { apiClient } from './client';
import type { AuditLogEntry, AuditVerifyResponse } from '../types/api';

export interface ListAuditParams {
  community_id: number;
  resource?: string | null;
  action?: string | null;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  items: AuditLogEntry[];
  total: number;
}

export async function listAuditLog(params: ListAuditParams): Promise<AuditPage> {
  const query: Record<string, string | number> = {
    community_id: params.community_id,
  };
  if (params.resource) query.resource = params.resource;
  if (params.action) query.action = params.action;
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.offset !== undefined) query.offset = params.offset;
  const res = await apiClient.get<AuditLogEntry[]>('/audit/', { params: query });
  const headerTotal =
    res.headers?.['x-total-count'] ?? res.headers?.['X-Total-Count'];
  const total =
    headerTotal !== undefined ? Number(headerTotal) : res.data.length;
  return {
    items: res.data,
    total: Number.isFinite(total) ? total : res.data.length,
  };
}

export async function verifyAuditChain(): Promise<AuditVerifyResponse> {
  const res = await apiClient.get<AuditVerifyResponse>('/audit/verify');
  return res.data;
}

export async function exportAuditLog(
  communityId: number,
  format: 'csv' | 'xlsx',
): Promise<Blob> {
  const res = await apiClient.get('/audit/export', {
    params: { community_id: communityId, format },
    responseType: 'blob',
  });
  return res.data as Blob;
}
