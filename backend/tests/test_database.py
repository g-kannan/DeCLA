from app.database import sqlalchemy_url


def test_standard_neon_url_uses_psycopg_driver():
    assert sqlalchemy_url("postgresql://user:pass@host/db?sslmode=require") == (
        "postgresql+psycopg://user:pass@host/db?sslmode=require"
    )
