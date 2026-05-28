from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, check_permission, get_user_permissions, get_client_ip
from app.models.audit import AuditLog
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.services.audit import verify_audit_chain

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/")
def list_audit_log(
    request: Request,
    community_id: int = Query(..., description="ID спільноти"),
    resource: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати записи журналу аудиту спільноти з фільтрацією."""
    check_permission(db, current_user.id, community_id, "audit:read", get_client_ip(request))
    query = db.query(AuditLog).filter(
        AuditLog.community_id == community_id
    ).order_by(AuditLog.id.desc())
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
    """Перевірити цілісність hash chain аудиту (доступ: голова будь-якої спільноти)."""
    ucrs = db.query(UserCommunityRole).filter(
        UserCommunityRole.user_id == current_user.id
    ).all()
    has_access = any(
        "audit:read" in get_user_permissions(db, current_user.id, u.community_id)
        for u in ucrs
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Permission 'audit:read' required")
    return verify_audit_chain(db)