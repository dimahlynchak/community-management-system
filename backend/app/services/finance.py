from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.charge import ChargeType, Charge
from app.models.payment import Payment
from app.models.budget import BudgetItem
from app.models.unit import Unit
from app.schemas.finance import (
    ChargeTypeCreate, ChargeCreate, PaymentCreate, BudgetItemCreate,
)


# --- ChargeTypes ---

def create_charge_type(db: Session, community_id: int, data: ChargeTypeCreate) -> ChargeType:
    ct = ChargeType(community_id=community_id, **data.model_dump())
    db.add(ct)
    db.commit()
    db.refresh(ct)
    return ct


def get_charge_types(db: Session, community_id: int) -> list[ChargeType]:
    return db.query(ChargeType).filter(
        ChargeType.community_id == community_id,
        ChargeType.is_active == True,
    ).all()


# --- Charges ---

def calculate_amount(unit: Unit, charge_type: ChargeType, unit_count: int) -> Decimal:
    """Розрахунок суми нарахування за методом тарифу."""
    method = charge_type.calculation_method
    if method == "per_sqm":
        return (unit.area * charge_type.rate).quantize(Decimal("0.01"))
    if method == "fixed":
        return charge_type.rate.quantize(Decimal("0.01"))
    if method == "share":
        # Рівний розподіл загальної суми між усіма юнітами спільноти
        if unit_count == 0:
            return Decimal("0.00")
        return (charge_type.rate / unit_count).quantize(Decimal("0.01"))
    raise ValueError(f"Unknown calculation_method: {method}")


def create_charges_for_community(
    db: Session, community_id: int, charge_type_id: int, period: str, user_id: int,
) -> list[Charge]:
    """Масове нарахування для всіх юнітів спільноти (атомарно, одна транзакція)."""
    charge_type = db.query(ChargeType).filter(ChargeType.id == charge_type_id).first()
    if charge_type is None:
        raise ValueError("Charge type not found")
    if charge_type.community_id != community_id:
        raise ValueError("Charge type does not belong to this community")

    units = db.query(Unit).filter(Unit.community_id == community_id).all()
    if not units:
        return []

    unit_count = len(units)
    charges: list[Charge] = []
    for unit in units:
        amount = calculate_amount(unit, charge_type, unit_count)
        charge = Charge(
            unit_id=unit.id,
            charge_type_id=charge_type_id,
            period=period,
            amount=amount,
            created_by=user_id,
        )
        db.add(charge)
        charges.append(charge)
    db.commit()
    for charge in charges:
        db.refresh(charge)
    return charges


def get_charges_by_unit(db: Session, unit_id: int) -> list[Charge]:
    return db.query(Charge).filter(Charge.unit_id == unit_id).all()


def get_charges_by_community(db: Session, community_id: int, period: str | None = None) -> list[Charge]:
    query = db.query(Charge).join(Unit).filter(Unit.community_id == community_id)
    if period:
        query = query.filter(Charge.period == period)
    return query.all()


# --- Payments ---

def create_payment(db: Session, data: PaymentCreate, user_id: int) -> Payment:
    payment = Payment(**data.model_dump(), created_by=user_id)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def get_payments_by_unit(db: Session, unit_id: int) -> list[Payment]:
    return db.query(Payment).filter(Payment.unit_id == unit_id).all()


# --- BudgetItems ---

def create_budget_item(db: Session, community_id: int, data: BudgetItemCreate, user_id: int) -> BudgetItem:
    item = BudgetItem(community_id=community_id, **data.model_dump(), created_by=user_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_budget_items(db: Session, community_id: int, period: str | None = None) -> list[BudgetItem]:
    query = db.query(BudgetItem).filter(BudgetItem.community_id == community_id)
    if period:
        query = query.filter(BudgetItem.period == period)
    return query.all()