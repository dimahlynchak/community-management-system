from sqlalchemy.orm import Session

from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate


def create_announcement(db: Session, community_id: int, data: AnnouncementCreate, user_id: int) -> Announcement:
    ann = Announcement(community_id=community_id, **data.model_dump(), created_by=user_id)
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


def get_announcements(db: Session, community_id: int) -> list[Announcement]:
    return db.query(Announcement).filter(
        Announcement.community_id == community_id
    ).order_by(Announcement.created_at.desc()).all()