import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import Button from '../components/Button';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">
          Вітаємо, {user?.full_name?.split(' ')[1] ?? user?.full_name}!
        </h2>
        <p className="text-slate-600 mt-1 text-sm">
          Система автоматизації фінансового та адміністративного управління
          житловою спільнотою.
        </p>
      </header>

      <section className="card max-w-2xl">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Building2 className="text-brand-600" size={20} />
            <h3 className="text-base font-semibold text-slate-900">Спільноти</h3>
          </div>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-600">
            Перейдіть до списку спільнот, у яких ви маєте роль, або створіть нову
            спільноту. Творець спільноти автоматично стає головою правління та
            отримує повний набір повноважень.
          </p>
          <Button onClick={() => navigate('/communities')}>
            До списку спільнот
            <ChevronRight size={16} />
          </Button>
        </div>
      </section>
    </div>
  );
}
