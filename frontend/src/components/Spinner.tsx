import { Loader2 } from 'lucide-react';

interface Props {
  label?: string;
  size?: number;
}

export default function Spinner({ label, size = 20 }: Props) {
  return (
    <div className="inline-flex items-center gap-2 text-slate-600">
      <Loader2 className="animate-spin" size={size} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
