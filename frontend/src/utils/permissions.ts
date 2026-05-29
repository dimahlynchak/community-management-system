import type { RoleName } from '../types/api';

// Ієрархія ролей: вищі успадковують усі дозволи нижчих.
const ROLE_ORDER: RoleName[] = ['resident', 'technician', 'accountant', 'head'];

const DIRECT_PERMISSIONS: Record<RoleName, string[]> = {
  resident: ['own_charges:read'],
  technician: ['announcements:create'],
  accountant: ['charges:read', 'charges:create', 'payments:read', 'payments:create', 'reports:generate'],
  head: ['users:manage', 'budget:manage', 'audit:read', 'community:manage', 'units:manage', 'charge_types:manage'],
};

/** Усі дозволи ролі з урахуванням ієрархії. */
export function rolePermissions(role: RoleName): Set<string> {
  const index = ROLE_ORDER.indexOf(role);
  if (index < 0) return new Set();
  const result = new Set<string>();
  for (let i = 0; i <= index; i++) {
    for (const p of DIRECT_PERMISSIONS[ROLE_ORDER[i]]) {
      result.add(p);
    }
  }
  return result;
}

export function hasPermission(role: RoleName | null, codename: string): boolean {
  if (role === null) return false;
  return rolePermissions(role).has(codename);
}

export const ROLE_DISPLAY: Record<RoleName, string> = {
  resident: 'Мешканець',
  technician: 'Технічний працівник',
  accountant: 'Бухгалтер',
  head: 'Голова правління',
};
