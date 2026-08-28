from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "local"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    groq_api_key: str = ""
    openrouter_api_key: str = ""

    fcm_server_key: str = ""

    cors_allowed_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
