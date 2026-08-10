"""Initial versioned dataflow schema.

Revision ID: 20260805_0001
Revises:
"""

from alembic import op

revision = "20260805_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE dataflows (
          id UUID PRIMARY KEY, name VARCHAR(160) NOT NULL, description TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE dataflow_versions (
          id UUID PRIMARY KEY, dataflow_id UUID NOT NULL REFERENCES dataflows(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL CHECK (version_number > 0), version_name VARCHAR(160) NOT NULL,
          change_summary TEXT NOT NULL DEFAULT '', business_goal TEXT NOT NULL DEFAULT '',
          latency_target_minutes NUMERIC(14,2), monthly_budget NUMERIC(16,2),
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          created_from_version_id UUID REFERENCES dataflow_versions(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ,
          CONSTRAINT uq_dataflow_version_number UNIQUE(dataflow_id, version_number)
        );
        CREATE INDEX ix_dataflow_versions_dataflow_id ON dataflow_versions(dataflow_id);
        CREATE INDEX ix_dataflow_versions_status ON dataflow_versions(status);
        CREATE TABLE dataflow_version_tags (
          id UUID PRIMARY KEY, dataflow_id UUID NOT NULL REFERENCES dataflows(id) ON DELETE CASCADE,
          version_id UUID NOT NULL REFERENCES dataflow_versions(id) ON DELETE CASCADE,
          tag VARCHAR(40) NOT NULL, valid_from TIMESTAMPTZ NOT NULL DEFAULT now(), valid_to TIMESTAMPTZ
        );
        CREATE INDEX ix_dataflow_version_tags_dataflow_id ON dataflow_version_tags(dataflow_id);
        CREATE INDEX ix_dataflow_version_tags_version_id ON dataflow_version_tags(version_id);
        CREATE UNIQUE INDEX uq_active_dataflow_tag ON dataflow_version_tags(dataflow_id, tag) WHERE valid_to IS NULL;

        CREATE TABLE stage_types (
          id UUID PRIMARY KEY, key VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
          category VARCHAR(80) NOT NULL, icon VARCHAR(20) NOT NULL DEFAULT 'STG',
          color VARCHAR(20) NOT NULL DEFAULT '#4f46e5', enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_stage_types_category ON stage_types(category);
        CREATE TABLE stage_type_versions (
          id UUID PRIMARY KEY, stage_type_id UUID NOT NULL REFERENCES stage_types(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL, property_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'published', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_stage_type_version UNIQUE(stage_type_id, version_number)
        );
        CREATE INDEX ix_stage_type_versions_stage_type_id ON stage_type_versions(stage_type_id);
        CREATE TABLE stages (
          id UUID PRIMARY KEY, dataflow_version_id UUID NOT NULL REFERENCES dataflow_versions(id) ON DELETE CASCADE,
          logical_key VARCHAR(100) NOT NULL, stage_type_version_id UUID NOT NULL REFERENCES stage_type_versions(id),
          position INTEGER NOT NULL CHECK (position >= 0), label VARCHAR(160) NOT NULL,
          platform VARCHAR(160) NOT NULL DEFAULT '', properties JSONB NOT NULL DEFAULT '{}'::jsonb,
          note TEXT NOT NULL DEFAULT '',
          CONSTRAINT uq_version_stage_key UNIQUE(dataflow_version_id, logical_key),
          CONSTRAINT uq_version_stage_position UNIQUE(dataflow_version_id, position)
        );
        CREATE INDEX ix_stages_dataflow_version_id ON stages(dataflow_version_id);
        CREATE TABLE stage_connections (
          id UUID PRIMARY KEY, dataflow_version_id UUID NOT NULL REFERENCES dataflow_versions(id) ON DELETE CASCADE,
          from_stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
          to_stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
          CONSTRAINT uq_stage_connection UNIQUE(dataflow_version_id, from_stage_id, to_stage_id)
        );
        CREATE INDEX ix_stage_connections_dataflow_version_id ON stage_connections(dataflow_version_id);

        CREATE TABLE measure_definitions (
          id UUID PRIMARY KEY, key VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL,
          description TEXT NOT NULL DEFAULT '', value_type VARCHAR(30) NOT NULL DEFAULT 'number',
          unit VARCHAR(40) NOT NULL DEFAULT 'count', aggregation VARCHAR(30) NOT NULL DEFAULT 'sum',
          improvement_direction VARCHAR(30) NOT NULL DEFAULT 'lower_is_better',
          display_order INTEGER NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE version_measure_values (
          id UUID PRIMARY KEY, dataflow_version_id UUID NOT NULL REFERENCES dataflow_versions(id) ON DELETE CASCADE,
          stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
          measure_definition_id UUID NOT NULL REFERENCES measure_definitions(id),
          numeric_value NUMERIC(18,4), text_value TEXT, source VARCHAR(30) NOT NULL DEFAULT 'estimated',
          explanation TEXT NOT NULL DEFAULT '', measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_version_measure_values_dataflow_version_id ON version_measure_values(dataflow_version_id);
        CREATE INDEX ix_version_measure_values_stage_id ON version_measure_values(stage_id);
        CREATE INDEX ix_version_measure_values_measure_definition_id ON version_measure_values(measure_definition_id);
        CREATE UNIQUE INDEX uq_flow_measure_value ON version_measure_values(dataflow_version_id, measure_definition_id) WHERE stage_id IS NULL;
        CREATE UNIQUE INDEX uq_stage_measure_value ON version_measure_values(dataflow_version_id, stage_id, measure_definition_id) WHERE stage_id IS NOT NULL;

        CREATE TABLE log_types (
          id UUID PRIMARY KEY, key VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL,
          description TEXT NOT NULL DEFAULT '', enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE log_type_versions (
          id UUID PRIMARY KEY, log_type_id UUID NOT NULL REFERENCES log_types(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL, field_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'published', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_log_type_version UNIQUE(log_type_id, version_number)
        );
        CREATE INDEX ix_log_type_versions_log_type_id ON log_type_versions(log_type_id);
        CREATE TABLE pipeline_runs (
          id UUID PRIMARY KEY, dataflow_version_id UUID NOT NULL REFERENCES dataflow_versions(id),
          external_id VARCHAR(160) UNIQUE, status VARCHAR(30) NOT NULL DEFAULT 'running',
          business_event_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_pipeline_runs_dataflow_version_id ON pipeline_runs(dataflow_version_id);
        CREATE INDEX ix_pipeline_runs_status ON pipeline_runs(status);
        CREATE TABLE stage_runs (
          id UUID PRIMARY KEY, pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
          stage_id UUID NOT NULL REFERENCES stages(id), status VARCHAR(30) NOT NULL DEFAULT 'running',
          started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
          CONSTRAINT uq_run_stage UNIQUE(pipeline_run_id, stage_id)
        );
        CREATE INDEX ix_stage_runs_pipeline_run_id ON stage_runs(pipeline_run_id);
        CREATE INDEX ix_stage_runs_stage_id ON stage_runs(stage_id);
        CREATE INDEX ix_stage_runs_status ON stage_runs(status);
        CREATE TABLE log_events (
          id UUID PRIMARY KEY, pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
          stage_run_id UUID REFERENCES stage_runs(id) ON DELETE CASCADE,
          log_type_version_id UUID NOT NULL REFERENCES log_type_versions(id),
          idempotency_key VARCHAR(180) NOT NULL UNIQUE, occurred_at TIMESTAMPTZ NOT NULL,
          severity VARCHAR(20) NOT NULL DEFAULT 'info', message TEXT NOT NULL DEFAULT '',
          source VARCHAR(120) NOT NULL DEFAULT 'api', correlation_id VARCHAR(180),
          payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_log_events_pipeline_run_id ON log_events(pipeline_run_id);
        CREATE INDEX ix_log_events_stage_run_id ON log_events(stage_run_id);
        CREATE INDEX ix_log_events_log_type_version_id ON log_events(log_type_version_id);
        CREATE INDEX ix_log_events_occurred_at ON log_events(occurred_at);
        CREATE INDEX ix_log_events_severity ON log_events(severity);
        CREATE INDEX ix_log_events_correlation_id ON log_events(correlation_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS log_events;
        DROP TABLE IF EXISTS stage_runs;
        DROP TABLE IF EXISTS pipeline_runs;
        DROP TABLE IF EXISTS log_type_versions;
        DROP TABLE IF EXISTS log_types;
        DROP TABLE IF EXISTS version_measure_values;
        DROP TABLE IF EXISTS measure_definitions;
        DROP TABLE IF EXISTS stage_connections;
        DROP TABLE IF EXISTS stages;
        DROP TABLE IF EXISTS stage_type_versions;
        DROP TABLE IF EXISTS stage_types;
        DROP TABLE IF EXISTS dataflow_version_tags;
        DROP TABLE IF EXISTS dataflow_versions;
        DROP TABLE IF EXISTS dataflows;
        """
    )
