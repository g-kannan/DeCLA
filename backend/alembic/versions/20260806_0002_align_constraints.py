"""Align database constraints with the SQLAlchemy models.

Revision ID: 20260806_0002
Revises: 20260805_0001
"""

from alembic import op

revision = "20260806_0002"
down_revision = "20260805_0001"
branch_labels = None
depends_on = None


RESTRICT_FOREIGN_KEYS = (
    (
        "stages_stage_type_version_id_fkey",
        "stages",
        "stage_type_versions",
        ["stage_type_version_id"],
    ),
    (
        "version_measure_values_measure_definition_id_fkey",
        "version_measure_values",
        "measure_definitions",
        ["measure_definition_id"],
    ),
    (
        "pipeline_runs_dataflow_version_id_fkey",
        "pipeline_runs",
        "dataflow_versions",
        ["dataflow_version_id"],
    ),
    (
        "stage_runs_stage_id_fkey",
        "stage_runs",
        "stages",
        ["stage_id"],
    ),
    (
        "log_events_log_type_version_id_fkey",
        "log_events",
        "log_type_versions",
        ["log_type_version_id"],
    ),
)


def _replace_foreign_keys(ondelete: str | None) -> None:
    for name, source_table, target_table, columns in RESTRICT_FOREIGN_KEYS:
        op.drop_constraint(name, source_table, type_="foreignkey")
        op.create_foreign_key(
            name,
            source_table,
            target_table,
            columns,
            ["id"],
            ondelete=ondelete,
        )


def upgrade() -> None:
    op.execute(
        "ALTER TABLE dataflow_versions RENAME CONSTRAINT "
        "dataflow_versions_version_number_check TO ck_version_number_positive"
    )
    op.execute(
        "ALTER TABLE stages RENAME CONSTRAINT "
        "stages_position_check TO ck_stage_position_nonnegative"
    )
    _replace_foreign_keys("RESTRICT")


def downgrade() -> None:
    _replace_foreign_keys(None)
    op.execute(
        "ALTER TABLE stages RENAME CONSTRAINT "
        "ck_stage_position_nonnegative TO stages_position_check"
    )
    op.execute(
        "ALTER TABLE dataflow_versions RENAME CONSTRAINT "
        "ck_version_number_positive TO dataflow_versions_version_number_check"
    )
