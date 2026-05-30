import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ScrollText,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import { exportAuditLog, listAuditLog, verifyAuditChain } from '../../api/audit';
import { downloadBlob } from '../../utils/download';
import { listMembers } from '../../api/roles';
import { extractErrorMessage } from '../../api/client';
import type {
  AuditAction,
  AuditLogEntry,
  AuditVerifyResponse,
  RoleName,
  UserRoleResponse,
} from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { formatDateTime } from '../../utils/format';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

const ACTION_OPTIONS: { value: '' | AuditAction; label: string }[] = [
  { value: '', label: 'Усі дії' },
  { value: 'CREATE', label: 'CREATE — створення' },
  { value: 'UPDATE', label: 'UPDATE — оновлення' },
  { value: 'DELETE', label: 'DELETE — видалення' },
  { value: 'LOGIN', label: 'LOGIN — вхід' },
  { value: 'LOGOUT', label: 'LOGOUT — вихід' },
  { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED — невдалий вхід' },
  { value: 'ACCESS_DENIED', label: 'ACCESS_DENIED — відмова' },
  { value: 'ASSIGN_ROLE', label: 'ASSIGN_ROLE — призначення ролі' },
  { value: 'REMOVE_ROLE', label: 'REMOVE_ROLE — зняття ролі' },
];

const RESOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Усі ресурси' },
  { value: 'community', label: 'community — спільнота' },
  { value: 'unit', label: 'unit — приміщення' },
  { value: 'role', label: 'role — роль/членство' },
  { value: 'user', label: 'user — користувач' },
  { value: 'announcement', label: 'announcement — оголошення' },
  { value: 'charge', label: 'charge — нарахування' },
  { value: 'charge_type', label: 'charge_type — тариф' },
  { value: 'payment', label: 'payment — платіж' },
  { value: 'budget_item', label: 'budget_item — стаття бюджету' },
  { value: 'auth', label: 'auth — автентифікація' },
  { value: 'permission', label: 'permission — дозволи' },
  { value: 'membership', label: 'membership — членство' },
];

const ACTION_TONE: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border border-red-200',
  LOGIN: 'bg-slate-100 text-slate-700 border border-slate-200',
  LOGOUT: 'bg-slate-100 text-slate-700 border border-slate-200',
  LOGIN_FAILED: 'bg-amber-50 text-amber-700 border border-amber-200',
  ACCESS_DENIED: 'bg-amber-50 text-amber-700 border border-amber-200',
  ASSIGN_ROLE: 'bg-violet-50 text-violet-700 border border-violet-200',
  REMOVE_ROLE: 'bg-violet-50 text-violet-700 border border-violet-200',
};

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000];

