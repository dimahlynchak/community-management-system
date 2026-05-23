from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


# --- ChargeTypes ---

class ChargeTypeCreate(BaseModel):
    name: str
    calculation_method: str  # per_sqm / fixed / share
    rate: Decimal


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