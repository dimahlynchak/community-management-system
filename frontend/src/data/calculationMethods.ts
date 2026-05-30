import type { CalculationMethod } from '../types/api';

export interface MethodOption {
  value: CalculationMethod;
  label: string;
  hint: string;
}

export const CALCULATION_METHODS: MethodOption[] = [
  {
    value: 'per_sqm',
    label: 'За площею',
    hint: 'C = площа × ставка (грн/м²). Тариф для регулярних внесків з урахуванням площі приміщення.',
  },
  {
    value: 'fixed',
    label: 'Фіксована сума',
    hint: 'C = ставка (грн). Однакова сума для кожного приміщення незалежно від площі.',
  },
  {
    value: 'share',
    label: 'Рівний розподіл',
    hint: 'C = ставка / кількість приміщень. Цільова сума ділиться порівну (тільки для нарахування всім).',
  },
];

const LABEL = new Map(CALCULATION_METHODS.map((m) => [m.value, m.label]));

export function methodLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return LABEL.get(value as CalculationMethod) ?? value;
}

export const DEFAULT_METHOD: CalculationMethod = 'per_sqm';
