from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.audit import AuditLog
from app.models.user import User
from app.services.audit import verify_audit_chain

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/")
def list_audit_log(
    community_id: int | None = Query(None),
    resource: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати записи журналу аудиту з фільтрацією."""
    query = db.query(AuditLog).order_by(AuditLog.id.desc())
    if community_id:
        query = query.filter(AuditLog.community_id == community_id)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.limit(limit).all()


@router.get("/verify")
def verify_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Перевірити цілісність hash chain аудиту."""
    return verify_audit_chain(db)