from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission, require_membership
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate, AnnouncementResponse
from app.services.announcement import create_announcement, get_announcements
from app.services.audit import create_audit_entry
from app.services.community import get_community

router = APIRouter(prefix="/api/communities/{community_id}/announcements", tags=["announcements"])


@router.post("/", response_model=AnnouncementResponse, status_code=201)
def create(
    community_id: int,
    data: AnnouncementCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("announcements:create")),
):
    """Створити оголошення."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    announcement = create_announcement(db, community_id, data, current_user.id)
    create_audit_entry(
        db, current_user.id, community_id, "CREATE", "announcement", announcement.id,
        ip_address=request.client.host,
    )
    return announcement


@router.get("/", response_model=list[AnnouncementResponse])
def list_all(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_membership),
):
    """Отримати оголошення спільноти."""
    return get_announcements(db, community_id)