from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Схема реєстрації нового користувача."""
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None


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