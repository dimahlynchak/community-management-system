export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface Community {
  id: number;
  name: string;
  address: string;
  edrpou: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityCreate {
  name: string;
  address: string;
  edrpou?: string | null;
}

export interface CommunityUpdate {
  name?: string;
  address?: string;
  edrpou?: string | null;
}

export type UnitType = string;

export interface Unit {
  id: number;
  community_id: number;
  number: string;
  type: UnitType;
  area: string;
  floor: number | null;
  created_at: string;
  updated_at: string;
}

export interface UnitCreate {
  number: string;
  type: UnitType;
  area: string | number;
  floor?: number | null;
}

export interface UnitUpdate {
  number?: string;
  type?: UnitType;
  area?: string | number;
  floor?: number | null;
}

export type RoleName = 'head' | 'accountant' | 'technician' | 'resident';

export interface Role {
  id: number;
  name: RoleName;
  display_name: string;
}

export interface UserRoleResponse {
  id: number;
  user_id: number;
  community_id: number;
  role_id: number;
  unit_id: number | null;
  assigned_at: string;
  role: Role;
}

export interface AssignRoleRequest {
  user_id: number;
  role_name: RoleName;
  unit_id?: number | null;
}

export type CalculationMethod = 'per_sqm' | 'fixed' | 'share';

export interface ChargeType {
  id: number;
  community_id: number;
  name: string;
  calculation_method: CalculationMethod;
  rate: string;
  is_active: boolean;
  created_at: string;
}

export interface ChargeTypeCreate {
  name: string;
  calculation_method: CalculationMethod;
  rate: string | number;
}

export interface Charge {
  id: number;
  unit_id: number;
  charge_type_id: number;
  period: string;
  amount: string;
  created_by: number;
  created_at: string;
}

export interface ChargeCreate {
  charge_type_id: number;
  period: string;
}

export interface Payment {
  id: number;
  unit_id: number;
  amount: string;
  payment_date: string;
  description: string | null;
  created_by: number;
  created_at: string;
}

export interface PaymentCreate {
  unit_id: number;
  amount: string | number;
  payment_date: string;
  description?: string | null;
}

export interface PaymentAllocation {
  id: number;
  payment_id: number;
  charge_id: number;
  amount: string;
}

export interface UnitBalanceResponse {
  unit_id: number;
  unit_number: string;
  unit_type: string;
  total_charged: string;
  total_paid: string;
  balance: string;
}

export interface UnitPenaltyResponse {
  unit_id: number;
  unit_number: string;
  charge_id: number;
  period: string;
  debt: string;
  overdue_days: number;
  rate: string;
  penalty: string;
}

export interface BudgetItem {
  id: number;
  community_id: number;
  period: string;
  category: string;
  planned_amount: string | null;
  actual_amount: string | null;
  description: string | null;
  document_ref: string | null;
  created_by: number;
  created_at: string;
}

export interface BudgetItemCreate {
  period: string;
  category: string;
  planned_amount?: string | number | null;
  actual_amount?: string | number | null;
  description?: string | null;
  document_ref?: string | null;
}

export interface Announcement {
  id: number;
  community_id: number;
  title: string;
  body: string;
  created_by: number;
  created_at: string;
}

export interface AnnouncementCreate {
  title: string;
  body: string;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'ACCESS_DENIED'
  | 'ASSIGN_ROLE'
  | 'REMOVE_ROLE';

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  user_id: number | null;
  community_id: number | null;
  action: AuditAction;
  resource: string;
  resource_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  previous_hash: string;
  hash: string;
}

export interface AuditVerifyResponse {
  valid: boolean;
  total: number;
  broken_at_id?: number | null;
}

export interface ApiError {
  detail: string | Array<{ msg: string; type?: string; loc?: (string | number)[] }>;
}
