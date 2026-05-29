import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

_EDRPOU_RE = re.compile(r"^\d{8}$")


class CommunityCreate(BaseModel):
    name: str
    address: str
    edrpou: str | None = None

    @field_validator("name", "address")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field must not be empty")
        return v

    @field_validator("edrpou")
    @classmethod
    def _validate_edrpou(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not _EDRPOU_RE.match(v):
            raise ValueError("edrpou must be exactly 8 digits")
        return v


class CommunityUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    edrpou: str | None = None

    @field_validator("name", "address")
    @classmethod
    def _non_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("field must not be empty")
        return v

    @field_validator("edrpou")
    @classmethod
    def _validate_edrpou(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not _EDRPOU_RE.match(v):
            raise ValueError("edrpou must be exactly 8 digits")
        return v


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

    @field_validator("number", "type")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field must not be empty")
        return v

    @field_validator("area")
    @classmethod
    def _validate_area(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("area must be > 0")
        return v


class UnitUpdate(BaseModel):
    number: str | None = None
    type: str | None = None
    area: Decimal | None = None
    floor: int | None = None

    @field_validator("number", "type")
    @classmethod
    def _non_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("field must not be empty")
        return v

    @field_validator("area")
    @classmethod
    def _validate_area(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("area must be > 0")
        return v


class UnitResponse(BaseModel):
    id: int
    community_id: int
    number: str
    type: str
    area: Decimal
    floor: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
