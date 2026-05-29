import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import ConfirmDialog from './ConfirmDialog';

export default function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleLogoutConfirm = async () => {
    setBusy(true);
    try {
      await signOut();
      setLogoutOpen(false);
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

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-slate-100"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="text-right text-sm leading-tight">
            <div className="font-medium text-slate-900">{user?.full_name}</div>
            <div className="text-xs text-slate-500">{user?.email}</div>
          </div>
          <ChevronDown size={16} className="text-slate-500" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-56 card overflow-hidden z-20"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserCircle2 size={16} className="text-slate-500" />
              Профіль і безпека
            </button>
            <div className="border-t border-slate-200" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setLogoutOpen(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut size={16} />
              Вийти із системи
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Підтвердження виходу"
        message="Ви дійсно хочете вийти із системи? Поточну сесію буде завершено."
        confirmLabel="Вийти"
        cancelLabel="Скасувати"
        confirmVariant="danger"
        busy={busy}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutOpen(false)}
      />
    </header>
  );
}
