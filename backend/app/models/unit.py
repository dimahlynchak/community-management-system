from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("community_id", "number", name="uq_units_community_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("communities.id"))
    number: Mapped[str] = mapped_column(String(20))
    type: Mapped[str] = mapped_column(String(20))
    area: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    floor: Mapped[int | None]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    community: Mapped["Community"] = relationship(back_populates="units")
    charges: Mapped[list["Charge"]] = relationship(back_populates="unit")
    payments: Mapped[list["Payment"]] = relationship(back_populates="unit")