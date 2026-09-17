from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://apetit:apetit@localhost:5432/apetit"
    api_secret: str = "change-me"

    email_provider: str = "console"
    email_from: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = True
    smtp_use_ssl: bool = False

    ocr_provider: str = "none"
    google_vision_api_key: str | None = None
    ocr_timeout_seconds: int = 20
    ocr_pdf_max_pages: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APETIT_",
        extra="ignore",
    )


settings = Settings()
