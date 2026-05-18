from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserCommunityRole(Base):
    __tablename__ = "user_community_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "community_id", name="uq_user_community"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    community_id: Mapped[int] = mapped_column(ForeignKey("communities.id"))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"))
    assigned_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="community_roles")
    community: Mapped["Community"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship()
    unit: Mapped["Unit | None"] = relationship()