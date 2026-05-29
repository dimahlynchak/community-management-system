import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { register as apiRegister } from '../../api/auth';
import { extractErrorMessage } from '../../api/client';
import { composePhone, DEFAULT_COUNTRY_CODE } from '../../data/countryCodes';
import Button from '../../components/Button';
import Input from '../../components/Input';
import PhoneInput from '../../components/PhoneInput';
import Alert from '../../components/Alert';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const phone = phoneDigits ? composePhone(countryCode, phoneDigits) : undefined;
      await apiRegister({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(extractErrorMessage(err, 'Не вдалося створити обліковий запис'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="card w-full max-w-md">
        <div className="card-body space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50">
              <Building2 className="text-brand-600" size={28} />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">
              Створення облікового запису
            </h1>
            <p className="text-sm text-slate-600">
              Після реєстрації ви зможете створити власну спільноту або приєднатися
              до існуючої за запрошенням голови правління.
            </p>
          </div>

          {error && (
            <Alert tone="error" title="Помилка реєстрації">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="full_name"
              type="text"
              label="Повне ім'я"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Іванов Іван Іванович"
            />
            <Input
              id="email"
              type="email"
              label="Електронна пошта"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="example@osbb.ua"
            />
            <PhoneInput
              label="Телефон"
              hint="Необов'язково. Виберіть код країни та введіть номер цифрами"
              countryCode={countryCode}
              digits={phoneDigits}
              onCountryCodeChange={setCountryCode}
              onDigitsChange={setPhoneDigits}
            />
            <Input
              id="password"
              type="password"
              label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              hint="Мінімум 8 символів, повинен містити літери та цифри"
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Створення…' : 'Зареєструватися'}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600">
            Вже маєте обліковий запис?{' '}
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Увійти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
