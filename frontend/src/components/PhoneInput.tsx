import { ChangeEvent, ReactNode, useId } from 'react';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '../data/countryCodes';

interface Props {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  countryCode: string;
  digits: string;
  onCountryCodeChange: (code: string) => void;
  onDigitsChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
}

export default function PhoneInput({
  label,
  hint,
  error,
  countryCode,
  digits,
  onCountryCodeChange,
  onDigitsChange,
  disabled = false,
  required = false,
  autoComplete = 'tel-national',
}: Props) {
  const id = useId();
  const selectId = `${id}-code`;
  const inputId = `${id}-digits`;

  const handleDigitsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    onDigitsChange(cleaned);
  };

  const selectedCode = countryCode || DEFAULT_COUNTRY_CODE;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          id={selectId}
          value={selectedCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          disabled={disabled}
          aria-label="Код країни"
          className={[
            'w-44 px-3 py-2 text-sm rounded-md border bg-white',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'disabled:bg-slate-100 disabled:text-slate-500',
            error ? 'border-red-400' : 'border-slate-300',
          ].join(' ')}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.iso} value={c.code}>
              +{c.code} {c.label}
            </option>
          ))}
        </select>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          value={digits}
          onChange={handleDigitsChange}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          placeholder="991234567"
          className={[
            'flex-1 px-3 py-2 text-sm rounded-md border bg-white tabular-nums',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'disabled:bg-slate-100 disabled:text-slate-500',
            error ? 'border-red-400' : 'border-slate-300',
          ].join(' ')}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
