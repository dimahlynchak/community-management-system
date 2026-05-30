export interface UnitTypeOption {
  value: string;
  label: string;
}

/** Запропоновані типи приміщень. Бекенд приймає вільний рядок до 20 символів,
 *  але UI обмежує вибір цими варіантами для уніфікації даних. */
export const UNIT_TYPE_OPTIONS: UnitTypeOption[] = [
  { value: 'flat', label: 'Квартира' },
  { value: 'business', label: 'Нежитлове приміщення' },
  { value: 'parking', label: 'Паркомісце' },
  { value: 'storage', label: 'Комора' },
  { value: 'other', label: 'Інше' },
];

const LABEL_BY_VALUE = new Map(UNIT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function unitTypeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return LABEL_BY_VALUE.get(value) ?? value;
}

export const DEFAULT_UNIT_TYPE = 'flat';

export interface UnitLike {
  number: string;
  type: string;
  is_active?: boolean;
}

/** Формує лейбл «№123 · Квартира» з опційним суфіксом «(деактивовано)»,
 *  щоб у випадаючих списках чітко відрізнити soft-deleted юніти. */
export function formatUnitLabel(u: UnitLike): string {
  const base = `№${u.number} · ${unitTypeLabel(u.type)}`;
  return u.is_active === false ? `${base} (деактивовано)` : base;
}
