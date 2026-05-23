from datetime import datetime

from pydantic import BaseModel


class RoleResponse(BaseModel):
    id: int
    name: str
    display_name: str

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    user_id: int
    role_name: str  # head / accountant / technician / resident
    unit_id: int | None = None


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    community_id: int
    role_id: int
    unit_id: int | None
    assigned_at: datetime
    role: RoleResponse

    model_config = {"from_attributes": True}