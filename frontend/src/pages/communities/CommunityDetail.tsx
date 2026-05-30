import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  FileBarChart,
  Home,
  Megaphone,
  Pencil,
  ScrollText,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import {
  deleteCommunity,
  getCommunity,
  listMembers,
  updateCommunity,
} from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { Community, RoleName } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission, ROLE_DISPLAY } from '../../utils/permissions';
import { formatDate } from '../../utils/format';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import CommunityFormModal, {
  CommunityFormData,
} from '../../components/CommunityFormModal';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    try {
      const [c, members] = await Promise.all([
        getCommunity(communityId),
        listMembers(communityId),
      ]);
      setCommunity(c);
      setMemberCount(members.length);
      const me = members.find((m) => m.user_id === user?.id);
      setMyRole((me?.role.name as RoleName | undefined) ?? null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити спільноту'));
    }
  }, [communityId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = async (data: CommunityFormData) => {
    try {
      const updated = await updateCommunity(communityId, data);
      setCommunity(updated);
      setEditOpen(false);
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося оновити спільноту'));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCommunity(communityId);
      navigate('/communities', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося видалити спільноту'));
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Завантаження…" />
      </div>
    );
  }

  const canManage = hasPermission(myRole, 'community:manage');

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-md bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="text-brand-600" size={24} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-slate-900 truncate">
              {community.name}
            </h2>
            <p className="text-slate-600 mt-1 text-sm">{community.address}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
              {community.edrpou && (
                <span className="badge badge-slate">
                  ЄДРПОУ: <span className="tabular-nums ml-1">{community.edrpou}</span>
                </span>
              )}
              {myRole && (
                <span className="badge badge-blue">Ваша роль: {ROLE_DISPLAY[myRole]}</span>
              )}
              <span className="text-slate-400">
                Створено: {formatDate(community.created_at)}
              </span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} />
              Редагувати
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} />
              Видалити
            </Button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Учасників" value={memberCount} icon={Users} />
        <StatCard label="ЄДРПОУ" value={community.edrpou ?? '—'} icon={ClipboardList} />
        <StatCard
          label="Останнє оновлення"
          value={formatDate(community.updated_at)}
          icon={Home}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <h3 className="text-base font-semibold text-slate-900">Розділи спільноти</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-slate-600 mb-4">
            Підмодулі додаватимуться у наступних кроках розробки.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <SectionTile to={`/communities/${communityId}/units`} icon={Home} label="Приміщення" />
            <SectionTile to={`/communities/${communityId}/members`} icon={Users} label="Учасники" />
            <SectionTile to={`/communities/${communityId}/announcements`} icon={Megaphone} label="Оголошення" />
            <SectionTile to="" icon={Wallet} label="Нарахування" disabled />
            <SectionTile to="" icon={FileBarChart} label="Боргова відомість" disabled />
            <SectionTile to="" icon={ScrollText} label="Журнал аудиту" disabled />
          </div>
        </div>
      </section>

      <CommunityFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={community}
        onSubmit={handleUpdate}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Видалення спільноти"
        message={
          <>
            Спільноту <strong>{community.name}</strong> буде деактивовано. Всі фінансові
            записи, нарахування та журнал аудиту збережуться, але доступ до неї стане
            неможливим. Цю дію не можна скасувати через інтерфейс.
          </>
        }
        confirmLabel="Видалити"
        confirmVariant="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/communities"
      className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
    >
      <ChevronLeft size={16} />
      До списку спільнот
    </Link>
  );
}

interface StatCardProps {
  label: string;
  value: number | string | null;
  icon: typeof Home;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="card">
      <div className="card-body flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
          <Icon className="text-slate-500" size={20} />
        </div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-lg font-semibold text-slate-900">
            {value === null ? '—' : value}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SectionTileProps {
  to: string;
  icon: typeof Home;
  label: string;
  disabled?: boolean;
}

function SectionTile({ to, icon: Icon, label, disabled }: SectionTileProps) {
  const className =
    'flex items-center gap-2 px-3 py-3 rounded-md border text-sm font-medium ' +
    (disabled
      ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
      : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300');
  if (disabled || !to) {
    return (
      <div className={className} aria-disabled={disabled}>
        <Icon size={16} />
        {label}
      </div>
    );
  }
  return (
    <Link to={to} className={className}>
      <Icon size={16} />
      {label}
    </Link>
  );
}
