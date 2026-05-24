"""add audit log insert-only trigger

Revision ID: 165503d5669b
Revises: 6e630ee59d9d
Create Date: 2026-05-24 09:34:39.902074

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '165503d5669b'
down_revision: Union[str, None] = '6e630ee59d9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Modification of audit_log is not allowed. This table is append-only.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_audit_log_no_update
        BEFORE UPDATE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

        CREATE TRIGGER trg_audit_log_no_delete
        BEFORE DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_modification();")
