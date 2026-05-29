import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Home,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  createUnit,
  deleteUnit,
  listUnits,
  updateUnit,
} from '../../api/units';
import { listMembers } from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { RoleName, Unit } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { unitTypeLabel } from '../../data/unitTypes';
import { formatNumber } from '../../utils/format';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import UnitFormModal, {
  UnitFormData,
} from '../../components/UnitFormModal';

export default function UnitsList() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [units, setUnits] = useState<Unit[] | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await listUnits(communityId);
      setUnits([...data].sort((a, b) => a.number.localeCompare(b.number, 'uk', { numeric: true })));
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити приміщення'));
    }
  }, [communityId]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void reload();
    (async () => {
      try {
        const members = await listMembers(communityId);
        const me = members.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // роль не визначена — дії редагування лишаться прихованими
      }
    })();
  }, [communityId, reload, user?.id]);

  const canManage = hasPermission(myRole, 'units:manage');

  const handleCreate = async (data: UnitFormData) => {
    try {
      await createUnit(communityId, data);
      setCreateOpen(false);
      await reload();
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося створити приміщення'));
    }
  };

  const handleUpdate = async (data: UnitFormData) => {
    if (!editing) return;
    try {
      await updateUnit(communityId, editing.id, data);
      setEditing(null);
      await reload();
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося оновити приміщення'));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteUnit(communityId, deleting.id);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося деактивувати приміщення'));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
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
          <h2 className="text-2xl font-semibold text-slate-900">Приміщення</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Активні приміщення спільноти. Деактивовані зберігаються в історії
            нарахувань і платежів, але не виводяться у цьому списку.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Додати приміщення
          </Button>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {units === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : units && units.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Home}
            title="У спільноті ще немає приміщень"
            description={
              canManage
                ? 'Додайте перше приміщення, щоб згодом нараховувати йому внески та реєструвати оплати.'
                : 'Зверніться до голови правління, щоб він додав приміщення.'
            }
            action={
              canManage ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus size={16} />
                  Додати приміщення
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <UnitsTable
          units={units!}
          canManage={canManage}
          onEdit={(u) => setEditing(u)}
          onDelete={(u) => setDeleting(u)}
        />
      )}

      <UnitFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <UnitFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing}
        onSubmit={handleUpdate}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Деактивувати приміщення"
        message={
          deleting ? (
            <>
              Приміщення <strong>№{deleting.number}</strong> буде деактивовано. Усі
              історичні нарахування та оплати збережуться, але нових нарахувань
              це приміщення більше не отримуватиме. Дію скасувати через
              інтерфейс не можна.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Деактивувати"
        confirmVariant="danger"
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

interface UnitsTableProps {
  units: Unit[];
  canManage: boolean;
  onEdit: (u: Unit) => void;
  onDelete: (u: Unit) => void;
}

function UnitsTable({ units, canManage, onEdit, onDelete }: UnitsTableProps) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-5 py-3 font-medium">№</th>
            <th className="text-left px-5 py-3 font-medium">Тип</th>
            <th className="text-right px-5 py-3 font-medium">Площа, м²</th>
            <th className="text-right px-5 py-3 font-medium">Поверх</th>
            {canManage && <th className="text-right px-5 py-3 font-medium">Дії</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {units.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-900 tabular-nums">{u.number}</td>
              <td className="px-5 py-3 text-slate-700">{unitTypeLabel(u.type)}</td>
              <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                {formatNumber(u.area)}
              </td>
              <td className="px-5 py-3 text-right text-slate-700 tabular-nums">
                {u.floor ?? '—'}
              </td>
              {canManage && (
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(u)}>
                      <Pencil size={14} />
                      Редагувати
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(u)}>
                      <Trash2 size={14} />
                      Видалити
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
