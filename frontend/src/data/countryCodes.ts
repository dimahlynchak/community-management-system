export interface CountryCode {
  iso: string;
  code: string;
  label: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { iso: 'UA', code: '380', label: 'Україна' },
  { iso: 'PL', code: '48', label: 'Польща' },
  { iso: 'DE', code: '49', label: 'Німеччина' },
  { iso: 'CZ', code: '420', label: 'Чехія' },
  { iso: 'SK', code: '421', label: 'Словаччина' },
  { iso: 'HU', code: '36', label: 'Угорщина' },
  { iso: 'RO', code: '40', label: 'Румунія' },
  { iso: 'MD', code: '373', label: 'Молдова' },
  { iso: 'BG', code: '359', label: 'Болгарія' },
  { iso: 'LT', code: '370', label: 'Литва' },
  { iso: 'LV', code: '371', label: 'Латвія' },
  { iso: 'EE', code: '372', label: 'Естонія' },
  { iso: 'FI', code: '358', label: 'Фінляндія' },
  { iso: 'SE', code: '46', label: 'Швеція' },
  { iso: 'NO', code: '47', label: 'Норвегія' },
  { iso: 'GB', code: '44', label: 'Велика Британія' },
  { iso: 'US', code: '1', label: 'США / Канада' },
  { iso: 'IL', code: '972', label: 'Ізраїль' },
  { iso: 'TR', code: '90', label: 'Туреччина' },
  { iso: 'GE', code: '995', label: 'Грузія' },
  { iso: 'AE', code: '971', label: 'ОАЕ' },
];

export const DEFAULT_COUNTRY_CODE = '380';

/** Розбирає телефон у форматі +<code><digits> на код країни і номер.
 *  Якщо код не знайдено серед списку — повертає (DEFAULT_COUNTRY_CODE, ''). */
export function splitPhone(phone: string | null | undefined): {
  code: string;
  digits: string;
} {
  if (!phone) {
    return { code: DEFAULT_COUNTRY_CODE, digits: '' };
  }
  const value = phone.startsWith('+') ? phone.slice(1) : phone;
  // Шукаємо найдовший співпадаючий префікс
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (value.startsWith(c.code)) {
      return { code: c.code, digits: value.slice(c.code.length) };
    }
  }
  return { code: DEFAULT_COUNTRY_CODE, digits: value };
}

export function composePhone(code: string, digits: string): string {
  const cleaned = digits.replace(/\D/g, '');
  return cleaned ? `+${code}${cleaned}` : '';
}
