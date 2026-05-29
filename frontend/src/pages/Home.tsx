import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Mail, Plus } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { listCommunities, createCommunity } from '../api/communities';
import { extractErrorMessage } from '../api/client';
import type { Community } from '../types/api';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import CommunityFormModal, {
  CommunityFormData,
} from '../components/CommunityFormModal';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCommunities(await listCommunities());
      } catch (err) {
        setError(extractErrorMessage(err, 'Не вдалося завантажити список спільнот'));
      }
    })();
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

  const firstName = user?.full_name?.split(' ')[1] ?? user?.full_name ?? '';
  const hasCommunities = communities !== null && communities.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">
          Вітаємо, {firstName}!
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          Система автоматизації фінансового та адміністративного управління
          житловою спільнотою.
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {communities === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : hasCommunities ? (
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Building2 className="text-brand-600" size={20} />
              <h3 className="text-base font-semibold text-slate-900">
                Ваші спільноти ({communities!.length})
              </h3>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/communities')}>
              Усі спільноти
              <ChevronRight size={14} />
            </Button>
          </div>
          <ul className="divide-y divide-slate-200">
            {communities!.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  to={`/communities/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <Building2 size={16} className="text-brand-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {c.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{c.address}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <NoMembershipBlock onCreate={() => setCreateOpen(true)} />
      )}

      <CommunityFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function NoMembershipBlock({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="card max-w-3xl">
      <div className="card-body space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="text-brand-600" size={20} />
          <h3 className="text-base font-semibold text-slate-900">
            Ви ще не є членом жодної спільноти
          </h3>
        </div>
        <p className="text-sm text-slate-600">
          У системі доступні дві дії: створити свою спільноту або приєднатися до
          існуючої за запрошенням голови правління.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-brand-600" />
              <h4 className="font-medium text-slate-900">Створити свою спільноту</h4>
            </div>
            <p className="text-sm text-slate-600">
              Творець спільноти автоматично стає головою правління та може налаштовувати
              тарифи, додавати приміщення та учасників.
            </p>
            <Button onClick={onCreate}>
              <Plus size={16} />
              Створити спільноту
            </Button>
          </div>
          <div className="border border-slate-200 rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-brand-600" />
              <h4 className="font-medium text-slate-900">Приєднатися до існуючої</h4>
            </div>
            <p className="text-sm text-slate-600">
              Передайте голові правління вашого ОСББ вашу електронну пошту — він
              додасть вас як мешканця і прикріпить до приміщення.
            </p>
            <p className="text-xs text-slate-500">
              Після того, як вас додадуть, спільнота з'явиться у цьому списку.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
