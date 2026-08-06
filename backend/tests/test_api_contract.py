import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql://user:password@example.neon.tech/database?sslmode=require"
)

from app.main import app  # noqa: E402


def test_core_routes_are_exposed():
    paths = app.openapi()["paths"]
    assert "/api/dataflows/{dataflow_id}/comparison" in paths
    assert "/api/dataflows/{dataflow_id}/version-history" in paths
    assert "/api/dataflows/{dataflow_id}/promote" in paths
    assert "/api/definitions/stage-types" in paths
    assert "/api/definitions/log-types" in paths
    assert "/api/logs" in paths
