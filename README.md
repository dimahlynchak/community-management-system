# Клієнт-серверна система управління процесами житлової спільноти

Бакалаврський дипломний проєкт. Веб-застосунок для автоматизації фінансового
та адміністративного управління ОСББ, керуючими компаніями та котеджними
містечками. Поєднує ієрархічне рольове розмежування доступу (RBAC) із
криптографічно захищеним журналом аудиту на основі ланцюжка хешів SHA-256.

КПІ ім. Ігоря Сікорського · ФІОТ · кафедра обчислювальної техніки · 2026 р.

---

## Ключові можливості

### Підсистема рольового доступу (RBAC)
- Ієрархічна модель: `resident → technician → accountant → head`
- Перевірка дозволів community-scoped — голова однієї спільноти не має
  жодних привілеїв в іншій
- Засновник спільноти (поле `founder_user_id`) захищений від видалення;
  передача засновництва — окремим ендпоінтом із журналюванням
- 13 атомарних дозволів (`payments:create`, `audit:read`, `units:manage`,
  `community:manage` тощо), що завантажуються через Alembic data migration

### Журнал аудиту з контролем цілісності
- Кожен запис містить SHA-256 від попереднього (hash chain) — будь-яка
  модифікація виявляється при верифікації
- Захист **в глибину**: на рівні СУБД працює тригер `prevent_audit_modification`,
  що блокує `UPDATE`/`DELETE` на `audit_log`; на рівні застосунку ланцюжок
  хешів виявляє втручання у разі обходу тригера
- Серіалізація доступу до ланцюжка через `pg_advisory_xact_lock` (гарантовано
  коректний хеш при паралельних записах)
- Потокова верифікація через `yield_per(1000)` — придатна для журналів від
  десятків тисяч записів
- Фіксація подій безпеки: `LOGIN`, `LOGIN_FAILED`, `ACCESS_DENIED`,
  `ASSIGN_ROLE`, `PASSWORD_RESET`

### Фінансовий модуль
- Три методи розрахунку нарахувань: `per_sqm` (за площею), `fixed` (фіксована
  сума), `share` (рівний розподіл за алгоритмом найбільшого залишку — копієчна
  асиметрія між приміщеннями не перевищує 0,01 грн)
- Автоматичний FIFO-розподіл оплати між непогашеними нарахуваннями
  з `SELECT … FOR UPDATE` для багатоінстансових середовищ
- Ідемпотентність масового нарахування через `UNIQUE(unit_id, charge_type_id, period)`
- Боргова відомість через груповий запит (без N+1)
- Розрахунок пені з валідацією верхньої межі `MAX_DAILY_PENALTY_RATE`
  відповідно до Закону № 543/96-ВР
- Експорт у XLSX (openpyxl) і PDF (fpdf2)

