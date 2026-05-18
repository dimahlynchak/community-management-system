from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("communities.id"))
    period: Mapped[str] = mapped_column(String(7))
    category: Mapped[str] = mapped_column(String(200))
    planned_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(String(500))
    document_ref: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    community: Mapped["Community"] = relationship(back_populates="budget_items")
    creator: Mapped["User"] = relationship()