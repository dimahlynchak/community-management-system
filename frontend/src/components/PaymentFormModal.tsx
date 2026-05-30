import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import TextArea from './TextArea';
import Alert from './Alert';
import { todayISO } from '../utils/format';
import { unitTypeLabel } from '../data/unitTypes';
import type { Unit } from '../types/api';

export interface PaymentFormData {
  unit_id: number;
  amount: string;
  payment_date: string;
  description: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  defaultUnitId?: number | null;
  onSubmit: (data: PaymentFormData) => Promise<void>;
}

export default function PaymentFormModal({
  open,
  onClose,
  units,
  defaultUnitId,
  onSubmit,
}: Props) {
  const [unitId, setUnitId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUnitId(defaultUnitId ?? units[0]?.id ?? '');
      setAmount('');
      setPaymentDate(todayISO());
      setDescription('');
      setBusy(false);
      setError(null);
    }
  }, [open, defaultUnitId, units]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (unitId === '') {
      setError('Оберіть приміщення');
      return;
    }
    const amountNum = Number(amount.replace(',', '.'));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Сума має бути додатним числом');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        unit_id: unitId,
        amount: amountNum.toFixed(2),
        payment_date: paymentDate,
        description: description.trim() || null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося зареєструвати платіж';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Реєстрація платежу" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <div className="space-y-1">
          <label htmlFor="unit" className="block text-sm font-medium text-slate-700">
            Приміщення
          </label>
          <select
            id="unit"
            value={unitId === '' ? '' : String(unitId)}
            onChange={(e) => setUnitId(e.target.value === '' ? '' : Number(e.target.value))}
            required
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="">— оберіть —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                №{u.number} · {unitTypeLabel(u.type)}
              </option>
            ))}
          </select>
        </div>
        <Input
          id="amount"
          label="Сума, грн"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          required
          placeholder="1500.00"
        />
        <Input
          id="payment_date"
          type="date"
          label="Дата платежу"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
        />
        <TextArea
          id="description"
          label="Призначення"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Утримання за червень 2026 (необов’язково)"
          hint="Платіж автоматично розподіляється FIFO на найстаріші непогашені нарахування цього приміщення."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Реєстрація…' : 'Зареєструвати платіж'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
