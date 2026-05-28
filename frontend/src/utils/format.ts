import dayjs from 'dayjs';
import 'dayjs/locale/uk';

dayjs.locale('uk');

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) {
    return String(value);
  }
  return moneyFormatter.format(num);
}

export function formatNumber(value: string | number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) {
    return String(value);
  }
  return num.toFixed(fractionDigits);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dayjs(value).format('DD.MM.YYYY');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return dayjs(value).format('DD.MM.YYYY HH:mm:ss');
}

export function formatPeriod(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = dayjs(`${value}-01`);
  if (!parsed.isValid()) return value;
  return parsed.format('MMMM YYYY');
}

export function currentPeriod(): string {
  return dayjs().format('YYYY-MM');
}

export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}
