"""add community/units/charge_types manage permissions

Revision ID: a1b2c3d4e5f6
Revises: 165503d5669b
Create Date: 2026-05-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '165503d5669b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.bulk_insert(
        sa.table(
            "permissions",
            sa.column("id", sa.Integer),
            sa.column("codename", sa.String),
            sa.column("description", sa.String),
        ),
        [
            {"id": 11, "codename": "community:manage", "description": "Редагування та видалення спільноти"},
            {"id": 12, "codename": "units:manage", "description": "Управління приміщеннями"},
            {"id": 13, "codename": "charge_types:manage", "description": "Управління тарифами"},
        ],
    )

    # Усі три — виключна компетенція голови правління (role_id=4)
    op.bulk_insert(
        sa.table(
            "role_permissions",
            sa.column("role_id", sa.Integer),
            sa.column("permission_id", sa.Integer),
        ),
        [
            {"role_id": 4, "permission_id": 11},
            {"role_id": 4, "permission_id": 12},
            {"role_id": 4, "permission_id": 13},
        ],
    )

    op.execute("SELECT setval('permissions_id_seq', 13)")


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission_id IN (11, 12, 13)")
    op.execute("DELETE FROM permissions WHERE id IN (11, 12, 13)")
    op.execute("SELECT setval('permissions_id_seq', 10)")
