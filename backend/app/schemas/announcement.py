from datetime import datetime

from pydantic import BaseModel, field_validator


class AnnouncementCreate(BaseModel):
    title: str
    body: str

    @field_validator("title")
    @classmethod
    def _validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title must not be empty")
        if len(v) > 200:
            raise ValueError("title must be at most 200 characters long")
        return v

    @field_validator("body")
    @classmethod
    def _validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("body must not be empty")
        return v


class AnnouncementResponse(BaseModel):
    id: int
    community_id: int
    title: str
    body: str
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}
