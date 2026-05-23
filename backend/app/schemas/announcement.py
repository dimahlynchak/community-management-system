from datetime import datetime

from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    body: str


class AnnouncementResponse(BaseModel):
    id: int
    community_id: int
    title: str
    body: str
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}