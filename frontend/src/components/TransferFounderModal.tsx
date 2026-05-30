import { FormEvent, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Alert from './Alert';
import type { UserRoleResponse } from '../types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  candidates: UserRoleResponse[];
  onSubmit: (newFounderUserId: number) => Promise<void>;
}

export default function TransferFounderModal({
  open,
  onClose,
  candidates,
  onSubmit,
}: Props) {
  const [selected, setSelected] = useState<number | ''>('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(candidates[0]?.user_id ?? '');
      setConfirmed(false);
      setBusy(false);
      setError(null);
    }
  }, [open, candidates]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected === '') {
      setError('Оберіть нового засновника');
      return;
    }
    if (!confirmed) {
      setError('Підтвердіть розуміння наслідків');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(Number(selected));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Передати засновництво" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Alert tone="warning" title="Це незворотна дія">
          Після передачі засновником стане обраний користувач. Ви залишитеся
          головою правління (роль не змінюється), але втратите ексклюзивне право
          скасування інших голів та подальшої передачі засновництва. Лише новий
          засновник зможе передати його далі.
        </Alert>

        {candidates.length === 0 ? (
          <Alert tone="error">
            Серед інших учасників немає жодного голови правління. Спочатку
            призначте ще одного <code>head</code> через «Додати учасника»,
            потім поверніться сюди.
          </Alert>
        ) : (
          <>
            <div className="space-y-1">
              <label
                htmlFor="new_founder"
                className="block text-sm font-medium text-slate-700"
              >
                Новий засновник
              </label>
              <select
                id="new_founder"
                value={selected === '' ? '' : String(selected)}
                onChange={(e) =>
                  setSelected(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">— оберіть —</option>
                {candidates.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user.full_name} ({m.user.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                У списку — лише голови правління цієї спільноти. Резидентам,
                бухгалтерам і технікам передати не можна.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-slate-700">
                Розумію, що після підтвердження більше не зможу видалити нового
                засновника зі спільноти і не зможу повернути собі засновництво
                без його згоди.
              </span>
            </label>
          </>
        )}

        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={busy || candidates.length === 0 || !confirmed || selected === ''}
          >
            <Send size={16} />
            {busy ? 'Передача…' : 'Передати'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
