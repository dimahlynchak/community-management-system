import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import type { Charge } from '../types/api';
import { formatMoney, formatPeriod } from '../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  charge: Charge | null;
  onSubmit: (newAmount: string) => Promise<void>;
}

export default function ChargeEditModal({ open, onClose, charge, onSubmit }: Props) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && charge) {
      setAmount(String(charge.amount));
      setBusy(false);
      setError(null);
    }
  }, [open, charge]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Сума має бути додатним числом');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(num.toFixed(2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Редагування нарахування" maxWidth="sm">
      {charge && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-slate-600 space-y-1">
            <div>
              Період: <span className="font-medium text-slate-900">{formatPeriod(charge.period)}</span>
            </div>
            <div>
              Поточна сума:{' '}
              <span className="font-medium text-slate-900">{formatMoney(charge.amount)}</span>
            </div>
          </div>
          <Input
            id="charge_amount"
            label="Нова сума, грн"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            required
            hint="FIFO-розподіл усіх платежів цього юніта буде автоматично перераховано."
          />
          {error && (
            <Alert tone="error" title="Помилка">
              {error}
            </Alert>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Скасувати
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Збереження…' : 'Зберегти'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
