"""Юніт-тести фінансової підсистеми: обчислення нарахувань трьома методами,
FIFO-розподіл платежів, перерахунок розподілу при модифікації нарахувань."""
from datetime import date
from decimal import Decimal

import pytest

from app.models.charge import Charge, ChargeType
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.schemas.finance import PaymentCreate
from app.services.finance import (
    calculate_amount,
    create_charges_for_community,
    create_payment,
    delete_charge,
    update_charge_amount,
)


# === Хелпери ===

class _FakeChargeType:
    """Легкий обʼєкт для unit-тесту calculate_amount, не потребує сесії."""
    def __init__(self, method: str, rate: str):
        self.calculation_method = method
        self.rate = Decimal(rate)


class _FakeUnit:
    def __init__(self, area: str = "50.00"):
        self.area = Decimal(area)


def _make_charge_type(db_session, community, method="fixed", rate="500.00") -> ChargeType:
    ct = ChargeType(
        community_id=community.id,
        name="Утримання",
        calculation_method=method,
        rate=Decimal(rate),
        is_active=True,
    )
    db_session.add(ct)
    db_session.commit()
    return ct


def _make_charges(db_session, unit, ct, periods, amount: str):
    for period in periods:
        db_session.add(Charge(
            unit_id=unit.id,
            charge_type_id=ct.id,
            period=period,
            amount=Decimal(amount),
            created_by=1,
        ))
    db_session.commit()


# === calculate_amount: три методи розрахунку ===

def test_calculate_amount_per_sqm():
    """per_sqm: сума = площа × тариф."""
    amount = calculate_amount(_FakeUnit("50.00"), _FakeChargeType("per_sqm", "10.00"), unit_count=1)
    assert amount == Decimal("500.00")


def test_calculate_amount_fixed():
    """fixed: однакова сума незалежно від приміщення."""
    amount = calculate_amount(_FakeUnit("50.00"), _FakeChargeType("fixed", "300.00"), unit_count=1)
    assert amount == Decimal("300.00")


def test_calculate_amount_share_largest_remainder_sums_exactly():
    """share: сума розподілу за алгоритмом найбільшого залишку точно
    дорівнює тарифу, копієчна асиметрія не перевищує 0.01."""
    ct = _FakeChargeType("share", "100.00")
    amounts = [
        calculate_amount(_FakeUnit(), ct, unit_count=3, unit_index=i)
        for i in range(3)
    ]
    assert sum(amounts) == Decimal("100.00")
    assert max(amounts) - min(amounts) <= Decimal("0.01")


def test_calculate_amount_share_zero_units():
    """share: на нульовій кількості приміщень повертає 0, не ділення на нуль."""
    amount = calculate_amount(_FakeUnit(), _FakeChargeType("share", "100.00"), unit_count=0)
    assert amount == Decimal("0.00")


# === FIFO-розподіл платежів ===

def test_fifo_full_coverage(db_session, community, unit, head_user):
    """Платіж, рівний сумі єдиного нарахування, повністю його покриває."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01"], "500.00")

    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("500.00"), payment_date=date(2025, 1, 5),
    ), head_user.id)

    allocations = db_session.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment.id
    ).all()
    assert len(allocations) == 1
    assert allocations[0].amount == Decimal("500.00")


def test_fifo_oldest_first(db_session, community, unit, head_user):
    """Платіж розподіляється спочатку на найстаріше нарахування."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01", "2025-02"], "500.00")

    # Платіж 600 ≡ повне покриття Jan (500) + часткове Feb (100)
    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("600.00"), payment_date=date(2025, 3, 1),
    ), head_user.id)

    allocs = db_session.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment.id,
    ).order_by(PaymentAllocation.id).all()
    assert len(allocs) == 2
    assert allocs[0].amount == Decimal("500.00")
    assert allocs[1].amount == Decimal("100.00")


def test_fifo_overpayment_stays_unallocated(db_session, community, unit, head_user):
    """Переплата (платіж > борг) зберігається як unallocated."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01"], "300.00")

    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("500.00"), payment_date=date(2025, 1, 5),
    ), head_user.id)

    allocated = sum(
        a.amount for a in db_session.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment.id,
        ).all()
    )
    # Розподілено лише суму нарахування, решта 200 — переплата
    assert allocated == Decimal("300.00")


def test_fifo_reallocates_on_new_charge(db_session, community, unit, head_user):
    """Залишок переплати автоматично спрямовується на нове нарахування."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01"], "300.00")

    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("500.00"), payment_date=date(2025, 1, 5),
    ), head_user.id)

    # Створюємо нове нарахування — має активуватися _reallocate_unit_credit
    create_charges_for_community(db_session, community.id, ct.id, "2025-02", head_user.id)

    allocated = sum(
        a.amount for a in db_session.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment.id,
        ).all()
    )
    # Тепер платіж розподілено повністю: 300 на Jan + 200 на Feb
    assert allocated == Decimal("500.00")


def test_delete_charge_reallocates_payments(db_session, community, unit, head_user):
    """Видалення нарахування звільняє платежі, що автоматично перерозподіляються."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01", "2025-02"], "300.00")

    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("300.00"), payment_date=date(2025, 1, 5),
    ), head_user.id)
    # Спершу платіж покриває Jan повністю
    jan_charge = db_session.query(Charge).filter(Charge.period == "2025-01").first()

    delete_charge(db_session, jan_charge)

    # Після видалення Jan платіж має повністю покрити Feb
    allocated = sum(
        a.amount for a in db_session.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment.id,
        ).all()
    )
    assert allocated == Decimal("300.00")


def test_update_charge_amount_reallocates(db_session, community, unit, head_user):
    """Зміна суми нарахування викликає перерахунок FIFO усіх платежів юніта."""
    ct = _make_charge_type(db_session, community)
    _make_charges(db_session, unit, ct, ["2025-01"], "500.00")

    payment = create_payment(db_session, PaymentCreate(
        unit_id=unit.id, amount=Decimal("500.00"), payment_date=date(2025, 1, 5),
    ), head_user.id)

    charge = db_session.query(Charge).first()
    update_charge_amount(db_session, charge, Decimal("300.00"))

    allocated = sum(
        a.amount for a in db_session.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment.id,
        ).all()
    )
    # Платіж повинен покривати лише новий розмір нарахування
    assert allocated == Decimal("300.00")
