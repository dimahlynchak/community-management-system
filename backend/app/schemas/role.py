from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import _normalize_phone as _normalize_phone  # noqa: F401

_VALID_ROLES = {"head", "accountant", "technician", "resident"}


class RoleResponse(BaseModel):
    id: int
    name: str
    display_name: str

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    user_id: int
    role_name: str  # head / accountant / technician / resident
    unit_id: int | None = None

    @field_validator("role_name")
    @classmethod
    def _validate_role_name(cls, v: str) -> str:
        if v not in _VALID_ROLES:
            raise ValueError(f"role_name must be one of {sorted(_VALID_ROLES)}")
        return v


class CreateMemberWithUserRequest(BaseModel):
    """Голова створює юзера і одночасно призначає роль у спільноті.
    Пароль генерується сервером і повертається у відповіді один раз — голова
    передає його юзеру поза програмою. Юзер при першому вході має його змінити."""
    email: EmailStr
    full_name: str
    phone: str | None = None
    role_name: str
    unit_id: int | None = None

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("full_name must be at least 2 characters long")
        return v

    @field_validator("role_name")
    @classmethod
    def _validate_role_name(cls, v: str) -> str:
        if v not in _VALID_ROLES:
            raise ValueError(f"role_name must be one of {sorted(_VALID_ROLES)}")
        return v

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str | None) -> str | None:
        from app.schemas.user import _normalize_phone
        return _normalize_phone(v)


class MemberLookupResponse(BaseModel):
    id: int
    full_name: str
    email: str


class PasswordResetResponse(BaseModel):
    """Згенерований пароль для повернення голові один раз. Хеш у БД оновлено,
    усі активні refresh-токени цього юзера відкликані."""
    user_id: int
    new_password: str


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    community_id: int
    role_id: int
    unit_id: int | None
    assigned_at: datetime
    role: RoleResponse

    model_config = {"from_attributes": True}


class CreateMemberWithUserResponse(BaseModel):
    """Дані новоствореного учасника + одноразовий згенерований пароль."""
    membership: UserRoleResponse
    user_id: int
    email: str
    generated_password: str
