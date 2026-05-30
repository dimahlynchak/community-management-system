import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ListChecks, Plus, Receipt } from 'lucide-react';
import {
  createPayment,
  listPaymentAllocations,
  listPayments,
} from '../../api/finances';
import { listUnits } from '../../api/units';
import { listMembers } from '../../api/roles';
import { extractErrorMessage } from '../../api/client';
import type {
  Payment,
  PaymentAllocation,
  RoleName,
  Unit,
} from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatDate, formatMoney } from '../../utils/format';
import { unitTypeLabel } from '../../data/unitTypes';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import PaymentFormModal, {
  PaymentFormData,
} from '../../components/PaymentFormModal';

export default function PaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<number | ''>('');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [allocationsFor, setAllocationsFor] = useState<Payment | null>(null);
  const [allocations, setAllocations] = useState<PaymentAllocation[] | null>(null);

  const loadPayments = useCallback(
    async (uid: number) => {
      try {
        const data = await listPayments(communityId, uid);
        setPayments(
          [...data].sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
        );
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося завантажити платежі'));
        setPayments([]);
      }
    },
    [communityId],
  );

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    (async () => {
      try {
        const u = await listUnits(communityId);
        setUnits(u);
        if (u.length > 0) {
          setUnitId(u[0].id);
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося завантажити приміщення'));
      }
      try {
        const members = await listMembers(communityId);
        const me = members.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // без ролі кнопки створення не з'являться
      }
    })();
  }, [communityId, user?.id]);

  useEffect(() => {
    if (unitId !== '' && Number.isFinite(unitId)) {
      setPayments(null);
      void loadPayments(unitId);
    }
  }, [unitId, loadPayments]);

  const canCreate = hasPermission(myRole, 'payments:create');
  const canRead = hasPermission(myRole, 'payments:read');

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const handleCreate = async (data: PaymentFormData) => {
    try {
      await createPayment(communityId, data);
      setCreateOpen(false);
      if (unitId === data.unit_id && Number.isFinite(unitId)) {
        await loadPayments(data.unit_id);
      } else {
        setUnitId(data.unit_id);
      }
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося зареєструвати платіж'));
    }
  };

  const openAllocations = async (p: Payment) => {
    setAllocationsFor(p);
    setAllocations(null);
    try {
      const data = await listPaymentAllocations(communityId, p.id);
      setAllocations(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити розподіл'));
      setAllocations([]);
    }
  };

  if (!canRead) {
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
          Перегляд платежів доступний бухгалтеру та голові правління. Для перегляду
          власних оплат скористайтеся розділом «Особистий кабінет».
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

      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Платежі</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Реєстрація оплат від мешканців. Платіж автоматично розподіляється FIFO
            на найстаріші непогашені нарахування цього приміщення.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} disabled={units.length === 0}>
            <Plus size={16} />
            Зареєструвати платіж
          </Button>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      <section className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Receipt className="text-brand-600" size={18} />
            <h3 className="text-base font-semibold text-slate-900">
              Платежі за приміщенням
            </h3>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="space-y-1 max-w-sm">
            <label htmlFor="unit_select" className="block text-sm font-medium text-slate-700">
              Приміщення
            </label>
            <select
              id="unit_select"
              value={unitId === '' ? '' : String(unitId)}
              onChange={(e) =>
                setUnitId(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">— оберіть приміщення —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  №{u.number} · {unitTypeLabel(u.type)}
                </option>
              ))}
            </select>
          </div>

          {unitId === '' ? (
            <p className="text-sm text-slate-500">Оберіть приміщення, щоб переглянути платежі.</p>
          ) : payments === null ? (
            <Spinner label="Завантаження…" />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Платежів немає"
              description="Для цього приміщення не зареєстровано жодного платежу."
              action={
                canCreate ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus size={16} />
                    Зареєструвати платіж
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Дата</th>
                    <th className="text-right px-3 py-2 font-medium">Сума</th>
                    <th className="text-left px-3 py-2 font-medium">Призначення</th>
                    <th className="text-right px-3 py-2 font-medium">Розподіл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 tabular-nums">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                        {formatMoney(p.amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {p.description ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => void openAllocations(p)}>
                          <ListChecks size={14} />
                          Деталі
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <PaymentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        units={units}
        defaultUnitId={unitId === '' ? null : unitId}
        onSubmit={handleCreate}
      />

      <Modal
        open={allocationsFor !== null}
        onClose={() => setAllocationsFor(null)}
        title="Розподіл платежу"
        maxWidth="md"
      >
        {allocationsFor && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Платіж від {formatDate(allocationsFor.payment_date)} на суму{' '}
              <span className="font-semibold text-slate-900">
                {formatMoney(allocationsFor.amount)}
              </span>
              {' '}
              для №{unitsById.get(allocationsFor.unit_id)?.number ?? allocationsFor.unit_id}.
            </div>
            {allocations === null ? (
              <Spinner label="Завантаження…" />
            ) : allocations.length === 0 ? (
              <Alert tone="info">
                Платіж ще не розподілено: у приміщення немає непогашених нарахувань
                цього або попередніх періодів. Сума зберігається як переплата і буде
                автоматично зарахована при наступному нарахуванні.
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Нарахування</th>
                      <th className="text-right px-3 py-2 font-medium">Зараховано</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocations.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 text-slate-700">
                          charge #{a.charge_id}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatMoney(a.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
