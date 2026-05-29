"""add is_active soft-delete flag to units

Revision ID: a7b3c5d9e8f1
Revises: f6a1b2c3d4e5
Create Date: 2026-05-29 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b3c5d9e8f1'
down_revision: Union[str, None] = 'f6a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "units",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("units", "is_active")
