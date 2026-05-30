import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Megaphone, Plus, X } from 'lucide-react';
import {
  createAnnouncement,
  listAnnouncements,
} from '../../api/announcements';
import { getMyMembership } from '../../api/communities';
import { extractErrorMessage } from '../../api/client';
import type { Announcement, RoleName } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatDateTime } from '../../utils/format';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import TextArea from '../../components/TextArea';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function AnnouncementsList() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [items, setItems] = useState<Announcement[] | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await listAnnouncements(communityId);
      setItems(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити оголошення'));
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
        const me = await getMyMembership(communityId);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // ролі без потреби — кнопка створення просто не покажеться
      }
    })();
  }, [communityId, reload, user?.id]);

  const canCreate = hasPermission(myRole, 'announcements:create');

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
          <h2 className="text-2xl font-semibold text-slate-900">Оголошення</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Інформація для мешканців: планові роботи, відключення, протоколи зборів.
            Створюють технічний працівник, бухгалтер або голова правління.
          </p>
        </div>
        {canCreate && !formOpen && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Нове оголошення
          </Button>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {formOpen && (
        <AnnouncementForm
          communityId={communityId}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            void reload();
          }}
        />
      )}

      {items === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : items && items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Megaphone}
            title="Оголошень ще немає"
            description={
              canCreate
                ? 'Створіть перше оголошення — мешканці побачать його у цьому розділі.'
                : 'Тут з’являться повідомлення від технічного працівника, бухгалтера або голови правління.'
            }
            action={
              canCreate ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Нове оголошення
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items!.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FormProps {
  communityId: number;
  onCancel: () => void;
  onCreated: () => void;
}

function AnnouncementForm({ communityId, onCancel, onCreated }: FormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createAnnouncement(communityId, { title: title.trim(), body: body.trim() });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося створити оголошення'));
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Megaphone className="text-brand-600" size={18} />
          <h3 className="text-base font-semibold text-slate-900">Нове оголошення</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Закрити"
        >
          <X size={18} />
        </button>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert tone="error" title="Помилка">
              {error}
            </Alert>
          )}
          <Input
            id="title"
            label="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
            placeholder="Планове відключення води"
          />
          <TextArea
            id="body"
            label="Текст"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={6}
            placeholder="Деталі: дата, причина, тривалість, кого стосується…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>
              Скасувати
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Публікація…' : 'Опублікувати'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <article className="card">
      <div className="card-body">
        <header className="flex items-baseline justify-between gap-4 mb-2">
          <h3 className="text-base font-semibold text-slate-900">
            {announcement.title}
          </h3>
          <time
            dateTime={announcement.created_at}
            className="text-xs text-slate-500 flex-shrink-0 tabular-nums"
          >
            {formatDateTime(announcement.created_at)}
          </time>
        </header>
        <div className="text-sm text-slate-700 whitespace-pre-wrap">
          {announcement.body}
        </div>
      </div>
    </article>
  );
}
