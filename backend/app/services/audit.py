import hashlib
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def _compute_hash(data: str, previous_hash: str) -> str:
    """SHA-256: hash_i = SHA-256(data_i ‖ previous_hash_{i-1})."""
    raw = f"{data}{previous_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_data_str(
    timestamp: datetime,
    user_id: int | None,
    community_id: int | None,
    action: str,
    resource: str,
    resource_id: int | None,
    details: dict | None,
) -> str:
    """Канонічний рядок для хешування — однаковий при створенні і верифікації."""
    return json.dumps(
        {
            "timestamp": timestamp.isoformat(),
            "user_id": user_id,
            "community_id": community_id,
            "action": action,
            "resource": resource,
            "resource_id": resource_id,
            "details": details,
        },
        sort_keys=True,
        default=str,
    )


def get_last_hash(db: Session) -> str:
    """Хеш останнього запису або '0'*64.
    SELECT FOR UPDATE запобігає race condition при паралельних записах."""
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).with_for_update().first()
    if last is None:
        return "0" * 64
    return last.hash


def create_audit_entry(
    db: Session,
    user_id: int | None,
    community_id: int | None,
    action: str,
    resource: str,
    resource_id: int | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Створює запис в журналі аудиту з hash chain."""
    previous_hash = get_last_hash(db)
    # Явний Python-timestamp — той самий іде і в hash, і в БД (без розбіжності server_default)
    timestamp = datetime.utcnow()

    # Зводимо details до JSON-безпечних типів (Decimal/date -> str), щоб і JSONB-колонка,
    # і hash рахувалися з однакового канонічного представлення
    safe_details = json.loads(json.dumps(details, default=str)) if details is not None else None

    data_str = _build_data_str(
        timestamp, user_id, community_id, action, resource, resource_id, safe_details,
    )
    current_hash = _compute_hash(data_str, previous_hash)

    entry = AuditLog(
        timestamp=timestamp,
        user_id=user_id,
        community_id=community_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=safe_details,
        ip_address=ip_address,
        previous_hash=previous_hash,
        hash=current_hash,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_audit_chain(db: Session) -> dict:
    """Перевіряє цілісність hash chain: ланцюг previous_hash + перерахунок hash."""
    entries = db.query(AuditLog).order_by(AuditLog.id).all()

    if not entries:
        return {"valid": True, "total": 0}

    expected_previous = "0" * 64
    broken_at = None

    for entry in entries:
        if entry.previous_hash != expected_previous:
            broken_at = entry.id
            break
        # Перераховуємо hash із збережених даних
        recomputed = _compute_hash(
            _build_data_str(
                entry.timestamp,
                entry.user_id,
                entry.community_id,
                entry.action,
                entry.resource,
                entry.resource_id,
                entry.details,
            ),
            entry.previous_hash,
        )
        if recomputed != entry.hash:
            broken_at = entry.id
            break
        expected_previous = entry.hash

    return {
        "valid": broken_at is None,
        "total": len(entries),
        "broken_at_id": broken_at,
    }
