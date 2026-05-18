from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(server_default=func.now())
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    community_id: Mapped[int | None] = mapped_column(ForeignKey("communities.id"))
    action: Mapped[str] = mapped_column(String(20))
    resource: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[int | None]
    details: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    previous_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))