from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission, require_membership
from app.models.payment import Payment
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.schemas.finance import (
    AllocationResponse,
    BudgetItemCreate, BudgetItemResponse,
    ChargeCreate, ChargeResponse,
    ChargeTypeCreate, ChargeTypeResponse,
    PaymentCreate, PaymentResponse,
    UnitBalanceResponse,
    UnitPenaltyResponse,
)
from app.services.audit import create_audit_entry
from app.services.finance import (
    calculate_penalties,
    create_budget_item, get_budget_items,
    create_charge_type, get_charge_types,
    create_charges_for_community, get_charges_by_community,
    create_payment, get_payments_by_unit,
    export_balance_pdf, export_balance_xlsx,
    get_allocations_by_payment,
    get_balance_for_community,
    get_my_charges,
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charge_types:manage")),
):
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    charge_type = create_charge_type(db, community_id, data)
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "charge_type", charge_type.id,
        details={"name": data.name, "calculation_method": data.calculation_method, "rate": str(data.rate)},
        ip_address=request.client.host,
    )
    return charge_type


@router.get("/charge-types", response_model=list[ChargeTypeResponse])
def list_types(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    return get_charge_types(db, community_id)


# --- Charges ---

@router.post("/charges", response_model=list[ChargeResponse], status_code=201)
def generate_charges(
    community_id: int,
    data: ChargeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charges:create")),
):
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    try:
        charges = create_charges_for_community(
            db, community_id, data.charge_type_id, data.period, current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Charges for this period already exist")
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "charge", None,
        details={"charge_type_id": data.charge_type_id, "period": data.period, "count": len(charges)},
        ip_address=request.client.host,
    )
    return charges


@router.get("/charges", response_model=list[ChargeResponse])
def list_charges(
    community_id: int,
    period: str | None = Query(None, description="Фільтр по періоду (YYYY-MM)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("charges:read")),
):
    return get_charges_by_community(db, community_id, period)


# --- My charges ---

@router.get("/my-charges", response_model=list[ChargeResponse])
def my_charges(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("own_charges:read")),
):
    """Нарахування поточного мешканця (за своїм юнітом)."""
    membership = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == current_user.id,
        UserCommunityRole.community_id == community_id,
    ).first()
    if membership is None or membership.unit_id is None:
        raise HTTPException(status_code=404, detail="No unit assigned to your membership")
    return get_my_charges(db, membership.unit_id)


# --- Payments ---

@router.post("/payments", response_model=PaymentResponse, status_code=201)
def add_payment(
    community_id: int,
    data: PaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:create")),
):
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    _ensure_unit_in_community(db, data.unit_id, community_id)
    payment = create_payment(db, data, current_user.id)
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "payment", payment.id,
        details={"unit_id": data.unit_id, "amount": str(data.amount)},
        ip_address=request.client.host,
    )
    return payment


@router.get("/payments", response_model=list[PaymentResponse])
def list_payments(
    community_id: int,
    unit_id: int = Query(..., description="ID приміщення"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:read")),
):
    _ensure_unit_in_community(db, unit_id, community_id)
    return get_payments_by_unit(db, unit_id)


# --- Allocations ---

@router.get("/payments/{payment_id}/allocations", response_model=list[AllocationResponse])
def payment_allocations(
    community_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:read")),
):
    """Розподіл платежу по нарахуваннях (FIFO)."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _ensure_unit_in_community(db, payment.unit_id, community_id)
    return get_allocations_by_payment(db, payment_id)


# --- Balance ---

@router.get("/balance", response_model=list[UnitBalanceResponse])
def community_balance(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports:generate")),
):
    """Боргова відомість: нараховано / оплачено / баланс по кожному юніту."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return get_balance_for_community(db, community_id)


# --- Balance export ---

@router.get("/balance/export")
def export_balance(
    community_id: int,
    format: str = Query("xlsx", description="Формат: xlsx або pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports:generate")),
):
    """Вивантаження боргової відомості у форматі XLSX або PDF."""
    community = get_community(db, community_id)
    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")
    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'xlsx' or 'pdf'")

    balance_rows = get_balance_for_community(db, community_id)

    if format == "xlsx":
        content = export_balance_xlsx(balance_rows, community.name)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="balance_{community_id}.xlsx"'},
        )
    # pdf
    content = export_balance_pdf(balance_rows, community.name)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="balance_{community_id}.pdf"'},
    )


# --- Penalties ---

@router.get("/penalties", response_model=list[UnitPenaltyResponse])
def community_penalties(
    community_id: int,
    rate: float | None = Query(None, description="Денна ставка пені (0.001 = 0.1%/день); за замовч. з config"),
    as_of: date | None = Query(None, description="Дата розрахунку YYYY-MM-DD; за замовч. сьогодні"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports:generate")),
):
    """Розрахунок пені за прострочену заборгованість: Penalty = D × r × n."""
    from app.core.config import settings
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    daily_rate = Decimal(str(rate)) if rate is not None else Decimal(str(settings.PENALTY_DAILY_RATE))
    if daily_rate < 0:
        raise HTTPException(status_code=400, detail="rate must be >= 0")
    return calculate_penalties(db, community_id, daily_rate, as_of)


# --- Budget ---

@router.post("/budget", response_model=BudgetItemResponse, status_code=201)
def add_budget_item(
    community_id: int,
    data: BudgetItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("budget:manage")),
):
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    item = create_budget_item(db, community_id, data, current_user.id)
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "budget_item", item.id,
        details={k: str(v) if v is not None else None for k, v in data.model_dump().items()},
        ip_address=request.client.host,
    )
    return item


@router.get("/budget", response_model=list[BudgetItemResponse])
def list_budget(
    community_id: int,
    period: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    return get_budget_items(db, community_id, period)