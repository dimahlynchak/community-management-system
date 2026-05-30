import { ReactNode, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Alert from './Alert';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  password: string;
}

export default function PasswordRevealModal({
  open,
  onClose,
  title,
  description,
  password,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // буфер обміну може бути заблокований; пароль все одно видно
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{description}</p>
        <Alert tone="warning" title="Цей пароль показано один раз">
          Збережіть або скопіюйте його зараз — після закриття вікна повторно
          переглянути буде неможливо. Сервер зберігає лише хеш.
        </Alert>
        <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-3 flex items-center justify-between gap-3">
          <code className="text-base font-semibold tracking-wide text-slate-900 select-all">
            {password}
          </code>
          <Button size="sm" variant="secondary" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Скопійовано' : 'Копіювати'}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Передайте пароль учаснику особисто або у захищеному месенджері. Юзер
          повинен одразу змінити його на власний у розділі «Профіль і безпека».
        </p>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Готово</Button>
        </div>
      </div>
    </Modal>
  );
}
