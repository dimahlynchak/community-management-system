import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <Building2 className="text-slate-400" size={48} />
      <h2 className="text-2xl font-semibold text-slate-900">Сторінку не знайдено</h2>
      <p className="text-sm text-slate-600 max-w-md">
        Запитувана сторінка не існує або була видалена.
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Повернутися на головну
      </Link>
    </div>
  );
}
