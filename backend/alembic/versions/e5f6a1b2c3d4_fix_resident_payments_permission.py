"""fix resident role: remove payments:read, grant it to accountant

Revision ID: e5f6a1b2c3d4
Revises: d4e5f6a1b2c3
Create Date: 2026-05-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e5f6a1b2c3d4'
down_revision: Union[str, None] = 'd4e5f6a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Мешканець (role_id=1) не повинен мати payments:read (permission_id=2):
    # цей дозвіл відкривав доступ до /payments?unit_id=X і дозволяв читати
    # платежі будь-якого юніта в спільноті. Право переходить до бухгалтера
    # (role_id=3), а голова правління (role_id=4) успадковує його через ієрархію.
    op.execute("DELETE FROM role_permissions WHERE role_id = 1 AND permission_id = 2")
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "VALUES (3, 2) "
        "ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE role_id = 3 AND permission_id = 2")
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "VALUES (1, 2) "
        "ON CONFLICT DO NOTHING"
    )
