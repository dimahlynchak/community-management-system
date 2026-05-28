import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { extractErrorMessage } from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Alert from '../../components/Alert';

interface LocationState {
  from?: { pathname: string };
  registered?: boolean;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;
  const from = state?.from?.pathname ?? '/';
  const justRegistered = state?.registered === true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Неправильна електронна пошта або пароль'));
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
              Вхід у систему
            </h1>
            <p className="text-sm text-slate-600">
              Система управління процесами житлової спільноти
            </p>
          </div>

          {justRegistered && (
            <Alert tone="success" title="Реєстрація успішна">
              Тепер увійдіть у систему за створеними обліковими даними.
            </Alert>
          )}

          {error && (
            <Alert tone="error" title="Не вдалося увійти">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Input
              id="password"
              type="password"
              label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Вхід…' : 'Увійти'}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600">
            Немає облікового запису?{' '}
            <Link
              to="/register"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Зареєструватися
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
