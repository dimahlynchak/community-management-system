from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChargeType(Base):
    __tablename__ = "charge_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("communities.id"))
    name: Mapped[str] = mapped_column(String(200))
    calculation_method: Mapped[str] = mapped_column(String(20))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    community: Mapped["Community"] = relationship(back_populates="charge_types")
    charges: Mapped[list["Charge"]] = relationship(back_populates="charge_type")


class Charge(Base):
    __tablename__ = "charges"
    __table_args__ = (
        UniqueConstraint(
            "unit_id", "charge_type_id", "period",
            name="uq_charge_unit_type_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"))
    charge_type_id: Mapped[int] = mapped_column(ForeignKey("charge_types.id"))
    period: Mapped[str] = mapped_column(String(7))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    unit: Mapped["Unit"] = relationship(back_populates="charges")
    charge_type: Mapped["ChargeType"] = relationship(back_populates="charges")
    creator: Mapped["User"] = relationship()
    allocations: Mapped[list["PaymentAllocation"]] = relationship(back_populates="charge")