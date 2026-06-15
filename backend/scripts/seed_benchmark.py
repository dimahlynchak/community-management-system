"""Скрипт для замірів продуктивності фінансових алгоритмів.

Створює спеціальні «бенчмарк-спільноти» (префікс імені _BENCH_) із N=10, 50,
200, 500 приміщеннями, наповнює дванадцять місяців нарахувань та по два
платежі на місяць. Потім вимірює час трьох операцій:
1. Обчислення боргової відомості — порівняння naive (N+1 запитів) vs
   оптимізованого варіанту з GROUP BY.
2. Розрахунок пені — naive vs оптимізований.
3. FIFO-розподіл одиничного платежу залежно від глибини непогашеного боргу.

Виводить три таблиці у форматі для копіювання в розділ 4.1 пояснювальної
записки. Запуск:

    cd backend && python -m scripts.seed_benchmark

Тестові дані лишаються в БД для повторного запуску. Очистити можна так:

    DELETE FROM communities WHERE name LIKE '_BENCH_%';
"""
import time
from datetime import date
from decimal import Decimal

from sqlalchemy import func

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.charge import Charge, ChargeType
from app.models.community import Community
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.unit import Unit
from app.models.user import User
from app.services.finance import (
    _allocate_payment_fifo,
    _reallocate_unit_credit,
    calculate_penalties,
    get_balance_for_community,
)

WARMUP = 1
RUNS = 5


def get_balance_naive(db, community_id):
    """Емуляція дооптимізаційної реалізації: N+1 SUM-запитів."""
    units = db.query(Unit).filter(Unit.community_id == community_id).all()
    results = []
    for unit in units:
        total_charged = db.query(func.sum(Charge.amount)).filter(
            Charge.unit_id == unit.id,
        ).scalar() or Decimal("0")
        total_paid = db.query(func.sum(Payment.amount)).filter(
            Payment.unit_id == unit.id,
        ).scalar() or Decimal("0")
        results.append({"unit_id": unit.id, "balance": total_paid - total_charged})
    return results


def calculate_penalties_naive(db, community_id, rate, as_of_date):
    """Емуляція дооптимізаційної реалізації: N×M запитів (юніти × charges)."""
    units = db.query(Unit).filter(Unit.community_id == community_id).all()
    results = []
    for unit in units:
        charges = db.query(Charge).filter(Charge.unit_id == unit.id).all()
        for charge in charges:
            allocated = db.query(func.sum(PaymentAllocation.amount)).filter(
                PaymentAllocation.charge_id == charge.id,
            ).scalar() or Decimal("0")
            debt = charge.amount - allocated
            if debt > Decimal("0"):
                results.append({"charge_id": charge.id, "debt": debt})
    return results


def _get_or_create_bench_user(db) -> User:
    user = db.query(User).filter(User.email == "bench@local").first()
    if user is None:
        user = User(
            email="bench@local",
            password_hash=hash_password("Bench123"),
            full_name="Benchmark User",
            is_active=True,
        )
        db.add(user)
        db.commit()
    return user


def _seed_community(db, user_id: int, unit_count: int) -> Community:
    """Створює спільноту з N юнітами, 12 місяцями charges + 2 payments/місяць.
    Якщо спільнота з таким імʼям уже існує — повертає її без перестворення."""
    name = f"_BENCH_{unit_count}"
    existing = db.query(Community).filter(Community.name == name).first()
    if existing is not None:
        return existing

    community = Community(
        name=name, address="Benchmark", founder_user_id=user_id, is_active=True,
    )
    db.add(community)
    db.flush()

    for i in range(unit_count):
        db.add(Unit(
            community_id=community.id, number=str(i + 1), type="flat",
            area=Decimal("50.00"), floor=(i % 9) + 1, is_active=True,
        ))
    db.flush()

    ct = ChargeType(
        community_id=community.id, name="Утримання", calculation_method="fixed",
        rate=Decimal("500.00"), is_active=True,
    )
    db.add(ct)
    db.flush()

    units = db.query(Unit).filter(Unit.community_id == community.id).all()
    for month in range(1, 13):
        period = f"2025-{month:02d}"
        for unit in units:
            db.add(Charge(
                unit_id=unit.id, charge_type_id=ct.id, period=period,
                amount=Decimal("500.00"), created_by=user_id,
            ))
        for unit in units:
            db.add(Payment(
                unit_id=unit.id, amount=Decimal("250.00"),
                payment_date=date(2025, month, 5), created_by=user_id,
            ))
            db.add(Payment(
                unit_id=unit.id, amount=Decimal("200.00"),
                payment_date=date(2025, month, 20), created_by=user_id,
            ))
        db.flush()

    for unit in units:
        _reallocate_unit_credit(db, unit.id)
    db.commit()
    return community


