"""seed roles and permissions

Revision ID: 6e630ee59d9d
Revises: cdcfc75c5dab
Create Date: 2026-05-23 22:50:34.530061

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e630ee59d9d'
down_revision: Union[str, None] = 'cdcfc75c5dab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ролі з ієрархією
    roles = op.bulk_insert(
        sa.table(
            "roles",
            sa.column("id", sa.Integer),
            sa.column("name", sa.String),
            sa.column("display_name", sa.String),
            sa.column("parent_role_id", sa.Integer),
        ),
        [
            {"id": 1, "name": "resident", "display_name": "Мешканець", "parent_role_id": None},
            {"id": 2, "name": "technician", "display_name": "Технічний працівник", "parent_role_id": 1},
            {"id": 3, "name": "accountant", "display_name": "Бухгалтер", "parent_role_id": 2},
            {"id": 4, "name": "head", "display_name": "Голова правління", "parent_role_id": 3},
        ],
    )

    # Дозволи
    op.bulk_insert(
        sa.table(
            "permissions",
            sa.column("id", sa.Integer),
            sa.column("codename", sa.String),
            sa.column("description", sa.String),
        ),
        [
            {"id": 1, "codename": "own_charges:read", "description": "Перегляд власних нарахувань"},
            {"id": 2, "codename": "payments:read", "description": "Перегляд оплат"},
            {"id": 3, "codename": "announcements:create", "description": "Створення оголошень"},
            {"id": 4, "codename": "charges:read", "description": "Перегляд усіх нарахувань"},
            {"id": 5, "codename": "charges:create", "description": "Створення нарахувань"},
            {"id": 6, "codename": "payments:create", "description": "Реєстрація оплат"},
            {"id": 7, "codename": "reports:generate", "description": "Генерація звітів"},
            {"id": 8, "codename": "users:manage", "description": "Управління користувачами"},
            {"id": 9, "codename": "budget:manage", "description": "Управління бюджетом"},
            {"id": 10, "codename": "audit:read", "description": "Перегляд журналу аудиту"},
        ],
    )

    # Зв'язки роль↔дозвіл (тільки прямі, ієрархія обчислюється в коді)
    op.bulk_insert(
        sa.table(
            "role_permissions",
            sa.column("role_id", sa.Integer),
            sa.column("permission_id", sa.Integer),
        ),
        [
            # resident: own_charges:read, payments:read
            {"role_id": 1, "permission_id": 1},
            {"role_id": 1, "permission_id": 2},
            # technician: announcements:create
            {"role_id": 2, "permission_id": 3},
            # accountant: charges:read, charges:create, payments:create, reports:generate
            {"role_id": 3, "permission_id": 4},
            {"role_id": 3, "permission_id": 5},
            {"role_id": 3, "permission_id": 6},
            {"role_id": 3, "permission_id": 7},
            # head: users:manage, budget:manage, audit:read
            {"role_id": 4, "permission_id": 8},
            {"role_id": 4, "permission_id": 9},
            {"role_id": 4, "permission_id": 10},
        ],
    )

    # Скидаємо sequence щоб нові записи не конфліктували
    op.execute("SELECT setval('roles_id_seq', 4)")
    op.execute("SELECT setval('permissions_id_seq', 10)")


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM permissions")
    op.execute("DELETE FROM user_community_roles")
    op.execute("DELETE FROM roles")
