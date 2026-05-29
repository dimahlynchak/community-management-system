import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

_PHONE_RE = re.compile(r"^\+?\d{7,15}$")


def _normalize_phone(v: str | None) -> str | None:
    """Очищує телефон від пробілів і нормалізує до формату +<digits>.
    Приймає значення з або без `+`, валідує лише вміст і довжину."""
    if v is None:
        return v
    v = v.strip()
    if not v:
        return None
    if not _PHONE_RE.match(v):
        raise ValueError(
            "phone must contain 7-15 digits, optionally prefixed with '+'"
        )
    return v if v.startswith("+") else f"+{v}"


def _validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("password must be at least 8 characters long")
    if not any(c.isalpha() for c in v):
        raise ValueError("password must contain at least one letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("password must contain at least one digit")
    return v


class UserCreate(BaseModel):
    """Схема реєстрації нового користувача."""
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("full_name must be at least 2 characters long")
        return v

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str | None) -> str | None:
        return _normalize_phone(v)


class UserUpdate(BaseModel):
    """Схема редагування власних даних користувача (email не змінюється)."""
    full_name: str | None = None
    phone: str | None = None

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("full_name must be at least 2 characters long")
        return v

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str | None) -> str | None:
        return _normalize_phone(v)


class PasswordChangeRequest(BaseModel):
    """Схема зміни власного паролю."""
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserResponse(BaseModel):
    """Схема відповіді з даними користувача."""
    id: int
    email: str
    full_name: str
    phone: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Схема відповіді з токенами."""
    access_token: str
    token_type: str = "bearer"
