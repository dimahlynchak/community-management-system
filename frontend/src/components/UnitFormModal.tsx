import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import type { Unit } from '../types/api';
import {
  DEFAULT_UNIT_TYPE,
  UNIT_TYPE_OPTIONS,
} from '../data/unitTypes';

export interface UnitFormData {
  number: string;
  type: string;
  area: string;
  floor: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Unit | null;
  onSubmit: (data: UnitFormData) => Promise<void>;
}

export default function UnitFormModal({ open, onClose, initial, onSubmit }: Props) {
  const isEdit = Boolean(initial);
  const [number, setNumber] = useState('');
  const [type, setType] = useState<string>(DEFAULT_UNIT_TYPE);
  const [area, setArea] = useState('');
  const [floor, setFloor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNumber(initial?.number ?? '');
      setType(initial?.type ?? DEFAULT_UNIT_TYPE);
      setArea(initial?.area ?? '');
      setFloor(initial?.floor !== null && initial?.floor !== undefined ? String(initial.floor) : '');
      setError(null);
      setBusy(false);
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = number.trim();
    if (!trimmed) {
      setError('Номер приміщення обов’язковий');
      return;
    }
    const areaNum = Number(area.replace(',', '.'));
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      setError('Площа має бути додатним числом');
      return;
    }
    const floorNum = floor.trim() ? Number(floor) : null;
    if (floor.trim() && !Number.isFinite(floorNum)) {
      setError('Поверх має бути цілим числом');
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        number: trimmed,
        type,
        area: areaNum.toFixed(2),
        floor: floorNum,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося зберегти';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редагування приміщення' : 'Додавання приміщення'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <Input
          id="number"
          label="Номер"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          required
          placeholder="12, 12А, П-3"
          maxLength={20}
          autoComplete="off"
        />
        <div className="space-y-1">
          <label htmlFor="type" className="block text-sm font-medium text-slate-700">
            Тип
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            {UNIT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          id="area"
          label="Площа, м²"
          value={area}
          onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          placeholder="60.50"
          required
          autoComplete="off"
        />
        <Input
          id="floor"
          label="Поверх"
          value={floor}
          onChange={(e) => setFloor(e.target.value.replace(/[^\d-]/g, ''))}
          inputMode="numeric"
          placeholder="1, 2, 3…"
          hint="Необов’язково"
          autoComplete="off"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Збереження…' : isEdit ? 'Зберегти' : 'Додати'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
