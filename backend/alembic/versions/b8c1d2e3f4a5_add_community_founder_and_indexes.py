"""add community founder and performance indexes

Revision ID: b8c1d2e3f4a5
Revises: a7b3c5d9e8f1
Create Date: 2026-05-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c1d2e3f4a5"
down_revision: Union[str, None] = "a7b3c5d9e8f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Колонка засновника у communities. Спочатку nullable, далі бекфіл, далі NOT NULL.
    op.add_column(
        "communities",
        sa.Column("founder_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_communities_founder_user_id",
        "communities", "users",
        ["founder_user_id"], ["id"],
    )
    # Backfill: засновником стає перший за часом призначення head конкретної спільноти.
    # Якщо для якоїсь спільноти жодного head ще немає — використовуємо ID першого
    # члена спільноти за порядком assigned_at; як останній фолбек — 1 (admin).
    op.execute(
        """
        UPDATE communities c
        SET founder_user_id = COALESCE(
            (
                SELECT ucr.user_id
                FROM user_community_roles ucr
                JOIN roles r ON r.id = ucr.role_id
                WHERE ucr.community_id = c.id AND r.name = 'head'
                ORDER BY ucr.assigned_at, ucr.id
                LIMIT 1
            ),
            (
                SELECT ucr.user_id
                FROM user_community_roles ucr
                WHERE ucr.community_id = c.id
                ORDER BY ucr.assigned_at, ucr.id
                LIMIT 1
            ),
            1
        )
        WHERE c.founder_user_id IS NULL
        """
    )
    op.alter_column("communities", "founder_user_id", nullable=False)

    # 2. Composite-індекси для масових вибірок.
    # charges часто фільтруються по (community_id, period) і (unit_id, period).
    op.create_index(
        "ix_charges_unit_id_period",
        "charges",
        ["unit_id", "period"],
        if_not_exists=True,
    )
    # payments — по (unit_id, payment_date desc) для PaymentsPage сортувань.
    op.create_index(
        "ix_payments_unit_id_date",
        "payments",
        ["unit_id", "payment_date"],
        if_not_exists=True,
    )
    # payment_allocations — по charge_id для розрахунку залишку боргу.
    op.create_index(
        "ix_payment_allocations_charge_id",
        "payment_allocations",
        ["charge_id"],
        if_not_exists=True,
    )
    # audit_log: пагінація по community_id з найновіших.
    op.create_index(
        "ix_audit_log_community_id_id",
        "audit_log",
        ["community_id", "id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_community_id_id", "audit_log", if_exists=True)
    op.drop_index("ix_payment_allocations_charge_id", "payment_allocations", if_exists=True)
    op.drop_index("ix_payments_unit_id_date", "payments", if_exists=True)
    op.drop_index("ix_charges_unit_id_period", "charges", if_exists=True)
    op.drop_constraint("fk_communities_founder_user_id", "communities", type_="foreignkey")
    op.drop_column("communities", "founder_user_id")
