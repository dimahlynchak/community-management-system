"""add unique constraint on payment_allocations(payment_id, charge_id)

Revision ID: f6a1b2c3d4e5
Revises: e5f6a1b2c3d4
Create Date: 2026-05-28 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f6a1b2c3d4e5'
down_revision: Union[str, None] = 'e5f6a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Захист від дублювання allocation: на пару (payment, charge) має існувати
    # не більше одного рядка
    op.create_unique_constraint(
        "uq_payment_allocations_payment_charge",
        "payment_allocations",
        ["payment_id", "charge_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_payment_allocations_payment_charge",
        "payment_allocations",
        type_="unique",
    )
