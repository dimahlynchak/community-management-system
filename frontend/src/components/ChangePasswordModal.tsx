import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import { changePassword } from '../api/auth';
import { extractErrorMessage } from '../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangePasswordModal({ open, onClose, onSuccess }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Підтвердження не збігається з новим паролем');
      return;
    }
    setBusy(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося змінити пароль'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Зміна паролю">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <Input
          id="old_password"
          type="password"
          label="Поточний пароль"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Input
          id="new_password"
          type="password"
          label="Новий пароль"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          hint="Мінімум 8 символів, повинен містити літери та цифри"
        />
        <Input
          id="confirm_password"
          type="password"
          label="Підтвердження нового паролю"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-slate-500">
          Після успішної зміни всі активні сесії на інших пристроях буде завершено
          — вам доведеться повторно увійти.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Змінюємо…' : 'Змінити пароль'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
