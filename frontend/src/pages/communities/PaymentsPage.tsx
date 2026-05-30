import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ListChecks, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import {
  createPayment,
  deletePayment,
  getMyPayments,
  listPaymentAllocations,
  listPayments,
  updatePayment,
} from '../../api/finances';
import { listUnits } from '../../api/units';
import { getMyMembership } from '../../api/communities';
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
import { formatUnitLabel } from '../../data/unitTypes';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import PaymentFormModal, {
  PaymentFormData,
} from '../../components/PaymentFormModal';
import PaymentEditModal from '../../components/PaymentEditModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { PaymentUpdate } from '../../types/api';

type UnitFilter = number | 'all' | '';

export default function PaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<UnitFilter>('');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [periodFilter, setPeriodFilter] = useState('');
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [myUnitId, setMyUnitId] = useState<number | null>(null);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [allocationsFor, setAllocationsFor] = useState<Payment | null>(null);
  const [allocations, setAllocations] = useState<PaymentAllocation[] | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [removing, setRemoving] = useState<Payment | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const canCreate = hasPermission(myRole, 'payments:create');
  const canReadAll = hasPermission(myRole, 'payments:read');
  const canReadOwn = hasPermission(myRole, 'own_charges:read');
  const isPersonal = membershipLoaded && !canReadAll && canReadOwn;

  const loadAdminPayments = useCallback(
    async (filter: UnitFilter, allUnits: Unit[]) => {
      try {
        if (filter === 'all') {
          if (allUnits.length === 0) {
            setPayments([]);
            return;
          }
          const lists = await Promise.all(
            allUnits.map((u) => listPayments(communityId, u.id)),
          );
          setPayments(
            lists
              .flat()
              .sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
          );
        } else if (filter !== '' && Number.isFinite(filter)) {
          const data = await listPayments(communityId, filter);
          setPayments(
            [...data].sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
          );
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося завантажити платежі'));
        setPayments([]);
      }
    },
    [communityId],
  );

  const loadMyPayments = useCallback(async () => {
    try {
      const data = await getMyPayments(communityId);
      setPayments(
        [...data].sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити ваші платежі'));
      setPayments([]);
    }
  }, [communityId]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    (async () => {
      try {
        const me = await getMyMembership(communityId);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
        setMyUnitId(me?.unit_id ?? null);
      } catch {
        // без ролі personal не визначиться, адмін не побачить кнопки
      } finally {
        setMembershipLoaded(true);
      }
    })();
  }, [communityId, user?.id]);

  useEffect(() => {
    if (!membershipLoaded) return;
    if (isPersonal) {
      if (myUnitId !== null) {
        setPayments(null);
        void loadMyPayments();
      } else {
        setPayments([]);
      }
      return;
    }
    if (!canReadAll) return;
    (async () => {
      try {
        const u = await listUnits(communityId, { includeInactive: true });
        setUnits(u);
        if (u.length > 0) {
          setUnitId('all');
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося завантажити приміщення'));
      }
    })();
  }, [
    membershipLoaded,
    isPersonal,
    canReadAll,
    myUnitId,
    communityId,
    loadMyPayments,
  ]);

  useEffect(() => {
    if (isPersonal) return;
    if (!canReadAll) return;
    if (unitId === '') return;
    setPayments(null);
    void loadAdminPayments(unitId, units);
  }, [isPersonal, canReadAll, unitId, units, loadAdminPayments]);

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const filteredPayments = useMemo(() => {
    if (payments === null) return null;
    if (!periodFilter) return payments;
    return payments.filter((p) => p.payment_date.startsWith(`${periodFilter}-`));
  }, [payments, periodFilter]);

  const handleCreate = async (data: PaymentFormData) => {
    try {
      await createPayment(communityId, data);
      setCreateOpen(false);
      if (unitId === 'all' || unitId === data.unit_id) {
        await loadAdminPayments(unitId, units);
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

  const handleEditPayment = async (payload: PaymentUpdate) => {
    if (!editing) return;
    try {
      await updatePayment(communityId, editing.id, payload);
      setEditing(null);
      if (isPersonal) {
        await loadMyPayments();
      } else if (unitId !== '') {
        await loadAdminPayments(unitId, units);
      }
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося оновити платіж'));
    }
  };

  const handleDeletePayment = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deletePayment(communityId, removing.id);
      setRemoving(null);
      if (isPersonal) {
        await loadMyPayments();
      } else if (unitId !== '') {
        await loadAdminPayments(unitId, units);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося видалити платіж'));
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  };

  if (!membershipLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Завантаження…" />
      </div>
    );
  }

  if (!canReadAll && !canReadOwn) {
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
          У вас немає дозволу переглядати платежі цієї спільноти.
        </Alert>
      </div>
    );
  }

  const showUnitColumn = !isPersonal && unitId === 'all';
  const personalUnit = isPersonal && myUnitId !== null ? unitsById.get(myUnitId) : null;

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
            {isPersonal
              ? 'Ваші оплати за приміщенням. Розподіл на нарахування виконується FIFO.'
              : 'Реєстрація оплат від мешканців. Платіж автоматично розподіляється FIFO на найстаріші непогашені нарахування цього приміщення.'}
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

      {isPersonal && myUnitId === null ? (
        <div className="card">
          <div className="card-body">
            <EmptyState
              icon={Receipt}
              title="Приміщення ще не призначено"
              description="До вашого членства в цій спільноті не привʼязане жодне приміщення. Зверніться до голови правління, щоб вас закріпили за квартирою або приміщенням."
            />
          </div>
        </div>
      ) : (
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Receipt className="text-brand-600" size={18} />
              <h3 className="text-base font-semibold text-slate-900">
                {isPersonal
                  ? personalUnit
                    ? `Платежі по приміщенню №${personalUnit.number}`
                    : 'Ваші платежі'
                  : 'Платежі за приміщенням'}
              </h3>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {!isPersonal && (
                <div className="space-y-1 w-64">
                  <label
                    htmlFor="unit_select"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Приміщення
                  </label>
                  <select
                    id="unit_select"
                    value={unitId === '' ? '' : String(unitId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') setUnitId('');
                      else if (v === 'all') setUnitId('all');
                      else setUnitId(Number(v));
                    }}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">— оберіть приміщення —</option>
                    <option value="all">Усі приміщення</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUnitLabel(u)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-56">
                <Input
                  id="period_filter"
                  label="Фільтр за періодом"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  placeholder="YYYY-MM (порожньо = всі)"
                  pattern="\d{4}-(0[1-9]|1[0-2])"
                  hint=" "
                />
              </div>
              {periodFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPeriodFilter('')}
                >
                  Скинути період
                </Button>
              )}
            </div>

            {!isPersonal && unitId === '' ? (
              <p className="text-sm text-slate-500">
                Оберіть приміщення (або «Усі»), щоб переглянути платежі.
              </p>
            ) : filteredPayments === null ? (
              <Spinner label="Завантаження…" />
            ) : filteredPayments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Платежів немає"
                description={
                  periodFilter
                    ? 'За обраний період платежів не знайдено. Спробуйте інший період або скиньте фільтр.'
                    : isPersonal
                    ? 'Для вашого приміщення ще не зареєстровано жодного платежу.'
                    : 'Для обраного приміщення не зареєстровано жодного платежу.'
                }
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
                      {showUnitColumn && (
                        <th className="text-left px-3 py-2 font-medium">Приміщення</th>
                      )}
                      <th className="text-right px-3 py-2 font-medium">Сума</th>
                      <th className="text-left px-3 py-2 font-medium">Призначення</th>
                      <th className="text-right px-3 py-2 font-medium">Розподіл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => {
                      const u = unitsById.get(p.unit_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700 tabular-nums">
                            {formatDate(p.payment_date)}
                          </td>
                          {showUnitColumn && (
                            <td className="px-3 py-2 text-slate-900 font-medium">
                              {u ? `№${u.number}` : `unit ${p.unit_id}`}
                              {u && !u.is_active && (
                                <span className="ml-2 text-xs text-slate-500 font-normal">
                                  (деактивовано)
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                            {formatMoney(p.amount)}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {p.description ?? <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openAllocations(p)}
                                title="Розподіл платежу"
                              >
                                <ListChecks size={14} />
                              </Button>
                              {canCreate && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditing(p)}
                                    title="Редагувати"
                                  >
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRemoving(p)}
                                    title="Видалити"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {canCreate && (
        <PaymentFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          units={units}
          defaultUnitId={
            typeof unitId === 'number' ? unitId : units[0]?.id ?? null
          }
          onSubmit={handleCreate}
        />
      )}

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

      <PaymentEditModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        payment={editing}
        onSubmit={handleEditPayment}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Видалити платіж"
        message={
          removing ? (
            <>
              Платіж від <strong>{formatDate(removing.payment_date)}</strong> на
              суму <strong>{formatMoney(removing.amount)}</strong> буде
              видалено. Інші платежі цього юніта перерозподіляться FIFO заново
              — відповідні нарахування можуть знову стати непогашеними. Дію
              скасувати не можна.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Видалити"
        confirmVariant="danger"
        busy={removeBusy}
        onConfirm={handleDeletePayment}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
