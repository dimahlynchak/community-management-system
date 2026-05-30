import csv
import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user, check_permission, get_user_permissions,
    get_client_ip, _ensure_community_active,
)
from app.models.audit import AuditLog
from app.models.user import User
from app.models.user_community_role import UserCommunityRole
from app.services.audit import verify_audit_chain

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/")
def list_audit_log(
    response: Response,
    request: Request,
    community_id: int = Query(..., description="ID спільноти"),
    resource: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0, description="Зміщення для пагінації"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Записи журналу аудиту з фільтрами і пагінацією. У заголовку
    X-Total-Count повертається загальна кількість записів за обраних
    фільтрів — фронт показує «N–M з K» і керує кнопками наступної/попередньої."""
    _ensure_community_active(db, community_id)
    check_permission(db, current_user.id, community_id, "audit:read", get_client_ip(request))

    query = db.query(AuditLog).filter(AuditLog.community_id == community_id)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if action:
        query = query.filter(AuditLog.action == action)

    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    return (
        query.order_by(AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


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


_EXPORT_HEADERS = [
    "id", "timestamp", "user_id", "community_id", "action", "resource",
    "resource_id", "details", "ip_address", "previous_hash", "hash",
]


def _row(entry: AuditLog) -> list[Any]:
    return [
        entry.id,
        entry.timestamp.isoformat() if entry.timestamp else "",
        entry.user_id if entry.user_id is not None else "",
        entry.community_id if entry.community_id is not None else "",
        entry.action,
        entry.resource,
        entry.resource_id if entry.resource_id is not None else "",
        "" if entry.details is None else str(entry.details),
        entry.ip_address or "",
        entry.previous_hash,
        entry.hash,
    ]


@router.get("/export")
def export_audit_log(
    request: Request,
    community_id: int = Query(..., description="ID спільноти"),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Експортує весь журнал аудиту спільноти у CSV або XLSX. Без ліміту —
    щоб голова мав повну копію для зовнішнього аудиту. Для XLSX
    використовується openpyxl (та сама залежність, що й для експорту балансу)."""
    _ensure_community_active(db, community_id)
    check_permission(db, current_user.id, community_id, "audit:read", get_client_ip(request))

    entries = (
        db.query(AuditLog)
        .filter(AuditLog.community_id == community_id)
        .order_by(AuditLog.id.desc())
        .all()
    )

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(_EXPORT_HEADERS)
        for e in entries:
            writer.writerow(_row(e))
        content = buf.getvalue().encode("utf-8-sig")  # BOM для коректної кирилиці в Excel
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=audit_{community_id}_{timestamp}.csv"
                ),
            },
        )

    # xlsx
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Audit log"
    ws.append(_EXPORT_HEADERS)
    for e in entries:
        ws.append([str(v) if isinstance(v, dict) else v for v in _row(e)])
    out = io.BytesIO()
    wb.save(out)
    return Response(
        content=out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f"attachment; filename=audit_{community_id}_{timestamp}.xlsx"
            ),
        },
    )
