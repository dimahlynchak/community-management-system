import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  KeyRound,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  listMembers,
  removeMember,
  resetMemberPassword,
} from '../../api/roles';
import { listUnits } from '../../api/units';
import { extractErrorMessage } from '../../api/client';
import type { RoleName, Unit, UserRoleResponse } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission, ROLE_DISPLAY } from '../../utils/permissions';
import { formatDate } from '../../utils/format';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import AddMemberModal from '../../components/AddMemberModal';
import PasswordRevealModal from '../../components/PasswordRevealModal';

export default function MembersList() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [members, setMembers] = useState<UserRoleResponse[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<UserRoleResponse | null>(null);
  const [resetting, setResetting] = useState<UserRoleResponse | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{
    email: string;
    password: string;
    title: string;
    description: string;
  } | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await listMembers(communityId);
      setMembers(
        [...data].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name, 'uk')),
      );
      const me = data.find((m) => m.user_id === user?.id);
      setMyRole((me?.role.name as RoleName | undefined) ?? null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити учасників'));
    }
  }, [communityId, user?.id]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void reload();
    (async () => {
      try {
        setUnits(await listUnits(communityId));
      } catch {
        // приміщення опційно — додавання учасника працює і без вибору юніта
      }
    })();
  }, [communityId, reload]);

  const canManage = hasPermission(myRole, 'users:manage');

  const handleRemove = async () => {
    if (!removing) return;
    setActionBusy(true);
    try {
      await removeMember(communityId, removing.user_id);
      setRemoving(null);
      await reload();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося видалити учасника'));
      setRemoving(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    setActionBusy(true);
    try {
      const res = await resetMemberPassword(communityId, resetting.user_id);
      const email = resetting.user.email;
      setResetting(null);
      setRevealedPassword({
        email,
        password: res.new_password,
        title: 'Пароль скинуто',
        description: `Новий пароль для ${email}. Передайте його учаснику особисто — попередній пароль і всі активні сесії на інших пристроях скасовано.`,
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося скинути пароль'));
      setResetting(null);
    } finally {
      setActionBusy(false);
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
          <h2 className="text-2xl font-semibold text-slate-900">Учасники</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Користувачі з ролями у цій спільноті. Голова правління керує
            складом та може скидати паролі.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} />
            Додати учасника
          </Button>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {members === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : members && members.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Учасників немає"
            description={
              canManage
                ? 'Додайте першого учасника, щоб делегувати ролі чи прикріпити мешканців до приміщень.'
                : 'Учасники з’являться тут після того, як голова правління когось додасть.'
            }
            action={
              canManage ? (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus size={16} />
                  Додати учасника
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <MembersTable
          members={members!}
          canManage={canManage}
          currentUserId={user?.id}
          onReset={(m) => setResetting(m)}
          onRemove={(m) => setRemoving(m)}
        />
      )}

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        communityId={communityId}
        units={units}
        onMembershipCreated={() => void reload()}
        onPasswordGenerated={(email, password) =>
          setRevealedPassword({
            email,
            password,
            title: 'Учасника створено',
            description: `Згенеровано тимчасовий пароль для ${email}. Надайте його учаснику особисто.`,
          })
        }
      />

      <ConfirmDialog
        open={resetting !== null}
        title="Скинути пароль"
        message={
          resetting ? (
            <>
              Для учасника <strong>{resetting.user.full_name}</strong> буде
              згенеровано новий випадковий пароль. Старий пароль перестане
              діяти, активні сесії на інших пристроях завершаться. Дію
              скасувати не можна.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Скинути"
        confirmVariant="danger"
        busy={actionBusy}
        onConfirm={handleResetPassword}
        onCancel={() => setResetting(null)}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Видалити роль"
        message={
          removing ? (
            <>
              Користувача <strong>{removing.user.full_name}</strong> буде
              виведено зі спільноти. Сам акаунт у системі залишиться, але доступ
              до цієї спільноти втратиться. Дозволити повторне додавання можна
              через кнопку «Додати учасника».
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Видалити"
        confirmVariant="danger"
        busy={actionBusy}
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />

      <PasswordRevealModal
        open={revealedPassword !== null}
        onClose={() => setRevealedPassword(null)}
        title={revealedPassword?.title ?? ''}
        description={revealedPassword?.description ?? ''}
        password={revealedPassword?.password ?? ''}
      />
    </div>
  );
}

interface MembersTableProps {
  members: UserRoleResponse[];
  canManage: boolean;
  currentUserId: number | undefined;
  onReset: (m: UserRoleResponse) => void;
  onRemove: (m: UserRoleResponse) => void;
}

function MembersTable({
  members,
  canManage,
  currentUserId,
  onReset,
  onRemove,
}: MembersTableProps) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-5 py-3 font-medium">Учасник</th>
            <th className="text-left px-5 py-3 font-medium">Роль</th>
            <th className="text-left px-5 py-3 font-medium">Приміщення</th>
            <th className="text-left px-5 py-3 font-medium">Додано</th>
            {canManage && <th className="text-right px-5 py-3 font-medium">Дії</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {members.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-5 py-3">
                <div className="font-medium text-slate-900">{m.user.full_name}</div>
                <div className="text-xs text-slate-500">{m.user.email}</div>
                {m.user.phone && (
                  <div className="text-xs text-slate-500 tabular-nums">{m.user.phone}</div>
                )}
              </td>
              <td className="px-5 py-3">
                <span className="badge badge-blue">
                  {ROLE_DISPLAY[m.role.name as RoleName] ?? m.role.display_name}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-700">
                {m.unit ? (
                  <>
                    №{m.unit.number}
                    {!m.unit.is_active && (
                      <span className="badge badge-slate ml-2">деактивовано</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-slate-500 text-xs">
                {formatDate(m.assigned_at)}
              </td>
              {canManage && (
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onReset(m)}>
                      <KeyRound size={14} />
                      Пароль
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(m)}
                      disabled={m.user_id === currentUserId}
                      title={m.user_id === currentUserId ? 'Не можна видалити себе' : undefined}
                    >
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
