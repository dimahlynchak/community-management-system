import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LogOut } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import Button from './Button';

export default function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Building2 className="text-brand-600" size={24} />
        <h1 className="text-base font-semibold text-slate-900">
          ОСББ — система управління
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm leading-tight">
          <div className="font-medium text-slate-900">{user?.full_name}</div>
          <div className="text-xs text-slate-500">{user?.email}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          disabled={busy}
        >
          <LogOut size={14} />
          Вийти
        </Button>
      </div>
    </header>
  );
}
