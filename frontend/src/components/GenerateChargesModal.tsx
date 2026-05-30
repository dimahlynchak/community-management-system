import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import { methodLabel } from '../data/calculationMethods';
import { unitTypeLabel } from '../data/unitTypes';
import { currentPeriod } from '../utils/format';
import type { ChargeType, Unit } from '../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  chargeTypes: ChargeType[];
  units: Unit[];
  onSubmit: (data: {
    charge_type_id: number;
    period: string;
    unit_ids: number[] | null;
  }) => Promise<{ count: number; period: string; chargeType: ChargeType }>;
}

type Mode = 'all' | 'selected';

export default function GenerateChargesModal({
  open,
  onClose,
  chargeTypes,
  units,
  onSubmit,
}: Props) {
  const [chargeTypeId, setChargeTypeId] = useState<number | ''>('');
  const [period, setPeriod] = useState(currentPeriod());
  const [mode, setMode] = useState<Mode>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChargeTypeId(chargeTypes[0]?.id ?? '');
      setPeriod(currentPeriod());
      setMode('all');
      setSelected(new Set());
      setBusy(false);
      setError(null);
      setSuccess(null);
    }
  }, [open, chargeTypes]);

  const selectedType = useMemo(
    () => chargeTypes.find((c) => c.id === chargeTypeId) ?? null,
    [chargeTypes, chargeTypeId],
  );

  const shareLocked = selectedType?.calculation_method === 'share' && mode === 'selected';

  const toggleAll = () => {
    if (selected.size === units.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(units.map((u) => u.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (chargeTypeId === '') {
      setError('Оберіть тариф');
      return;
    }
    if (mode === 'selected' && selected.size === 0) {
      setError('Оберіть хоча б одне приміщення');
      return;
    }
    if (shareLocked) {
      setError('Метод «Рівний розподіл» працює лише з нарахуванням усім активним приміщенням');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({
        charge_type_id: chargeTypeId,
        period,
        unit_ids: mode === 'all' ? null : Array.from(selected),
      });
      if (result.count === 0) {
        setSuccess(
          `За період ${result.period} жодного нового нарахування не створено — всі обрані приміщення вже мають charge цього тарифу.`,
        );
      } else {
        setSuccess(
          `Створено ${result.count} нарахувань тарифу «${result.chargeType.name}» за період ${result.period}.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося провести нарахування';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Масове нарахування"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        {success && (
          <Alert tone="success" title="Готово">
            {success}
          </Alert>
        )}

        <div className="space-y-1">
          <label htmlFor="charge_type" className="block text-sm font-medium text-slate-700">
            Тариф
          </label>
          <select
            id="charge_type"
            value={chargeTypeId === '' ? '' : String(chargeTypeId)}
            onChange={(e) =>
              setChargeTypeId(e.target.value === '' ? '' : Number(e.target.value))
            }
            required
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="">— оберіть тариф —</option>
            {chargeTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({methodLabel(c.calculation_method)}, {c.rate} грн)
              </option>
            ))}
          </select>
        </div>

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

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-slate-700 mb-1">
            Кому нарахувати
          </legend>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="all"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-900">Усім активним приміщенням</span>
              <span className="block text-xs text-slate-500">
                Приміщення, які вже мають нарахування цього тарифу за цей період, будуть пропущені.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="selected"
              checked={mode === 'selected'}
              onChange={() => setMode('selected')}
              className="mt-1"
              disabled={selectedType?.calculation_method === 'share'}
            />
            <span className="text-sm">
              <span className="font-medium text-slate-900">Тільки обраним</span>
              <span className="block text-xs text-slate-500">
                Зручно для донарахування новим приміщенням. Не працює з методом «Рівний розподіл».
              </span>
            </span>
          </label>
        </fieldset>

        {mode === 'selected' && (
          <div className="space-y-2 border border-slate-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">
                Обрано <span className="font-semibold">{selected.size}</span> з {units.length}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                {selected.size === units.length ? (
                  <>
                    <Square size={14} />
                    Зняти все
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} />
                    Обрати все
                  </>
                )}
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {units.map((u) => {
                const checked = selected.has(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer ${
                      checked ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(u.id)}
                      />
                      №{u.number}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {unitTypeLabel(u.type)} · {u.area} м²
                    </span>
                  </label>
                );
              })}
              {units.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  Активних приміщень немає
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Закрити
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Нарахування…' : 'Нарахувати'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
