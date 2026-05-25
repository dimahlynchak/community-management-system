from datetime import datetime

from pydantic import BaseModel, field_validator

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


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    community_id: int
    role_id: int
    unit_id: int | None
    assigned_at: datetime
    role: RoleResponse

    model_config = {"from_attributes": True}