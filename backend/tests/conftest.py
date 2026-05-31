"""Pytest-фікстури: ізольована SQLite-БД у памʼяті для кожного тесту.

Стратегія:
- На кожен тест створюється чистий SQLite engine, метадані SQLAlchemy
  розгортають усі таблиці моделей (без міграцій), сідаються 4 базові ролі.
- JSONB-тип з psycopg2.dialects.postgresql замінено на загальний JSON
  для сумісності з SQLite — це дозволяє тестувати сервісний шар без
  розгортання Postgres у CI.
- Тригери Postgres (insert-only на audit_log тощо) у тестах не діють —
  їхня семантика валідується окремо інтеграційними тестами на Postgres.
"""
import os

# Налаштування середовища ДО будь-яких імпортів з app/
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-only-for-pytest")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("COOKIE_SAMESITE", "lax")

# JSONB → JSON для SQLite. Робиться ДО імпорту моделей, інакше колонки
# вже зареєструються з postgres-специфічним типом.
import sqlalchemy.dialects.postgresql as _pg
from sqlalchemy import JSON as _GenericJSON

_pg.JSONB = _GenericJSON

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Імпорти моделей — повинні йти ПІСЛЯ monkey-patch JSONB вище,
# щоб таблиці зареєструвалися з правильним типом
from app.core.database import Base  # noqa: E402
from app.models.user import User  # noqa: E402,F401
from app.models.role import Role  # noqa: E402
from app.models.community import Community  # noqa: E402,F401
from app.models.unit import Unit  # noqa: E402,F401
from app.models.user_community_role import UserCommunityRole  # noqa: E402,F401
from app.models.charge import ChargeType, Charge  # noqa: E402,F401
from app.models.payment import Payment  # noqa: E402,F401
from app.models.payment_allocation import PaymentAllocation  # noqa: E402,F401
from app.models.budget import BudgetItem  # noqa: E402,F401
from app.models.announcement import Announcement  # noqa: E402,F401
from app.models.audit import AuditLog  # noqa: E402,F401
from app.models.refresh_token import RefreshToken  # noqa: E402,F401


def _enable_sqlite_fk(dbapi_connection, _):
    """SQLite за замовчуванням не перевіряє foreign keys — вмикаємо."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


@pytest.fixture()
def db_session():
    """Чиста SQLite-БД на кожен тест. Швидко через :memory:."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    event.listen(engine, "connect", _enable_sqlite_fk)
    Base.metadata.create_all(engine)

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()

    # Сід ролей: фіксована ієрархія resident → technician → accountant → head,
    # відповідає реальній міграції 6e630ee59d9d_seed_roles_and_permissions.
    roles = [
        Role(id=1, name="resident", display_name="Мешканець", parent_role_id=None),
        Role(id=2, name="technician", display_name="Технічний працівник", parent_role_id=1),
        Role(id=3, name="accountant", display_name="Бухгалтер", parent_role_id=2),
        Role(id=4, name="head", display_name="Голова правління", parent_role_id=3),
    ]
    for r in roles:
        session.add(r)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def head_user(db_session):
    """Тестовий користувач — голова правління."""
    from app.core.security import hash_password
    user = User(
        email="head@test.local",
        password_hash=hash_password("Head1234"),
        full_name="Test Head",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def community(db_session, head_user):
    """Спільнота, у якій head_user — засновник."""
    c = Community(
        name="Test Community",
        address="вул. Тестова, 1",
        founder_user_id=head_user.id,
        is_active=True,
    )
    db_session.add(c)
    db_session.commit()
    return c


@pytest.fixture()
def unit(db_session, community):
    """Базове приміщення у спільноті."""
    from decimal import Decimal
    u = Unit(
        community_id=community.id,
        number="1",
        type="flat",
        area=Decimal("50.00"),
        floor=1,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u
