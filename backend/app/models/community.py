from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Community(Base):
    __tablename__ = "communities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(String(500))
    edrpou: Mapped[str | None] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    # ID користувача-засновника. Захищає спільноту від ворожого захоплення
    # одним rogue-головою: засновника не можна видалити з ролі head і не можна
    # знизити роль; передати засновництво може лише він сам через
    # POST /communities/{id}/transfer-founder.
    founder_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    units: Mapped[list["Unit"]] = relationship(back_populates="community")
    user_roles: Mapped[list["UserCommunityRole"]] = relationship(back_populates="community")
    charge_types: Mapped[list["ChargeType"]] = relationship(back_populates="community")
    budget_items: Mapped[list["BudgetItem"]] = relationship(back_populates="community")
    announcements: Mapped[list["Announcement"]] = relationship(back_populates="community")