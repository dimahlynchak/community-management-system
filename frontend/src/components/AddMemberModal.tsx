import { FormEvent, useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import PhoneInput from './PhoneInput';
import {
  assignRole,
  createMemberWithUser,
  lookupMember,
} from '../api/roles';
import { extractErrorMessage } from '../api/client';
import { composePhone, DEFAULT_COUNTRY_CODE } from '../data/countryCodes';
import { ROLE_DISPLAY } from '../utils/permissions';
import type {
  MemberLookupResponse,
  RoleName,
  Unit,
} from '../types/api';
import { formatUnitLabel } from '../data/unitTypes';

type Stage = 'email' | 'existing' | 'new' | 'created';

interface Props {
  open: boolean;
  onClose: () => void;
  communityId: number;
  units: Unit[];
  onMembershipCreated: () => void;
  onPasswordGenerated: (email: string, password: string) => void;
}

const ROLE_OPTIONS: RoleName[] = ['resident', 'technician', 'accountant', 'head'];

export default function AddMemberModal({
  open,
  onClose,
  communityId,
  units,
  onMembershipCreated,
  onPasswordGenerated,
}: Props) {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [foundUser, setFoundUser] = useState<MemberLookupResponse | null>(null);
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [roleName, setRoleName] = useState<RoleName>('resident');
  const [unitId, setUnitId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStage('email');
      setEmail('');
      setFoundUser(null);
      setFullName('');
      setCountryCode(DEFAULT_COUNTRY_CODE);
      setPhoneDigits('');
      setRoleName('resident');
      setUnitId('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const found = await lookupMember(communityId, email.trim());
      setFoundUser(found);
      setStage('existing');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setStage('new');
      } else {
        setError(extractErrorMessage(err, 'Помилка пошуку'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAssignExisting = async (e: FormEvent) => {
    e.preventDefault();
    if (!foundUser) return;
    setError(null);
    setBusy(true);
    try {
      await assignRole(communityId, {
        user_id: foundUser.id,
        role_name: roleName,
        unit_id: unitId === '' ? null : unitId,
      });
      onMembershipCreated();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося додати учасника'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNew = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const fullNameTrimmed = fullName.trim();
    if (fullNameTrimmed.length < 2) {
      setError('Вкажіть повне ім’я (мінімум 2 символи)');
      return;
    }
    setBusy(true);
    try {
      const phone = phoneDigits ? composePhone(countryCode, phoneDigits) : undefined;
      const result = await createMemberWithUser(communityId, {
        email: email.trim(),
        full_name: fullNameTrimmed,
        phone: phone || null,
        role_name: roleName,
        unit_id: unitId === '' ? null : unitId,
      });
      onMembershipCreated();
      onPasswordGenerated(result.email, result.generated_password);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося створити учасника'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Додавання учасника" maxWidth="md">
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      {stage === 'email' && (
        <form onSubmit={handleLookup} className="space-y-4">
          <p className="text-sm text-slate-600">
            Введіть електронну пошту учасника. Якщо він уже зареєструвався сам —
            ми його знайдемо і ви оберете роль. Якщо ні — створимо обліковий
            запис та видамо одноразовий пароль.
          </p>
          <Input
            id="email"
            type="email"
            label="Електронна пошта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="example@osbb.ua"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={busy}>
              <Search size={16} />
              {busy ? 'Перевірка…' : 'Перевірити'}
            </Button>
          </div>
        </form>
      )}

      {stage === 'existing' && foundUser && (
        <form onSubmit={handleAssignExisting} className="space-y-4">
          <Alert tone="success" title="Користувача знайдено">
            <div className="font-medium">{foundUser.full_name}</div>
            <div className="text-xs">{foundUser.email}</div>
          </Alert>
          <RolePicker roleName={roleName} onRoleChange={setRoleName} />
          <UnitPicker
            units={units}
            value={unitId}
            onChange={setUnitId}
            required={roleName === 'resident'}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setStage('email')}>
              Назад
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Додавання…' : 'Додати учасника'}
            </Button>
          </div>
        </form>
      )}

      {stage === 'new' && (
        <form onSubmit={handleCreateNew} className="space-y-4">
          <Alert tone="info" title="Користувача з таким email не знайдено">
            Створимо для нього обліковий запис у системі. Згенерований пароль
            покажемо після створення — передайте його учаснику особисто.
          </Alert>
          <Input
            id="email_locked"
            type="email"
            label="Електронна пошта"
            value={email}
            disabled
          />
          <Input
            id="full_name"
            label="Повне ім'я"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Іванов Іван Іванович"
            autoFocus
          />
          <PhoneInput
            label="Телефон"
            hint="Необов'язково"
            countryCode={countryCode}
            digits={phoneDigits}
            onCountryCodeChange={setCountryCode}
            onDigitsChange={setPhoneDigits}
          />
          <RolePicker roleName={roleName} onRoleChange={setRoleName} />
          <UnitPicker
            units={units}
            value={unitId}
            onChange={setUnitId}
            required={roleName === 'resident'}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setStage('email')}>
              Назад
            </Button>
            <Button type="submit" disabled={busy}>
              <UserPlus size={16} />
              {busy ? 'Створення…' : 'Створити і додати'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface RolePickerProps {
  roleName: RoleName;
  onRoleChange: (r: RoleName) => void;
}

function RolePicker({ roleName, onRoleChange }: RolePickerProps) {
  return (
    <div className="space-y-1">
      <label htmlFor="role" className="block text-sm font-medium text-slate-700">
        Роль
      </label>
      <select
        id="role"
        value={roleName}
        onChange={(e) => onRoleChange(e.target.value as RoleName)}
        className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {ROLE_DISPLAY[r]}
          </option>
        ))}
      </select>
    </div>
  );
}

interface UnitPickerProps {
  units: Unit[];
  value: number | '';
  onChange: (v: number | '') => void;
  required?: boolean;
}

function UnitPicker({ units, value, onChange, required }: UnitPickerProps) {
  return (
    <div className="space-y-1">
      <label htmlFor="unit" className="block text-sm font-medium text-slate-700">
        Приміщення {required ? <span className="text-red-600">*</span> : null}
      </label>
      <select
        id="unit"
        value={value === '' ? '' : String(value)}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        required={required}
        className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        <option value="">— не прив'язувати —</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {formatUnitLabel(u)}
          </option>
        ))}
      </select>
      {required && (
        <p className="text-xs text-slate-500">
          Мешканець без прив'язки до приміщення не зможе користуватися особистим
          кабінетом /my-charges
        </p>
      )}
      <p className="text-xs text-slate-500">
        Деактивовані приміщення показано з позначкою — їх можна прив'язати
        колишньому мешканцю для перегляду/погашення історичного боргу.
      </p>
    </div>
  );
}
