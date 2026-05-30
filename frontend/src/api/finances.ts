import { apiClient } from './client';
import type {
  BudgetItem,
  BudgetItemCreate,
  Charge,
  ChargeCreate,
  ChargeType,
  ChargeTypeCreate,
  Payment,
  PaymentAllocation,
  PaymentCreate,
  UnitBalanceResponse,
  UnitPenaltyResponse,
} from '../types/api';

// --- Charge types ---

export async function listChargeTypes(communityId: number): Promise<ChargeType[]> {
  const res = await apiClient.get<ChargeType[]>(
    `/communities/${communityId}/charge-types`,
  );
  return res.data;
}

export async function createChargeType(
  communityId: number,
  payload: ChargeTypeCreate,
): Promise<ChargeType> {
  const res = await apiClient.post<ChargeType>(
    `/communities/${communityId}/charge-types`,
    payload,
  );
  return res.data;
}

// --- Charges ---

export async function listCharges(
  communityId: number,
  period?: string | null,
): Promise<Charge[]> {
  const res = await apiClient.get<Charge[]>(
    `/communities/${communityId}/charges`,
    { params: period ? { period } : {} },
  );
  return res.data;
}

export async function createCharges(
  communityId: number,
  payload: ChargeCreate,
): Promise<Charge[]> {
  const res = await apiClient.post<Charge[]>(
    `/communities/${communityId}/charges`,
    payload,
  );
  return res.data;
}

// --- Payments ---

export async function listPayments(
  communityId: number,
  unitId: number,
): Promise<Payment[]> {
  const res = await apiClient.get<Payment[]>(
    `/communities/${communityId}/payments`,
    { params: { unit_id: unitId } },
  );
  return res.data;
}

export async function createPayment(
  communityId: number,
  payload: PaymentCreate,
): Promise<Payment> {
  const res = await apiClient.post<Payment>(
    `/communities/${communityId}/payments`,
    payload,
  );
  return res.data;
}

export async function listPaymentAllocations(
  communityId: number,
  paymentId: number,
): Promise<PaymentAllocation[]> {
  const res = await apiClient.get<PaymentAllocation[]>(
    `/communities/${communityId}/payments/${paymentId}/allocations`,
  );
  return res.data;
}

// --- Balance / penalties ---

export async function getBalance(
  communityId: number,
): Promise<UnitBalanceResponse[]> {
  const res = await apiClient.get<UnitBalanceResponse[]>(
    `/communities/${communityId}/balance`,
  );
  return res.data;
}

export async function exportBalance(
  communityId: number,
  format: 'xlsx' | 'pdf',
): Promise<Blob> {
  const res = await apiClient.get(
    `/communities/${communityId}/balance/export`,
    { params: { format }, responseType: 'blob' },
  );
  return res.data as Blob;
}

export async function calculatePenalties(
  communityId: number,
  rate?: number | null,
  asOf?: string | null,
): Promise<UnitPenaltyResponse[]> {
  const params: Record<string, string | number> = {};
  if (rate !== null && rate !== undefined) params.rate = rate;
  if (asOf) params.as_of = asOf;
  const res = await apiClient.get<UnitPenaltyResponse[]>(
    `/communities/${communityId}/penalties`,
    { params },
  );
  return res.data;
}

// --- Budget ---

export async function listBudget(
  communityId: number,
  period?: string | null,
): Promise<BudgetItem[]> {
  const res = await apiClient.get<BudgetItem[]>(
    `/communities/${communityId}/budget`,
    { params: period ? { period } : {} },
  );
  return res.data;
}

export async function createBudgetItem(
  communityId: number,
  payload: BudgetItemCreate,
): Promise<BudgetItem> {
  const res = await apiClient.post<BudgetItem>(
    `/communities/${communityId}/budget`,
    payload,
  );
  return res.data;
}
