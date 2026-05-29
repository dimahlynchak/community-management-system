import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="text-slate-500" size={24} />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 mt-1 max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
