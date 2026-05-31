"""Юніт-тести модуля аудиту: детермінованість хешування, цілісність ланцюга,
виявлення модифікації записів."""
import pytest

from app.services.audit import (
    _build_data_str,
    _compute_hash,
    create_audit_entry,
    verify_audit_chain,
)


def test_compute_hash_is_deterministic():
    """Той самий вхід завжди дає той самий хеш — інакше verify не працював би."""
    h1 = _compute_hash("payload", "0" * 64)
    h2 = _compute_hash("payload", "0" * 64)
    assert h1 == h2
    assert len(h1) == 64


def test_compute_hash_changes_with_input():
    """Різні дані або різний previous_hash дають різні хеші."""
    base = _compute_hash("payload", "0" * 64)
    other_data = _compute_hash("payload2", "0" * 64)
    other_prev = _compute_hash("payload", "1" * 64)
    assert base != other_data
    assert base != other_prev
    assert other_data != other_prev


def test_create_audit_entry_links_chain(db_session):
    """previous_hash наступного запису == hash попереднього."""
    e1 = create_audit_entry(db_session, None, None, "CREATE", "test", 1)
    e2 = create_audit_entry(db_session, None, None, "UPDATE", "test", 1)
    e3 = create_audit_entry(db_session, None, None, "DELETE", "test", 1)
    assert e2.previous_hash == e1.hash
    assert e3.previous_hash == e2.hash


def test_first_entry_has_genesis_previous_hash(db_session):
    """Найперший запис використовує канонічний нульовий previous_hash."""
    e = create_audit_entry(db_session, None, None, "CREATE", "test", 1)
    assert e.previous_hash == "0" * 64


def test_verify_returns_valid_for_intact_chain(db_session):
    """Послідовність із 5 записів, нічого не змінено — valid=True."""
    for i in range(5):
        create_audit_entry(db_session, None, None, "CREATE", "test", i, details={"i": i})
    result = verify_audit_chain(db_session)
    assert result["valid"] is True
    assert result["total"] == 5
    assert result["broken_at_id"] is None


def test_verify_detects_tampered_action_field(db_session):
    """Модифікація поля action існуючого запису виявляється verify."""
    create_audit_entry(db_session, None, None, "CREATE", "test", 1)
    e2 = create_audit_entry(db_session, None, None, "CREATE", "test", 2)
    create_audit_entry(db_session, None, None, "CREATE", "test", 3)

    # Підміна поля action — обходить тригер insert-only лише в тестах
    e2.action = "TAMPERED"
    db_session.commit()

    result = verify_audit_chain(db_session)
    assert result["valid"] is False
    assert result["broken_at_id"] == e2.id


def test_verify_detects_tampered_details_field(db_session):
    """Модифікація JSONB-поля details виявляється так само."""
    create_audit_entry(db_session, None, None, "CREATE", "test", 1, details={"x": 1})
    e2 = create_audit_entry(db_session, None, None, "CREATE", "test", 2, details={"x": 2})
    create_audit_entry(db_session, None, None, "CREATE", "test", 3, details={"x": 3})

    e2.details = {"x": 999}
    db_session.commit()

    result = verify_audit_chain(db_session)
    assert result["valid"] is False
    assert result["broken_at_id"] == e2.id


def test_verify_empty_chain_is_valid(db_session):
    """Порожній журнал — це валідний випадковий стан, не помилка."""
    result = verify_audit_chain(db_session)
    assert result["valid"] is True
    assert result["total"] == 0
