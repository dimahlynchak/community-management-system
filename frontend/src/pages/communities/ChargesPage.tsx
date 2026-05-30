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

export default function ChargesPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [chargeTypes, setChargeTypes] = useState<ChargeType[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [periodFilter, setPeriodFilter] = useState('');
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  const loadChargeTypes = useCallback(async () => {
    try {
      setChargeTypes(await listChargeTypes(communityId));
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити тарифи'));
    }
  }, [communityId]);

  const loadCharges = useCallback(async () => {
    try {
      const data = await listCharges(communityId, periodFilter || null);
      setCharges(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити нарахування'));
    }
  }, [communityId, periodFilter]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void loadChargeTypes();
    void loadCharges();
    (async () => {
      try {
        setUnits(await listUnits(communityId));
      } catch {
        // приміщення опційно; модалка масового нарахування без них працює тільки в режимі "усім"
      }
      try {
        const members = await listMembers(communityId);
        const me = members.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // без ролі кнопки створення/нарахування просто не з'являться
      }
    })();
  }, [communityId, loadChargeTypes, loadCharges, user?.id]);

  const canManageTypes = hasPermission(myRole, 'charge_types:manage');
  const canCreateCharges = hasPermission(myRole, 'charges:create');

  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const typesById = useMemo(
    () => new Map((chargeTypes ?? []).map((c) => [c.id, c])),
    [chargeTypes],
  );

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
      await loadCharges();
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
        <h2 className="text-2xl font-semibold text-slate-900">Нарахування</h2>
        <p className="text-slate-600 mt-1 text-sm">
          Тарифи (типи нарахувань) і конкретні нарахування, виставлені приміщенням за період.
        </p>
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
              Активних тарифів немає. {canManageTypes && 'Створіть перший, щоб можна було проводити нарахування.'}
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

      <section className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Wallet className="text-brand-600" size={18} />
            <h3 className="text-base font-semibold text-slate-900">
              Нарахування {charges ? `(${charges.length})` : ''}
            </h3>
          </div>
          {canCreateCharges && (
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
          <div className="flex items-end gap-2">
            <Input
              id="period_filter"
              label="Фільтр за періодом"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              placeholder="YYYY-MM (порожньо = всі)"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              hint=" "
            />
            <Button size="sm" variant="secondary" onClick={() => void loadCharges()}>
              Застосувати
            </Button>
            {periodFilter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPeriodFilter('');
                  void loadCharges();
                }}
              >
                Скинути
              </Button>
            )}
          </div>

          {charges === null ? (
            <Spinner label="Завантаження…" />
          ) : charges.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Нарахувань немає"
              description={
                canCreateCharges
                  ? 'Створіть тариф (якщо ще не створений) і запустіть масове нарахування за обраний період.'
                  : 'Тут з’являться нарахування після того, як їх запустить бухгалтер або голова правління.'
              }
              action={
                canCreateCharges && chargeTypes && chargeTypes.length > 0 ? (
                  <Button onClick={() => setGenOpen(true)}>
                    <Plus size={16} />
                    Масове нарахування
                  </Button>
                ) : null
              }
            />
          ) : (
            <ChargesTable
              charges={charges}
              unitsById={unitsById}
              typesById={typesById}
            />
          )}
        </div>
      </section>

      <ChargeTypeFormModal
        open={typeFormOpen}
        onClose={() => setTypeFormOpen(false)}
        onSubmit={handleCreateChargeType}
      />

      <GenerateChargesModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        chargeTypes={chargeTypes ?? []}
        units={units}
        onSubmit={handleGenerate}
      />
    </div>
  );
}

interface ChargesTableProps {
  charges: Charge[];
  unitsById: Map<number, Unit>;
  typesById: Map<number, ChargeType>;
}

function ChargesTable({ charges, unitsById, typesById }: ChargesTableProps) {
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
            <th className="text-left px-3 py-2 font-medium">Приміщення</th>
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
                <td className="px-3 py-2 text-slate-900 font-medium">
                  {unit ? `№${unit.number}` : `unit ${c.unit_id}`}
                </td>
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
