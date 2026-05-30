import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Download,
  FileBarChart,
  FileText,
} from 'lucide-react';
import { exportBalance, getBalance } from '../../api/finances';
import { listMembers } from '../../api/roles';
import { extractErrorMessage } from '../../api/client';
import type { RoleName, UnitBalanceResponse } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../utils/permissions';
import { downloadBlob } from '../../utils/download';
import { formatMoney } from '../../utils/format';
import { unitTypeLabel } from '../../data/unitTypes';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';

export default function BalancePage() {
  const { id } = useParams<{ id: string }>();
  const communityId = Number(id);
  const { user } = useAuth();

  const [rows, setRows] = useState<UnitBalanceResponse[] | null>(null);
  const [myRole, setMyRole] = useState<RoleName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getBalance(communityId);
      setRows(
        [...data].sort((a, b) =>
          a.unit_number.localeCompare(b.unit_number, 'uk', { numeric: true }),
        ),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити боргову відомість'));
    }
  }, [communityId]);

  useEffect(() => {
    if (!Number.isFinite(communityId) || communityId <= 0) {
      setError('Невірний ідентифікатор спільноти');
      return;
    }
    void load();
    (async () => {
      try {
        const members = await listMembers(communityId);
        const me = members.find((m) => m.user_id === user?.id);
        setMyRole((me?.role.name as RoleName | undefined) ?? null);
      } catch {
        // без role permissions кнопки експорту не з’являться
      }
    })();
  }, [communityId, load, user?.id]);

  const canExport = hasPermission(myRole, 'reports:generate');

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    try {
      const blob = await exportBalance(communityId, format);
      const filename = `balance_${communityId}.${format}`;
      downloadBlob(blob, filename);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося завантажити файл'));
    } finally {
      setExporting(null);
    }
  };

  const totals = rows
    ? rows.reduce(
        (acc, r) => {
          acc.charged += Number(r.total_charged);
          acc.paid += Number(r.total_paid);
          acc.balance += Number(r.balance);
          return acc;
        },
        { charged: 0, paid: 0, balance: 0 },
      )
    : null;

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
          <h2 className="text-2xl font-semibold text-slate-900">Боргова відомість</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Сальдо по кожному приміщенню: нараховано / оплачено / баланс.
            Додатний баланс — переплата, від’ємний — заборгованість.
          </p>
        </div>
        {canExport && rows && rows.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('xlsx')}
              disabled={exporting !== null}
            >
              <Download size={14} />
              {exporting === 'xlsx' ? 'Збереження…' : 'XLSX'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleExport('pdf')}
              disabled={exporting !== null}
            >
              <FileText size={14} />
              {exporting === 'pdf' ? 'Збереження…' : 'PDF'}
            </Button>
          </div>
        )}
      </header>

      {error && (
        <Alert tone="error" title="Помилка">
          {error}
        </Alert>
      )}

      {rows === null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner label="Завантаження…" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 text-slate-500">
              <FileBarChart size={20} />
              <span className="text-sm">У спільноті немає приміщень для звіту.</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">№</th>
                <th className="text-left px-5 py-3 font-medium">Тип</th>
                <th className="text-right px-5 py-3 font-medium">Нараховано</th>
                <th className="text-right px-5 py-3 font-medium">Оплачено</th>
                <th className="text-right px-5 py-3 font-medium">Баланс</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows!.map((r) => {
                const bal = Number(r.balance);
                const tone =
                  bal > 0
                    ? 'text-emerald-700'
                    : bal < 0
                    ? 'text-red-700'
                    : 'text-slate-700';
                return (
                  <tr key={r.unit_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900 tabular-nums">
                      {r.unit_number}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {unitTypeLabel(r.unit_type)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatMoney(r.total_charged)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatMoney(r.total_paid)}
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${tone}`}>
                      {formatMoney(r.balance)}
                    </td>
                  </tr>
                );
              })}
              {totals && (
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td className="px-5 py-3" colSpan={2}>Разом</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(totals.charged)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(totals.paid)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(totals.balance)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
