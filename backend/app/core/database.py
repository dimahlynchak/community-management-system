from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Базовий клас для всіх SQLAlchemy моделей."""
    pass


def get_db():
    """Dependency для отримання сесії БД у FastAPI ендпоінтах."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()