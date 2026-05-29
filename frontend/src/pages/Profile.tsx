import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, UserCircle2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { updateMe } from '../api/auth';
import { extractErrorMessage } from '../api/client';
import { composePhone, splitPhone } from '../data/countryCodes';
import Button from '../components/Button';
import Input from '../components/Input';
import PhoneInput from '../components/PhoneInput';
import Alert from '../components/Alert';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function Profile() {
  const { user, refreshUser, signOut } = useAuth();
  const initialPhone = splitPhone(user?.phone);

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [countryCode, setCountryCode] = useState(initialPhone.code);
  const [digits, setDigits] = useState(initialPhone.digits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordChangedNotice, setPasswordChangedNotice] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    const p = splitPhone(user?.phone);
    setCountryCode(p.code);
    setDigits(p.digits);
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const phone = digits ? composePhone(countryCode, digits) : null;
      await updateMe({ full_name: fullName.trim(), phone });
      await refreshUser();
      setSuccess('Зміни збережено');
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося зберегти зміни'));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSuccess = async () => {
    setPasswordModalOpen(false);
    setPasswordChangedNotice(true);
    // Після зміни паролю всі refresh-токени відкликані.
    // Знімаємо локальну сесію щоб користувач увійшов знову.
    setTimeout(() => {
      void signOut();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Профіль</h2>
        <p className="text-slate-600 mt-1 text-sm">
          Редагування власних даних та зміна паролю.
        </p>
      </header>

      {passwordChangedNotice && (
        <Alert tone="success" title="Пароль змінено">
          Завершуємо поточну сесію — потрібно увійти знову з новим паролем.
        </Alert>
      )}

      <section className="card max-w-2xl">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <UserCircle2 className="text-brand-600" size={20} />
            <h3 className="text-base font-semibold text-slate-900">Особисті дані</h3>
          </div>
        </div>
        <div className="card-body">
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          {success && (
            <Alert tone="success" className="mb-4">
              {success}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Електронна пошта"
              value={user?.email ?? ''}
              disabled
              hint="Email не редагується — за потреби зверніться до адміністратора"
            />
            <Input
              id="full_name"
              type="text"
              label="Повне ім'я"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
            <PhoneInput
              label="Телефон"
              hint="Необов'язково. Виберіть код країни та введіть номер цифрами"
              countryCode={countryCode}
              digits={digits}
              onCountryCodeChange={setCountryCode}
              onDigitsChange={setDigits}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Збереження…' : 'Зберегти'}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="card max-w-2xl">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <KeyRound className="text-brand-600" size={20} />
            <h3 className="text-base font-semibold text-slate-900">Безпека</h3>
          </div>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-600">
            Зміна паролю одразу відкликає всі активні сесії на інших пристроях.
          </p>
          <Button variant="secondary" onClick={() => setPasswordModalOpen(true)}>
            <KeyRound size={16} />
            Змінити пароль
          </Button>
        </div>
      </section>

      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={handlePasswordSuccess}
      />
    </div>
  );
}
