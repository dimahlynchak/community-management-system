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
