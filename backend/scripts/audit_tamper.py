"""Скрипт експериментів-атак на журнал аудиту для розділу 4.2 ПЗ.

Виконує три дослідження:

1. Масштабованість верифікації — таблиця 4.4. Сідить 100, 1000, 10000
   тестових записів і вимірює час verify_audit_chain.
2. Експеримент 1 — модифікація поля existing запису. Виводить JSON
   результат verify (для скріншоту → рисунок 4.1).
3. Експеримент 2 — видалення запису посередині ланцюга. Те саме (рис. 4.2).

Скрипт тимчасово знімає Postgres-тригер prevent_audit_modification, щоб
імітувати обхід СУБД-захисту (наприклад, через суперкористувача). У реальному
середовищі цей тригер блокує UPDATE/DELETE безумовно.

Запуск:

    cd backend && python -m scripts.audit_tamper

Тестові записи мають resource='__bench_audit__' і видаляються наприкінці.
"""
import json
import time
from contextlib import contextmanager

from sqlalchemy import text

from app.core.database import SessionLocal
from app.services.audit import create_audit_entry, verify_audit_chain

TEST_RESOURCE = "__bench_audit__"


@contextmanager
def trigger_disabled(db):
    """Тимчасово знімає всі user-тригери з audit_log і повертає на місце.

    Використовується синтаксис DISABLE TRIGGER USER (а не конкретне імʼя),
    щоб скрипт працював незалежно від того, як саме названо insert-only
    тригер у вашій міграції — prevent_audit_modification,
    audit_log_insert_only або інше. Якщо тригерів узагалі немає —
    DISABLE TRIGGER USER працює як no-op."""
    db.execute(text("ALTER TABLE audit_log DISABLE TRIGGER USER"))
    db.commit()
    try:
        yield
    finally:
        db.execute(text("ALTER TABLE audit_log ENABLE TRIGGER USER"))
        db.commit()


def cleanup(db):
    with trigger_disabled(db):
        db.execute(
            text("DELETE FROM audit_log WHERE resource = :r"),
            {"r": TEST_RESOURCE},
        )
        db.commit()


def seed_n(db, count):
    """Створює count нових записів аудиту з тестовим resource."""
    for i in range(count):
        create_audit_entry(db, None, None, "CREATE", TEST_RESOURCE, i, details={"i": i})


def time_verify(db):
    t0 = time.perf_counter()
    res = verify_audit_chain(db)
    return res, (time.perf_counter() - t0) * 1000


def print_box(title):
    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


def main():
    db = SessionLocal()
    try:
        cleanup(db)

        # --- Дослідження 1: масштабованість verify
        print_box("Таблиця 4.4 — Час верифікації цілісності ланцюга")
        print(f"{'Записів':>12}  {'Час verify (мс)':>18}")
        print("-" * 78)
        cumulative = 0
        for target in [100, 1000, 10000]:
            delta = target - cumulative
            seed_n(db, delta)
            cumulative = target
            _, ms = time_verify(db)
            print(f"{target:>12}  {ms:>18.1f}")
        cleanup(db)

        # --- Експеримент 1: модифікація запису
        print_box("Експеримент 1 — Модифікація запису (рис. 4.1)")
        seed_n(db, 100)
        target_id = db.execute(text(
            "SELECT id FROM audit_log WHERE resource = :r ORDER BY id LIMIT 1 OFFSET 50"
        ), {"r": TEST_RESOURCE}).scalar()
        print(f"Цільовий запис: id = {target_id}")
        print("Виконуємо UPDATE audit_log SET details = '{\"tampered\": true}' WHERE id = ...")
        with trigger_disabled(db):
            db.execute(
                text("UPDATE audit_log SET details = :d WHERE id = :id"),
                {"d": json.dumps({"tampered": True}), "id": target_id},
            )
            db.commit()
        result, ms = time_verify(db)
        print(f"\nGET /api/audit/verify → {json.dumps(result, ensure_ascii=False)}")
        print(f"(виконано за {ms:.1f} мс)")
        cleanup(db)

        # --- Експеримент 2: видалення запису
        print_box("Експеримент 2 — Видалення запису (рис. 4.2)")
        seed_n(db, 100)
        target_id = db.execute(text(
            "SELECT id FROM audit_log WHERE resource = :r ORDER BY id LIMIT 1 OFFSET 50"
        ), {"r": TEST_RESOURCE}).scalar()
        print(f"Цільовий запис: id = {target_id}")
        print("Виконуємо DELETE FROM audit_log WHERE id = ...")
        with trigger_disabled(db):
            db.execute(text("DELETE FROM audit_log WHERE id = :id"), {"id": target_id})
            db.commit()
        result, ms = time_verify(db)
        print(f"\nGET /api/audit/verify → {json.dumps(result, ensure_ascii=False)}")
        print(f"(виконано за {ms:.1f} мс)")

        # --- Очищення
        cleanup(db)
        print()
        print("Тестові записи видалено. Журнал повернуто у попередній стан.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
