import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  createChargeType,
  createCharges,
  getMyCharges,
  listChargeTypes,
  listCharges,
} from '../../api/finances';
import { listUnits } from '../../api/units';
import { listMembers } from '../../api/roles';
import { extractErrorMessage } from '../../api/client';
import type {
  Charge,
  ChargeType,
  ChargeTypeCreate,
  RoleName,
  Unit,
} from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatMoney, formatPeriod } from '../../utils/format';
import { formatUnitLabel } from '../../data/unitTypes';
import { methodLabel } from '../../data/calculationMethods';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ChargeTypeFormModal, {
  ChargeTypeFormData,
} from '../../components/ChargeTypeFormModal';
import GenerateChargesModal from '../../components/GenerateChargesModal';

type UnitFilter = number | 'all';

export default function ChargesPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [chargeTypes, setChargeTypes] = useState<ChargeType[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [periodFilter, setPeriodFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [myUnitId, setMyUnitId] = useState<number | null>(null);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  const canReadAll = hasPermission(myRole, 'charges:read');
  const canReadOwn = hasPermission(myRole, 'own_charges:read');
  const isPersonal = membershipLoaded && !canReadAll && canReadOwn;

  const loadChargeTypes = useCallback(async () => {
    try {
      setChargeTypes(await listChargeTypes(communityId));
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити тарифи'));
    }
  }, [communityId]);

  const loadAdminCharges = useCallback(async () => {
    try {
      const data = await listCharges(communityId, periodFilter || null);
      setCharges(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити нарахування'));
    }
  }, [communityId, periodFilter]);

  const loadMyCharges = useCallback(async () => {
    try {
      const data = await getMyCharges(communityId);
      setCharges(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити ваші нарахування'));
      setCharges([]);
    }
  }, [communityId]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    (async () => {
      try {
        const members = await listMembers(communityId);
        const me = members.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
        setMyUnitId(me?.unit_id ?? null);
      } catch {
        // без ролі personal не визначиться, адмінські кнопки не з'являться
      } finally {
        setMembershipLoaded(true);
      }
    })();
  }, [communityId, user?.id]);

  useEffect(() => {
    if (!membershipLoaded) return;
    if (isPersonal) {
      if (myUnitId !== null) {
        setCharges(null);
        void loadMyCharges();
      } else {
        setCharges([]);
      }
      return;
    }
    if (!canReadAll) return;
    void loadChargeTypes();
    void loadAdminCharges();
    (async () => {
      try {
        setUnits(await listUnits(communityId, { includeInactive: true }));
      } catch {
        // приміщення опційно
      }
    })();
  }, [
    membershipLoaded,
    isPersonal,
    canReadAll,
    myUnitId,
    communityId,
    loadChargeTypes,
    loadAdminCharges,
    loadMyCharges,
  ]);

  const canManageTypes = hasPermission(myRole, 'charge_types:manage');
  const canCreateCharges = hasPermission(myRole, 'charges:create');

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const typesById = useMemo(
    () => new Map((chargeTypes ?? []).map((c) => [c.id, c])),
    [chargeTypes],
  );

  const filteredCharges = useMemo(() => {
    if (charges === null) return null;
    let res = charges;
    if (isPersonal && periodFilter) {
      res = res.filter((c) => c.period === periodFilter);
    }
    if (!isPersonal && unitFilter !== 'all') {
      res = res.filter((c) => c.unit_id === unitFilter);
    }
    return res;
  }, [charges, isPersonal, periodFilter, unitFilter]);

  const handleCreateChargeType = async (data: ChargeTypeFormData) => {
    try {
      const payload: ChargeTypeCreate = {
        name: data.name,
        calculation_method: data.calculation_method,
        rate: data.rate,
      };
      await createChargeType(communityId, payload);
      setTypeFormOpen(false);
      await loadChargeTypes();
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося створити тариф'));
    }
  };

  const handleGenerate = async (data: {
    charge_type_id: number;
    period: string;
    unit_ids: number[] | null;
  }) => {
    try {
      const created = await createCharges(communityId, data);
      await loadAdminCharges();
      const ct = typesById.get(data.charge_type_id);
      return {
        count: created.length,
        period: data.period,
        chargeType: ct ?? ({
          id: data.charge_type_id,
          name: `#${data.charge_type_id}`,
        } as ChargeType),
      };
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося провести нарахування'));
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
          У вас немає дозволу переглядати нарахування цієї спільноти.
        </Alert>
      </div>
    );
  }

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

      <header>
        <h2 className="text-2xl font-semibold text-slate-900">
          {isPersonal ? 'Мої нарахування' : 'Нарахування'}
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          {isPersonal
              ? 'Тарифи (типи нарахувань) і конкретні нарахування, виставлені вашому приміщенню за період.'
              : 'Тарифи (типи нарахувань) і конкретні нарахування, виставлені приміщенням за період.'}
        </p>
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {!isPersonal && (
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Receipt className="text-brand-600" size={18} />
              <h3 className="text-base font-semibold text-slate-900">
                Тарифи {chargeTypes ? `(${chargeTypes.length})` : ''}
              </h3>
            </div>
            {canManageTypes && (
              <Button size="sm" onClick={() => setTypeFormOpen(true)}>
                <Plus size={14} />
                Новий тариф
              </Button>
            )}
          </div>
          <div className="card-body">
            {chargeTypes === null ? (
              <Spinner label="Завантаження…" />
            ) : chargeTypes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Активних тарифів немає.{' '}
                {canManageTypes && 'Створіть перший, щоб можна було проводити нарахування.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Назва</th>
                      <th className="text-left px-3 py-2 font-medium">Метод</th>
                      <th className="text-right px-3 py-2 font-medium">Ставка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chargeTypes.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {methodLabel(c.calculation_method)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {c.rate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {isPersonal && myUnitId === null ? (
        <section className="card">
          <div className="card-body">
            <EmptyState
              icon={Wallet}
              title="Приміщення ще не призначено"
              description="До вашого членства в цій спільноті не привʼязане жодне приміщення. Зверніться до голови правління, щоб вас закріпили за квартирою або приміщенням."
            />
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Wallet className="text-brand-600" size={18} />
              <h3 className="text-base font-semibold text-slate-900">
                {isPersonal
                  ? personalUnit
                    ? `Нарахування по приміщенню №${personalUnit.number}`
                    : 'Ваші нарахування'
                  : 'Нарахування'}
                {filteredCharges ? ` (${filteredCharges.length})` : ''}
              </h3>
            </div>
            {!isPersonal && canCreateCharges && (
              <Button
                size="sm"
                onClick={() => setGenOpen(true)}
                disabled={!chargeTypes || chargeTypes.length === 0}
                title={
                  !chargeTypes || chargeTypes.length === 0
                    ? 'Спершу створіть хоча б один тариф'
                    : undefined
                }
              >
                <Plus size={14} />
                Масове нарахування
              </Button>
            )}
          </div>
          <div className="card-body space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {!isPersonal && (
                <div className="space-y-1 w-64">
                  <label
                    htmlFor="unit_filter"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Приміщення
                  </label>
                  <select
                    id="unit_filter"
                    value={unitFilter === 'all' ? 'all' : String(unitFilter)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUnitFilter(v === 'all' ? 'all' : Number(v));
                    }}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
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
              {!isPersonal && (
                <Button size="sm" variant="secondary" onClick={() => void loadAdminCharges()}>
                  Застосувати
                </Button>
              )}
              {periodFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPeriodFilter('');
                    if (!isPersonal) {
                      setTimeout(() => void loadAdminCharges(), 0);
                    }
                  }}
                >
                  Скинути період
                </Button>
              )}
              {!isPersonal && unitFilter !== 'all' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUnitFilter('all')}
                >
                  Усі приміщення
                </Button>
              )}
            </div>

            {filteredCharges === null ? (
              <Spinner label="Завантаження…" />
            ) : filteredCharges.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Нарахувань немає"
                description={
                  isPersonal
                    ? periodFilter
                      ? 'За обраний період нарахувань не знайдено. Спробуйте інший період або скиньте фільтр.'
                      : 'Для вашого приміщення ще немає нарахувань.'
                    : canCreateCharges
                    ? 'Створіть тариф (якщо ще не створений) і запустіть масове нарахування за обраний період.'
                    : 'Тут зʼявляться нарахування після того, як їх запустить бухгалтер або голова правління.'
                }
                action={
                  !isPersonal && canCreateCharges && chargeTypes && chargeTypes.length > 0 ? (
                    <Button onClick={() => setGenOpen(true)}>
                      <Plus size={16} />
                      Масове нарахування
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ChargesTable
                charges={filteredCharges}
                unitsById={unitsById}
                typesById={typesById}
                showUnit={!isPersonal}
              />
            )}
          </div>
        </section>
      )}

      {!isPersonal && (
        <>
          <ChargeTypeFormModal
            open={typeFormOpen}
            onClose={() => setTypeFormOpen(false)}
            onSubmit={handleCreateChargeType}
          />

          <GenerateChargesModal
            open={genOpen}
            onClose={() => setGenOpen(false)}
            chargeTypes={chargeTypes ?? []}
            units={units.filter((u) => u.is_active)}
            onSubmit={handleGenerate}
          />
        </>
      )}
    </div>
  );
}

interface ChargesTableProps {
  charges: Charge[];
  unitsById: Map<number, Unit>;
  typesById: Map<number, ChargeType>;
  showUnit: boolean;
}

function ChargesTable({ charges, unitsById, typesById, showUnit }: ChargesTableProps) {
  const sorted = [...charges].sort((a, b) => {
    if (a.period !== b.period) return b.period.localeCompare(a.period);
    const an = unitsById.get(a.unit_id)?.number ?? '';
    const bn = unitsById.get(b.unit_id)?.number ?? '';
    return an.localeCompare(bn, 'uk', { numeric: true });
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Період</th>
            {showUnit && (
              <th className="text-left px-3 py-2 font-medium">Приміщення</th>
            )}
            <th className="text-left px-3 py-2 font-medium">Тариф</th>
            <th className="text-right px-3 py-2 font-medium">Сума</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((c) => {
            const unit = unitsById.get(c.unit_id);
            const type = typesById.get(c.charge_type_id);
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700 tabular-nums">
                  {formatPeriod(c.period)}
                </td>
                {showUnit && (
                  <td className="px-3 py-2 text-slate-900 font-medium">
                    {unit ? `№${unit.number}` : `unit ${c.unit_id}`}
                    {unit && !unit.is_active && (
                      <span className="ml-2 text-xs text-slate-500 font-normal">
                        (деактивовано)
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-slate-700">
                  {type ? type.name : `type ${c.charge_type_id}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                  {formatMoney(c.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
