from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate, AnnouncementResponse
from app.services.announcement import create_announcement, get_announcements
from app.services.community import get_community

router = APIRouter(prefix="/api/communities/{community_id}/announcements", tags=["announcements"])


@router.post("/", response_model=AnnouncementResponse, status_code=201)
def create(
    community_id: int,
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Створити оголошення."""
    if get_community(db, community_id) is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return create_announcement(db, community_id, data, current_user.id)


@router.get("/", response_model=list[AnnouncementResponse])
def list_all(
    community_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отримати оголошення спільноти."""
    return get_announcements(db, community_id)