export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [actionFilter, setActionFilter] = useState<'' | AuditAction>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [members, setMembers] = useState<UserRoleResponse[]>([]);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResponse | null>(null);
  const [detailFor, setDetailFor] = useState<AuditLogEntry | null>(null);

  const canRead = hasPermission(myRole, 'audit:read');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listAuditLog({
        community_id: communityId,
        action: actionFilter || null,
        resource: resourceFilter || null,
        limit,
        offset,
      });
      setEntries(page.items);
      setTotal(page.total);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити журнал аудиту'));
    } finally {
      setLoading(false);
    }
  }, [communityId, actionFilter, resourceFilter, limit, offset]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    (async () => {
      try {
        const ms = await listMembers(communityId);
        setMembers(ms);
        const me = ms.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // якщо немає доступу до members — однак показуємо повідомлення про дозвіл
      } finally {
        setMembershipLoaded(true);
      }
    })();
  }, [communityId, user?.id]);

  // При зміні фільтрів повертаємось на першу сторінку
  useEffect(() => {
    setOffset(0);
  }, [actionFilter, resourceFilter, limit]);

  useEffect(() => {
    if (membershipLoaded && canRead) {
      void load();
    }
  }, [membershipLoaded, canRead, load]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    try {
      const blob = await exportAuditLog(communityId, format);
      downloadBlob(blob, `audit_${communityId}.${format}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося експортувати журнал'));
    } finally {
      setExporting(null);
    }
  };

  const usersById = useMemo(() => {
    const map = new Map<number, { full_name: string; email: string }>();
    for (const m of members) {
      map.set(m.user_id, { full_name: m.user.full_name, email: m.user.email });
    }
    return map;
  }, [members]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyAuditChain();
      setVerifyResult(res);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося перевірити цілісність ланцюга'));
    } finally {
      setVerifying(false);
    }
  };

  if (!membershipLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Завантаження…" />
      </div>
    );
  }

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
          Перегляд журналу аудиту доступний лише голові правління (дозвіл{' '}
          <code>audit:read</code>).
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
          <h2 className="text-2xl font-semibold text-slate-900">Журнал аудиту</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Незмінний журнал усіх дій у спільноті з криптографічним ланцюгом хешів
            (SHA-256). Запис можна додати, але не змінити чи видалити — це гарантує
            доказовість для перевірки.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('csv')}
            disabled={exporting !== null}
            title="Завантажити весь журнал у CSV"
          >
            <Download size={14} />
            {exporting === 'csv' ? 'CSV…' : 'CSV'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport('xlsx')}
            disabled={exporting !== null}
            title="Завантажити весь журнал у XLSX"
          >
            <Download size={14} />
            {exporting === 'xlsx' ? 'XLSX…' : 'XLSX'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleVerify()}
            disabled={verifying}
            title="Перерахувати hash chain для всіх записів"
          >
            <ShieldCheck size={14} />
            {verifying ? 'Перевірка…' : 'Перевірити ланцюг'}
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {verifyResult && (
        <Alert
          tone={verifyResult.valid ? 'success' : 'error'}
          title={
            verifyResult.valid
              ? 'Ланцюг цілісний'
              : 'Виявлено порушення ланцюга'
          }
        >
          {verifyResult.valid ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>
                Перераховано {verifyResult.total} записів, усі hash-и збігаються.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ShieldOff size={16} className="text-red-600" />
              <span>
                Цілісність порушено на записі id={' '}
                <code className="font-mono">{verifyResult.broken_at_id ?? '?'}</code>.
                Перевірено {verifyResult.total} записів.
              </span>
            </div>
          )}
        </Alert>
      )}

      <section className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <ScrollText className="text-brand-600" size={18} />
            <h3 className="text-base font-semibold text-slate-900">
              Записи{entries && total > 0
                ? ` (${offset + 1}–${Math.min(offset + entries.length, total)} з ${total})`
                : ''}
            </h3>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-1">
              <label
                htmlFor="action_filter"
                className="block text-sm font-medium text-slate-700"
              >
                Дія
              </label>
              <select
                id="action_filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as '' | AuditAction)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-64 space-y-1">
              <label
                htmlFor="resource_filter"
                className="block text-sm font-medium text-slate-700"
              >
                Ресурс
              </label>
              <select
                id="resource_filter"
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {RESOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32 space-y-1">
              <label
                htmlFor="limit_filter"
                className="block text-sm font-medium text-slate-700"
              >
                Записів
              </label>
              <select
                id="limit_filter"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Завантаження…' : 'Оновити'}
            </Button>
            {(actionFilter || resourceFilter) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActionFilter('');
                  setResourceFilter('');
                }}
              >
                Скинути фільтри
              </Button>
            )}
          </div>

          {entries === null ? (
            <Spinner label="Завантаження…" />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Записів не знайдено"
              description="За обраних фільтрів у журналі немає записів. Спробуйте інший ресурс або дію, або збільшіть кількість записів."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Час</th>
                    <th className="text-left px-3 py-2 font-medium">Користувач</th>
                    <th className="text-left px-3 py-2 font-medium">Дія</th>
                    <th className="text-left px-3 py-2 font-medium">Ресурс</th>
                    <th className="text-left px-3 py-2 font-medium">IP</th>
                    <th className="text-right px-3 py-2 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => {
                    const usr = e.user_id ? usersById.get(e.user_id) : null;
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => setDetailFor(e)}
                      >
                        <td className="px-3 py-2 text-slate-500 tabular-nums">
                          {e.id}
                        </td>
                        <td className="px-3 py-2 text-slate-700 tabular-nums whitespace-nowrap">
                          {formatDateTime(e.timestamp)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {usr ? (
                            <div>
                              <div className="font-medium text-slate-900">
                                {usr.full_name}
                              </div>
                              <div className="text-xs text-slate-500">{usr.email}</div>
                            </div>
                          ) : e.user_id ? (
                            <span className="text-slate-500">user #{e.user_id}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              ACTION_TONE[e.action] ??
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <code className="text-xs">{e.resource}</code>
                          {e.resource_id !== null && (
                            <span className="text-slate-400 ml-1 tabular-nums">
                              #{e.resource_id}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">
                          {e.ip_address ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <code className="text-xs text-slate-500 font-mono">
                            {e.hash.slice(0, 8)}…
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {entries && total > limit && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 tabular-nums">
                Сторінка {Math.floor(offset / limit) + 1} з{' '}
                {Math.max(1, Math.ceil(total / limit))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0 || loading}
                >
                  <ChevronLeft size={14} />
                  Попередня
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total || loading}
                >
                  Наступна
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={detailFor !== null}
        onClose={() => setDetailFor(null)}
        title={detailFor ? `Запис #${detailFor.id}` : 'Запис аудиту'}
        maxWidth="lg"
      >
        {detailFor && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Час
                </div>
                <div className="text-slate-900 tabular-nums">
                  {formatDateTime(detailFor.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Дія
                </div>
                <div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      ACTION_TONE[detailFor.action] ??
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {detailFor.action}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Користувач
                </div>
                <div className="text-slate-900">
                  {detailFor.user_id
                    ? usersById.get(detailFor.user_id)?.full_name ??
                      `user #${detailFor.user_id}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  IP
                </div>
                <div className="text-slate-900 tabular-nums">
                  {detailFor.ip_address ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Ресурс
                </div>
                <div className="text-slate-900">
                  <code>{detailFor.resource}</code>
                  {detailFor.resource_id !== null && (
                    <span className="ml-1 text-slate-500 tabular-nums">
                      #{detailFor.resource_id}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Спільнота
                </div>
                <div className="text-slate-900 tabular-nums">
                  {detailFor.community_id ?? '—'}
                </div>
              </div>
            </div>

            {detailFor.details && Object.keys(detailFor.details).length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Деталі
                </div>
                <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs overflow-x-auto">
                  {JSON.stringify(detailFor.details, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Hash chain
              </div>
              <div className="space-y-1 text-xs font-mono break-all">
                <div>
                  <span className="text-slate-500">previous: </span>
                  <span className="text-slate-700">{detailFor.previous_hash}</span>
                </div>
                <div>
                  <span className="text-slate-500">hash:&nbsp;&nbsp;&nbsp;&nbsp; </span>
                  <span className="text-slate-900">{detailFor.hash}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {verifyResult === null && !verifying && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <XCircle size={12} />
          Ланцюг ще не перевірено в цій сесії.
        </div>
      )}
    </div>
  );
}
