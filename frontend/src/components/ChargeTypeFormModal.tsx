import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import {
  CALCULATION_METHODS,
  DEFAULT_METHOD,
} from '../data/calculationMethods';
import type { CalculationMethod } from '../types/api';

export interface ChargeTypeFormData {
  name: string;
  calculation_method: CalculationMethod;
  rate: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChargeTypeFormData) => Promise<void>;
}

export default function ChargeTypeFormModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<CalculationMethod>(DEFAULT_METHOD);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setMethod(DEFAULT_METHOD);
      setRate('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Назва обов’язкова');
      return;
    }
    const rateNum = Number(rate.replace(',', '.'));
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError('Ставка має бути невід’ємним числом');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: trimmed,
        calculation_method: method,
        rate: rateNum.toFixed(2),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося створити тариф';
      setError(msg);
      setBusy(false);
    }
  };

  const methodInfo = CALCULATION_METHODS.find((m) => m.value === method);
  const rateHint =
    method === 'per_sqm'
      ? 'Ставка за 1 м² (грн)'
      : method === 'fixed'
      ? 'Сума на одне приміщення (грн)'
      : 'Загальна сума на спільноту (грн); поділиться порівну';

  return (
    <Modal open={open} onClose={onClose} title="Новий тариф" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <Input
          id="name"
          label="Назва"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          placeholder="Утримання будинку"
        />
        <div className="space-y-1">
          <label htmlFor="method" className="block text-sm font-medium text-slate-700">
            Метод розрахунку
          </label>
          <select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as CalculationMethod)}
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            {CALCULATION_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {methodInfo && (
            <p className="text-xs text-slate-500">{methodInfo.hint}</p>
          )}
        </div>
        <Input
          id="rate"
          label="Ставка"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          required
          placeholder="14.50"
          hint={rateHint}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Створення…' : 'Створити тариф'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
