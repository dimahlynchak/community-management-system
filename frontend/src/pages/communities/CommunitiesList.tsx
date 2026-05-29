import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import {
  createCommunity,
  listCommunities,
} from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { Community } from '../../types/api';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import CommunityFormModal, {
  CommunityFormData,
} from '../../components/CommunityFormModal';

export default function CommunitiesList() {
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await listCommunities();
      setCommunities(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити спільноти'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (data: CommunityFormData) => {
    try {
      const created = await createCommunity(data);
      setCreateOpen(false);
      navigate(`/communities/${created.id}`);
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Не вдалося створити спільноту'));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Спільноти</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Спільноти, у яких ви маєте роль. Творець нової спільноти автоматично стає
            головою правління.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Створити спільноту
        </Button>
      </header>

      {error && (
        <Alert tone="error" title="Помилка завантаження">
          {error}
        </Alert>
      )}

      {communities === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : communities && communities.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="У вас ще немає спільнот"
            description="Створіть першу спільноту або зверніться до голови правління вашого ОСББ — він додасть вас за вашою електронною поштою."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
                Створити спільноту
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communities?.map((c) => (
            <CommunityRow key={c.id} community={c} />
          ))}
        </div>
      )}

      <CommunityFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function CommunityRow({ community }: { community: Community }) {
  return (
    <Link
      to={`/communities/${community.id}`}
      className="card hover:border-brand-300 transition-colors block"
    >
      <div className="card-body flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-brand-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="text-brand-600" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{community.name}</h3>
          <p className="text-sm text-slate-600 truncate">{community.address}</p>
          {community.edrpou && (
            <p className="text-xs text-slate-500 mt-1">
              ЄДРПОУ: <span className="tabular-nums">{community.edrpou}</span>
            </p>
          )}
        </div>
        <ChevronRight className="text-slate-400 flex-shrink-0" size={20} />
      </div>
    </Link>
  );
}
