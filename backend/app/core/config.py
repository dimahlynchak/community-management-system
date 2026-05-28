from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Конфігурація застосунку з .env файлу."""

    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ALGORITHM: str = "HS256"

    # Безпека refresh-cookie. У проді True/strict; для локального HTTP можна
    # виставити COOKIE_SECURE=false у .env, інакше браузер не збереже cookie.
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "strict"

    # Penalty rate: default 0.1% per day (can override in .env)
    PENALTY_DAILY_RATE: float = 0.001

    # Верхня межа добової ставки пені згідно з чинним законодавством:
    # 2 × облікова ставка НБУ / 365. Значення оновлюється у .env при зміні ставки НБУ.
    # 0.00137 ≈ 2 × 25% / 365 (приблизно, для облікової ставки НБУ 25%).
    MAX_DAILY_PENALTY_RATE: float = 0.00137

    class Config:
        env_file = ".env"


settings = Settings()