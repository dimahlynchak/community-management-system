import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, PieChart, Plus } from 'lucide-react';
import { createBudgetItem, listBudget } from '../../api/finances';
import { getMyMembership } from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { BudgetItem, RoleName } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatMoney, formatPeriod } from '../../utils/format';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import BudgetItemFormModal, {
  BudgetItemFormData,
} from '../../components/BudgetItemFormModal';

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [items, setItems] = useState<BudgetItem[] | null>(null);
  const [period, setPeriod] = useState('');
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listBudget(communityId, period || null);
      setItems(
        [...data].sort((a, b) => {
          if (a.period !== b.period) return b.period.localeCompare(a.period);
          return a.category.localeCompare(b.category, 'uk');
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити бюджет'));
    }
  }, [communityId, period]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void load();
    (async () => {
      try {
        const me = await getMyMembership(communityId);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // ОК
      }
    })();
  }, [communityId, load, user?.id]);

  const canManage = hasPermission(myRole, 'budget:manage');

  const totals = useMemo(() => {
    if (!items) return null;
    return items.reduce(
      (acc, it) => {
        if (it.planned_amount !== null) acc.planned += Number(it.planned_amount);
        if (it.actual_amount !== null) acc.actual += Number(it.actual_amount);
        return acc;
      },
      { planned: 0, actual: 0 },
    );
  }, [items]);

  const handleCreate = async (data: BudgetItemFormData) => {
    try {
      await createBudgetItem(communityId, data);
      setCreateOpen(false);
      await load();
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося додати статтю бюджету'));
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to={`/communities/${communityId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft size={16} />
        До спільноти
      </Link>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Бюджет</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Планові та фактичні витрати спільноти за категоріями і періодами.
            Керує бюджетом голова правління.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Додати статтю
          </Button>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      <section className="card">
        <div className="card-body space-y-4">
          <div className="flex items-end gap-2">
            <Input
              id="period_filter"
              label="Фільтр за періодом"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM (порожньо = всі)"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              hint=" "
            />
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Застосувати
            </Button>
            {period && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPeriod('');
                  setTimeout(() => void load(), 0);
                }}
              >
                Скинути
              </Button>
            )}
          </div>

          {items === null ? (
            <Spinner label="Завантаження…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title="Бюджетних статей немає"
              description={
                canManage
                  ? 'Додайте першу статтю — наприклад, плановий бюджет на поточний місяць.'
                  : 'Тут з’являться планові та фактичні витрати після того, як їх внесе голова правління.'
              }
              action={
                canManage ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus size={16} />
                    Додати статтю
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Період</th>
                    <th className="text-left px-3 py-2 font-medium">Категорія</th>
                    <th className="text-right px-3 py-2 font-medium">План</th>
                    <th className="text-right px-3 py-2 font-medium">Факт</th>
                    <th className="text-left px-3 py-2 font-medium">Документ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 tabular-nums">
                        {formatPeriod(it.period)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{it.category}</div>
                        {it.description && (
                          <div className="text-xs text-slate-500">{it.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(it.planned_amount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(it.actual_amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-xs">
                        {it.document_ref ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {totals && items.length > 0 && (
                    <tr className="bg-slate-50 font-semibold text-slate-900">
                      <td className="px-3 py-2" colSpan={2}>
                        Разом
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(totals.planned)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(totals.actual)}
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <BudgetItemFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
