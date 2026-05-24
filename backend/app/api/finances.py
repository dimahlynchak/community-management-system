from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission, require_membership
from app.models.user import User
from app.schemas.finance import (
    ChargeTypeCreate, ChargeTypeResponse,
    ChargeCreate, ChargeResponse,
    PaymentCreate, PaymentResponse,
    BudgetItemCreate, BudgetItemResponse,
)
from app.services.finance import (
    create_charge_type, get_charge_types,
    create_charges_for_community, get_charges_by_community,
    create_payment, get_payments_by_unit,
    create_budget_item, get_budget_items,
)
from app.services.community import get_community, get_unit

router = APIRouter(prefix="/api/communities/{community_id}", tags=["finance"])


def _ensure_unit_in_community(db: Session, unit_id: int, community_id: int) -> None:
    unit = get_unit(db, unit_id)
    if unit is None or unit.community_id != community_id:
        raise HTTPException(status_code=404, detail="Unit not found in this community")


# --- ChargeTypes ---

@router.post("/charge-types", response_model=ChargeTypeResponse, status_code=201)
def create_type(
    community_id: int,
    data: ChargeTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charge_types:manage")),
):
    """Створити тип нарахування (тариф)."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return create_charge_type(db, community_id, data)


@router.get("/charge-types", response_model=list[ChargeTypeResponse])
def list_types(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    """Отримати тарифи спільноти."""
    return get_charge_types(db, community_id)


# --- Charges ---

@router.post("/charges", response_model=list[ChargeResponse], status_code=201)
def generate_charges(
    community_id: int,
    data: ChargeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charges:create")),
):
    """Масове нарахування для всіх юнітів спільноти за період."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        return create_charges_for_community(
            db, community_id, data.charge_type_id, data.period, current_user.id,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Charges for this period already exist")


@router.get("/charges", response_model=list[ChargeResponse])
def list_charges(
    community_id: int,
    period: str | None = Query(None, description="Фільтр по періоду (YYYY-MM)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charges:read")),
):
    """Отримати нарахування спільноти (з фільтром по періоду)."""
    return get_charges_by_community(db, community_id, period)


# --- Payments ---

@router.post("/payments", response_model=PaymentResponse, status_code=201)
def add_payment(
    community_id: int,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:create")),
):
    """Зареєструвати оплату."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    _ensure_unit_in_community(db, data.unit_id, community_id)
    return create_payment(db, data, current_user.id)


@router.get("/payments", response_model=list[PaymentResponse])
def list_payments(
    community_id: int,
    unit_id: int = Query(..., description="ID приміщення"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:read")),
):
    """Отримати оплати по приміщенню."""
    _ensure_unit_in_community(db, unit_id, community_id)
    return get_payments_by_unit(db, unit_id)


# --- Budget ---

@router.post("/budget", response_model=BudgetItemResponse, status_code=201)
def add_budget_item(
    community_id: int,
    data: BudgetItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("budget:manage")),
):
    """Додати статтю бюджету."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return create_budget_item(db, community_id, data, current_user.id)


@router.get("/budget", response_model=list[BudgetItemResponse])
def list_budget(
    community_id: int,
    period: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    """Отримати бюджет спільноти."""
    return get_budget_items(db, community_id, period)