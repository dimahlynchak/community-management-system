import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def _compute_hash(data: str, previous_hash: str) -> str:
    """SHA-256: hash_i = SHA-256(data_i ‖ previous_hash_{i-1})."""
    raw = f"{data}{previous_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_last_hash(db: Session) -> str:
    """Отримує hash останнього запису або '0'*64 для першого."""
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
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

    data_str = json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "community_id": community_id,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "details": details,
    }, sort_keys=True, default=str)

    current_hash = _compute_hash(data_str, previous_hash)

    entry = AuditLog(
        user_id=user_id,
        community_id=community_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        previous_hash=previous_hash,
        hash=current_hash,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_audit_chain(db: Session) -> dict:
    """Перевіряє цілісність hash chain."""
    entries = db.query(AuditLog).order_by(AuditLog.id).all()

    if not entries:
        return {"valid": True, "total": 0}

    expected_previous = "0" * 64
    broken_at = None

    for entry in entries:
        if entry.previous_hash != expected_previous:
            broken_at = entry.id
            break
        expected_previous = entry.hash

    return {
        "valid": broken_at is None,
        "total": len(entries),
        "broken_at_id": broken_at,
    }