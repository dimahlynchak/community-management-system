import { NavLink } from 'react-router-dom';
import { Home, Building2 } from 'lucide-react';

interface Item {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}

const items: Item[] = [
  { to: '/', label: 'Головна', icon: Home, end: true },
  { to: '/communities', label: 'Спільноти', icon: Building2 },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-white border-r border-slate-200 py-4 flex-shrink-0 min-h-[calc(100vh-3.5rem)]">
      <nav>
        <ul className="space-y-1 px-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
