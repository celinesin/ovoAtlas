"""add_explorer_field_to_dataset

Revision ID: b65dad1f2a7e
Revises: 600689e11cf4
Create Date: 2021-06-02 14:52:17.931804

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b65dad1f2a7e"
down_revision = "78103925d379"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("dataset", sa.Column("explorer_url", sa.String(), nullable=True))
    op.create_index(op.f("ix_dataset_explorer_url"), "dataset", ["explorer_url"], unique=False)
    op.execute(
        "UPDATE dataset SET explorer_url=deployment_directory.url "
        "FROM deployment_directory "
        "WHERE deployment_directory.dataset_id=dataset.id;"
    )  # noqa E501
    op.drop_constraint("deployment_directory_dataset_id_fkey", "deployment_directory")
    op.drop_table("deployment_directory")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "deployment_directory",
        sa.Column("id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("dataset_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("url", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "created_at", postgresql.TIMESTAMP(), server_default=sa.text("now()"), autoincrement=False, nullable=False
        ),
        sa.Column(
            "updated_at", postgresql.TIMESTAMP(), server_default=sa.text("now()"), autoincrement=False, nullable=False
        ),
        sa.ForeignKeyConstraint(["dataset_id"], ["dataset.id"], name="deployment_directory_dataset_id_fkey"),
        sa.PrimaryKeyConstraint("id", name="deployment_directory_pkey"),
    )
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute(
        "INSERT into deployment_directory (id, dataset_id, url, created_at, updated_at) "
        "SELECT uuid_generate_v4(), id, explorer_url, NOW(), NOW() "
        "FROM dataset WHERE dataset.explorer_url is not null;"
    )  # noqa E501
    op.drop_index(op.f("ix_dataset_explorer_url"), table_name="dataset")
    op.drop_column("dataset", "explorer_url")
    # ### end Alembic commands ###
