import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import TextArea from './TextArea';
import Alert from './Alert';
import { currentPeriod } from '../utils/format';

export interface BudgetItemFormData {
  period: string;
  category: string;
  planned_amount: string | null;
  actual_amount: string | null;
  description: string | null;
  document_ref: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetItemFormData) => Promise<void>;
}

export default function BudgetItemFormModal({ open, onClose, onSubmit }: Props) {
  const [period, setPeriod] = useState(currentPeriod());
  const [category, setCategory] = useState('');
  const [planned, setPlanned] = useState('');
  const [actual, setActual] = useState('');
  const [description, setDescription] = useState('');
  const [docRef, setDocRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPeriod(currentPeriod());
      setCategory('');
      setPlanned('');
      setActual('');
      setDescription('');
      setDocRef('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const parseAmount = (raw: string): { ok: true; value: string | null } | { ok: false; msg: string } => {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, value: null };
    const num = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      return { ok: false, msg: 'Сума має бути невід’ємним числом' };
    }
    return { ok: true, value: num.toFixed(2) };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!category.trim()) {
      setError('Категорія обов’язкова');
      return;
    }
    const p = parseAmount(planned);
    const a = parseAmount(actual);
    if (!p.ok) {
      setError(`Планова: ${p.msg}`);
      return;
    }
    if (!a.ok) {
      setError(`Фактична: ${a.msg}`);
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        period,
        category: category.trim(),
        planned_amount: p.value,
        actual_amount: a.value,
        description: description.trim() || null,
        document_ref: docRef.trim() || null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося зберегти статтю бюджету';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Стаття бюджету" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <Input
          id="period"
          label="Період"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          required
          placeholder="2026-06"
          pattern="\d{4}-(0[1-9]|1[0-2])"
          hint="Формат YYYY-MM"
        />
        <Input
          id="category"
          label="Категорія"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          maxLength={200}
          placeholder="Електроенергія / Ремонт ліфтів / Адміністративні витрати"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="planned"
            label="План, грн"
            value={planned}
            onChange={(e) => setPlanned(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="0.00"
            hint="Необов’язково"
          />
          <Input
            id="actual"
            label="Факт, грн"
            value={actual}
            onChange={(e) => setActual(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="0.00"
            hint="Необов’язково"
          />
        </div>
        <TextArea
          id="description"
          label="Опис"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Деталі (необов’язково)"
        />
        <Input
          id="doc_ref"
          label="Документ-підстава"
          value={docRef}
          onChange={(e) => setDocRef(e.target.value)}
          maxLength={255}
          placeholder="Акт №42 від 10.06.2026 (необов’язково)"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Збереження…' : 'Додати'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