### Автентифікація
- Пара JWT: access-токен 15 хв (в оперативній пам'яті клієнта), refresh-токен
  7 діб у httpOnly cookie з прапорцями `Secure` та `SameSite=Strict`
- Refresh-токени зберігаються у БД у вигляді SHA-256-хешу з ротацією
  при кожному оновленні
- Зміна пароля відкликає всі активні сесії
- Single-flight refresh на клієнті: одночасні 401-відповіді не призводять
  до множинних refresh-викликів

---

## Стек технологій

**Backend:** Python 3.11, FastAPI 0.115, SQLAlchemy 2.0, Alembic, PostgreSQL 14, bcrypt, python-jose (JWT), openpyxl, fpdf2

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios

**Тестування:** pytest, pytest-cov, FastAPI TestClient (SQLite in-memory)

---

## Швидкий старт

### Передумови

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Git

### 1. Клонування та залежності

```bash
git clone https://github.com/dimahlynchak/community-management-system.git
cd community-management-system

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Налаштування .env

Скопіюйте приклад і відредагуйте під свою БД:

```bash
cd backend
cp .env.example .env
```

Обов'язкові параметри:

| Параметр | Опис |
|---|---|
| `DATABASE_URL` | Рядок підключення PostgreSQL (`postgresql://user:pass@host:5432/db`) |
| `SECRET_KEY` | Секрет для підпису JWT-токенів (мінімум 32 байти випадкових даних) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Термін дії access-токена (за замовчуванням 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Термін дії refresh-токена (за замовчуванням 7) |
| `COOKIE_SECURE` | `true` у проді з HTTPS; `false` для локального HTTP |
| `COOKIE_SAMESITE` | `strict` / `lax` / `none` |
| `PENALTY_DAILY_RATE` | Базова добова ставка пені (за замовчуванням 0,001) |
| `MAX_DAILY_PENALTY_RATE` | Верхня межа добової ставки пені відповідно до Закону |

### 3. Створення БД та міграції

```bash
createdb community_db        # або через psql / pgAdmin
cd backend
alembic upgrade head
```

Буде застосовано 12 міграцій: створення схеми, тригери цілісності
(`check_ucr_unit_community`, `check_charge_community`, `prevent_audit_modification`),
довідник ролей і дозволів, м'яке видалення, ротація refresh-токенів,
захист засновника.

### 4. Запуск

```bash
# Термінал 1 — backend
cd backend
uvicorn app.main:app --reload --port 8000

# Термінал 2 — frontend
cd frontend
npm run dev
```

- API: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>
- SPA: <http://localhost:5173>

### 5. Реєстрація першого користувача

Через UI на `/register` або POST `/api/auth/register`. Перша створена спільнота
автоматично призначає автору роль `head` і фіксує його як засновника.

---

## Тестування

```bash
cd backend
pytest                                   # запуск усіх тестів
pytest --cov=app --cov-report=term-missing   # з покриттям
pytest tests/test_audit.py -v            # окремий модуль
```

Поточне покриття сервісного шару:

| Модуль | Покриття |
|---|---|
| `app/services/audit.py` | 94 % |
| `app/services/role.py` | 56 % |
| `app/services/finance.py` | 42 % |

Тести виконуються ізольовано на SQLite in-memory через фікстуру `conftest.py`;
JSONB-колонки автоматично замінюються на JSON-аналог для сумісності.

---

## Бенчмарки

```bash
cd backend
python scripts/seed_benchmark.py --units 200 --months 12
python scripts/benchmark_balance.py
python scripts/benchmark_penalty.py
python scripts/benchmark_fifo.py
python scripts/benchmark_audit_verify.py
```

Скрипти генерують тестові дані заданого розміру та вимірюють медіанний час
відповіді API за 5 запусків. Результати для типового ОСББ (200 приміщень)
наведено в розділі 4.1 пояснювальної записки.

---

## Перевірка цілісності журналу аудиту

```bash
curl -X GET http://localhost:8000/api/audit/verify \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Відповідь:

```json
{
  "valid": true,
  "total_records": 1247,
  "duration_ms": 38.4,
  "broken_at_id": null
}
```

У разі виявлення розриву ланцюжка `valid=false` і `broken_at_id` вказують
ідентифікатор першого пошкодженого запису.

---

## API-документація

Інтерактивна документація OpenAPI генерується автоматично з Pydantic-схем
і анотацій FastAPI. Доступна за двома адресами:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

Усього 51 ендпоінт у 6 модулях: `auth`, `communities`, `finances`, `roles`,
`announcements`, `audit`.

---

## Безпека

- Паролі хешуються `bcrypt` з cost-factor 12 (приблизно 250 мс на верифікацію)
- Refresh-токени у БД зберігаються лише як SHA-256-хеш
- Усі захищені ендпоінти проходять через `Depends(require_permission(...))`
  або `Depends(require_membership)` — захист неможливо обійти випадково
- Цілісність даних на рівні СУБД через тригери та `UNIQUE`-обмеження
- Refresh у httpOnly cookie захищає від XSS; SameSite=Strict — від CSRF

---

## Автор

**Глинчак Дмитро Дмитрович**, гр. ІО-25
ФІОТ, кафедра обчислювальної техніки, КПІ ім. Ігоря Сікорського

Керівник: ас. Мельник Назар Андрійович

---