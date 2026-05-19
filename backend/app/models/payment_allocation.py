from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"))
    charge_id: Mapped[int] = mapped_column(ForeignKey("charges.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    payment: Mapped["Payment"] = relationship(back_populates="allocations")
    charge: Mapped["Charge"] = relationship(back_populates="allocations")