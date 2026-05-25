import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

_PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_VALID_METHODS = {"per_sqm", "fixed", "share"}


# --- ChargeTypes ---

class ChargeTypeCreate(BaseModel):
    name: str
    calculation_method: str  # per_sqm / fixed / share
    rate: Decimal

    @field_validator("calculation_method")
    @classmethod
    def _validate_method(cls, v: str) -> str:
        if v not in _VALID_METHODS:
            raise ValueError(f"calculation_method must be one of {sorted(_VALID_METHODS)}")
        return v

    @field_validator("rate")
    @classmethod
    def _validate_rate(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("rate must be >= 0")
        return v


class ChargeTypeResponse(BaseModel):
    id: int
    community_id: int
    name: str
    calculation_method: str
    rate: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Charges ---

class ChargeCreate(BaseModel):
    charge_type_id: int
    period: str  # YYYY-MM

    @field_validator("period")
    @classmethod
    def _validate_period(cls, v: str) -> str:
        if not _PERIOD_RE.match(v):
            raise ValueError("period must be in format YYYY-MM")
        return v


class ChargeResponse(BaseModel):
    id: int
    unit_id: int
    charge_type_id: int
    period: str
    amount: Decimal
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Payments ---

class PaymentCreate(BaseModel):
    unit_id: int
    amount: Decimal
    payment_date: date
    description: str | None = None

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be > 0")
        return v


class PaymentResponse(BaseModel):
    id: int
    unit_id: int
    amount: Decimal
    payment_date: date
    description: str | None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- BudgetItems ---

class BudgetItemCreate(BaseModel):
    period: str
    category: str
    planned_amount: Decimal | None = None
    actual_amount: Decimal | None = None
    description: str | None = None
    document_ref: str | None = None

    @field_validator("period")
    @classmethod
    def _validate_period(cls, v: str) -> str:
        if not _PERIOD_RE.match(v):
            raise ValueError("period must be in format YYYY-MM")
        return v

    @field_validator("category")
    @classmethod
    def _validate_category(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("category must not be empty")
        return v

    @field_validator("planned_amount", "actual_amount")
    @classmethod
    def _validate_amounts(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("amount must be >= 0")
        return v


class BudgetItemResponse(BaseModel):
    id: int
    community_id: int
    period: str
    category: str
    planned_amount: Decimal | None
    actual_amount: Decimal | None
    description: str | None
    document_ref: str | None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Allocations ---

class AllocationResponse(BaseModel):
    id: int
    payment_id: int
    charge_id: int
    amount: Decimal

    model_config = {"from_attributes": True}


# --- Balance ---

class UnitBalanceResponse(BaseModel):
    unit_id: int
    unit_number: str
    unit_type: str
    total_charged: Decimal
    total_paid: Decimal
    balance: Decimal  # positive = debt


# --- Penalties ---

class UnitPenaltyResponse(BaseModel):
    unit_id: int
    unit_number: str
    charge_id: int
    period: str
    debt: Decimal
    overdue_days: int
    rate: Decimal
    penalty: Decimal