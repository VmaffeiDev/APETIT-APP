from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://apetit:apetit@localhost:5432/apetit"
    api_secret: str = "change-me"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APETIT_",
        extra="ignore",
    )


settings = Settings()
