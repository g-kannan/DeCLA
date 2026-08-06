from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DeCLA API"
    environment: str = "development"
    database_url: str
    database_migration_url: str | None = None
    cors_origins: list[str] = Field(default=["http://localhost:3000"])

    @property
    def migration_url(self) -> str:
        return self.database_migration_url or self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
