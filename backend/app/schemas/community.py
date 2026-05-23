from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CommunityCreate(BaseModel):
    name: str
    address: str
    edrpou: str | None = None


class CommunityUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    edrpou: str | None = None


class CommunityResponse(BaseModel):
    id: int
    name: str
    address: str
    edrpou: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UnitCreate(BaseModel):
    number: str
    type: str
    area: Decimal
    floor: int | None = None


class UnitUpdate(BaseModel):
    number: str | None = None
    type: str | None = None
    area: Decimal | None = None
    floor: int | None = None


class UnitResponse(BaseModel):
    id: int
    community_id: int
    number: str
    type: str
    area: Decimal
    floor: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}