"""add unique constraint on communities.edrpou

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-05-25 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a1b2c3'
down_revision: Union[str, None] = 'c3d4e5f6a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL != NULL у PostgreSQL, тому кілька ОСББ без ЄДРПОУ (NULL) — не порушення.
    # Якщо в БД є дублікатні ненульові ЄДРПОУ від тестів, спочатку очисти їх:
    # UPDATE communities SET edrpou = NULL WHERE id NOT IN (SELECT MIN(id) FROM communities GROUP BY edrpou);
    op.create_index(
        "ix_communities_edrpou_unique",
        "communities",
        ["edrpou"],
        unique=True,
        postgresql_where="edrpou IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("ix_communities_edrpou_unique", table_name="communities")