def _median(values):
    return sorted(values)[len(values) // 2]


def _time_ms(func_, runs=RUNS, warmup=WARMUP):
    for _ in range(warmup):
        func_()
    samples = []
    for _ in range(runs):
        t0 = time.perf_counter()
        func_()
        samples.append((time.perf_counter() - t0) * 1000)
    return _median(samples)


def bench_balance(db, sizes):
    print()
    print("=" * 78)
    print("Таблиця 4.1 — Час обчислення боргової відомості")
    print("=" * 78)
    print(f"{'Юнітів':>10}  {'Charges':>10}  {'Naive (мс)':>12}  "
          f"{'Optimized (мс)':>16}  {'Прискорення':>14}")
    print("-" * 78)
    user = _get_or_create_bench_user(db)
    for size in sizes:
        community = _seed_community(db, user.id, size)
        charges_total = size * 12
        naive_ms = _time_ms(lambda: get_balance_naive(db, community.id))
        opt_ms = _time_ms(lambda: get_balance_for_community(db, community.id))
        speedup = f"x{naive_ms / opt_ms:.1f}" if opt_ms > 0 else "—"
        print(f"{size:>10}  {charges_total:>10}  {naive_ms:>12.1f}  "
              f"{opt_ms:>16.1f}  {speedup:>14}")


def bench_penalties(db, sizes):
    print()
    print("=" * 78)
    print("Таблиця 4.2 — Час розрахунку пені")
    print("=" * 78)
    print(f"{'Юнітів':>10}  {'Charges':>10}  {'Naive (мс)':>12}  "
          f"{'Optimized (мс)':>16}  {'Прискорення':>14}")
    print("-" * 78)
    rate = Decimal("0.001")
    as_of = date(2026, 12, 31)
    for size in sizes:
        community = db.query(Community).filter(Community.name == f"_BENCH_{size}").first()
        if community is None:
            continue
        charges_total = size * 12
        naive_ms = _time_ms(
            lambda: calculate_penalties_naive(db, community.id, rate, as_of), runs=3, warmup=1,
        )
        opt_ms = _time_ms(
            lambda: calculate_penalties(db, community.id, rate, as_of), runs=3, warmup=1,
        )
        speedup = f"x{naive_ms / opt_ms:.1f}" if opt_ms > 0 else "—"
        print(f"{size:>10}  {charges_total:>10}  {naive_ms:>12.1f}  "
              f"{opt_ms:>16.1f}  {speedup:>14}")


def bench_fifo(db):
    print()
    print("=" * 78)
    print("Таблиця 4.3 — Час FIFO-розподілу одиничного платежу")
    print("=" * 78)
    print(f"{'Непогашених charges':>22}  {'Час (мс)':>10}")
    print("-" * 78)
    user = _get_or_create_bench_user(db)
    for depth in [5, 50, 500]:
        name = f"_BENCH_FIFO_{depth}"
        community = db.query(Community).filter(Community.name == name).first()
        if community is None:
            community = Community(
                name=name, address="FIFO", founder_user_id=user.id, is_active=True,
            )
            db.add(community)
            db.flush()
            unit = Unit(
                community_id=community.id, number="1", type="flat",
                area=Decimal("50.00"), is_active=True,
            )
            db.add(unit)
            db.flush()
            ct = ChargeType(
                community_id=community.id, name="t", calculation_method="fixed",
                rate=Decimal("100.00"), is_active=True,
            )
            db.add(ct)
            db.flush()
            for i in range(depth):
                # Унікальні (year, month) — щоб не зачепити обмеження
                # uq_charge_unit_type_period при глибині > 12.
                year = 2020 + (i // 12)
                month = (i % 12) + 1
                db.add(Charge(
                    unit_id=unit.id, charge_type_id=ct.id,
                    period=f"{year}-{month:02d}",
                    amount=Decimal("100.00"), created_by=user.id,
                ))
            db.commit()

        unit = db.query(Unit).filter(Unit.community_id == community.id).first()
        samples = []
        for _ in range(3):
            payment = Payment(
                unit_id=unit.id, amount=Decimal("100000.00"),
                payment_date=date(2026, 1, 1), created_by=user.id,
            )
            db.add(payment)
            db.flush()
            t0 = time.perf_counter()
            _allocate_payment_fifo(db, payment)
            samples.append((time.perf_counter() - t0) * 1000)
            db.rollback()
        med = _median(samples)
        print(f"{depth:>22}  {med:>10.1f}")


def main():
    db = SessionLocal()
    try:
        sizes = [10, 50, 200, 500]
        print("Бенчмарк фінансових алгоритмів. Перший запуск може бути повільним —")
        print("створюються тестові спільноти. Повторні запуски швидші.")
        bench_balance(db, sizes)
        bench_penalties(db, sizes)
        bench_fifo(db)
        print()
        print("Готово. Числа з трьох таблиць — у розділ 4.1.")
        print("Тестові спільноти (_BENCH_*) лишаються в БД до ручного видалення.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
