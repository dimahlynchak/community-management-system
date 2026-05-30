import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { calculatePenalties } from '../../api/finances';
import { getMyMembership } from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { RoleName, UnitPenaltyResponse } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatMoney, formatPeriod, todayISO } from '../../utils/format';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const DEFAULT_RATE = '0.001';

export default function PenaltiesPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [rate, setRate] = useState(DEFAULT_RATE);
  const [asOf, setAsOf] = useState(todayISO());
  const [rows, setRows] = useState<UnitPenaltyResponse[] | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (rateNum: number, asOfDate: string) => {
      setBusy(true);
      setError(null);
      try {
        const data = await calculatePenalties(communityId, rateNum, asOfDate);
        setRows(data);
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося розрахувати пеню'));
      } finally {
        setBusy(false);
      }
    },
    [communityId],
  );

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void load(Number(DEFAULT_RATE), todayISO());
    (async () => {
      try {
        const me = await getMyMembership(communityId);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // не критично
      }
    })();
  }, [communityId, load, user?.id]);

  const canSee = hasPermission(myRole, 'reports:generate');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const rateNum = Number(rate.replace(',', '.'));
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError('Ставка має бути невід’ємним числом');
      return;
    }
    void load(rateNum, asOf);
  };

  const total = rows ? rows.reduce((acc, r) => acc + Number(r.penalty), 0) : 0;

  if (!canSee) {
    return (
      <div className="space-y-4">
        <Link
          to={`/communities/${communityId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft size={16} />
          До спільноти
        </Link>
        <Alert tone="error" title="Доступ обмежено">
          Розрахунок пені доступний бухгалтеру та голові правління.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/communities/${communityId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft size={16} />
        До спільноти
      </Link>

      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Пеня</h2>
        <p className="text-slate-600 mt-1 text-sm">
          Рішення про автоматичне нарахування приймає голова правління окремо.
        </p>
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      <section className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Input
                id="rate"
                label="Добова ставка"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                hint="напр. 0.001 = 0.1%/день"
              />
            </div>
            <div className="w-48">
              <Input
                id="as_of"
                type="date"
                label="На дату"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Розрахунок…' : 'Перерахувати'}
            </Button>
          </form>
        </div>
      </section>

      {rows === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Розрахунок…" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={AlertTriangle}
            title="Простроченої заборгованості немає"
            description="На обрану дату жодне приміщення не має непогашених нарахувань з простроченням більше 0 днів."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">№</th>
                <th className="text-left px-5 py-3 font-medium">Період</th>
                <th className="text-right px-5 py-3 font-medium">Борг</th>
                <th className="text-right px-5 py-3 font-medium">Днів</th>
                <th className="text-right px-5 py-3 font-medium">Ставка</th>
                <th className="text-right px-5 py-3 font-medium">Пеня</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows!.map((r, idx) => (
                <tr key={`${r.charge_id}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900 tabular-nums">
                    {r.unit_number}
                  </td>
                  <td className="px-5 py-3 text-slate-700 tabular-nums">
                    {formatPeriod(r.period)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {formatMoney(r.debt)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {r.overdue_days}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                    {r.rate}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-red-700">
                    {formatMoney(r.penalty)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="px-5 py-3" colSpan={5}>
                  Разом
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-red-700">
                  {formatMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
