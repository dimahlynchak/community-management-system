import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import TextArea from './TextArea';
import Alert from './Alert';
import type { Payment, PaymentUpdate } from '../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSubmit: (payload: PaymentUpdate) => Promise<void>;
}

export default function PaymentEditModal({ open, onClose, payment, onSubmit }: Props) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && payment) {
      setAmount(String(payment.amount));
      setPaymentDate(payment.payment_date);
      setDescription(payment.description ?? '');
      setBusy(false);
      setError(null);
    }
  }, [open, payment]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!payment) return;

    const payload: PaymentUpdate = {};
    let structural = false;

    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Сума має бути додатним числом');
      return;
    }
    if (num.toFixed(2) !== String(payment.amount)) {
      payload.amount = num.toFixed(2);
      structural = true;
    }
    if (paymentDate && paymentDate !== payment.payment_date) {
      payload.payment_date = paymentDate;
      structural = true;
    }
    const newDesc = description.trim() || null;
    if (newDesc !== (payment.description ?? null)) {
      payload.description = newDesc;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Редагування платежу" maxWidth="md">
      {payment && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="pay_amount"
            label="Сума, грн"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            required
            hint="Зміна суми або дати запускає повний перерахунок FIFO для цього юніта."
          />
          <Input
            id="pay_date"
            type="date"
            label="Дата платежу"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
          <TextArea
            id="pay_desc"
            label="Призначення"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Опціонально"
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
