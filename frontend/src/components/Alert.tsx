import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface Props {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const toneStyles: Record<Tone, { container: string; icon: string; Icon: typeof Info }> = {
  info: {
    container: 'bg-brand-50 border-brand-200 text-brand-900',
    icon: 'text-brand-600',
    Icon: Info,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: 'text-amber-600',
    Icon: AlertCircle,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: 'text-red-600',
    Icon: XCircle,
  },
};

export default function Alert({ tone = 'info', title, children, className = '' }: Props) {
  const { container, icon, Icon } = toneStyles[tone];
  return (
    <div
      className={`flex gap-3 px-4 py-3 border rounded-md ${container} ${className}`}
      role="alert"
    >
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${icon}`} />
      <div className="text-sm space-y-0.5">
        {title && <div className="font-medium">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
