"""init DDL

Revision ID: f25d1dab29bf
Revises: 
Create Date: 2025-04-03 02:29:19.295326

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f25d1dab29bf"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import os

    # Determine the directory of the current migration script.
    current_dir = os.path.dirname(os.path.realpath(__file__))
    # Build the full path to the SQL file.
    sql_file_path = os.path.join(current_dir, f"{revision}_init_ddl.sql")

    # Read the SQL file.
    with open(sql_file_path, "r") as file:
        sql_commands = file.read()

    # Execute the SQL commands.
    op.execute(sql_commands)


def downgrade() -> None:
    """Downgrade schema."""
    pass
