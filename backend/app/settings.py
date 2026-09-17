from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://apetit:apetit@localhost:5432/apetit"
    api_secret: str = "change-me"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

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

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def readiness(self) -> dict:
        checks: dict[str, dict[str, str | bool]] = {}

        database_ready = bool(self.database_url.strip())
        checks["database"] = {
            "ready": database_ready,
            "detail": "database_url configurada" if database_ready else "database_url ausente",
        }

        if self.environment == "development" and self.email_provider == "console":
            checks["email"] = {"ready": True, "detail": "console permitido em development"}
        else:
            email_ready = (
                self.email_provider == "smtp"
                and bool(self.email_from)
                and bool(self.smtp_host)
                and bool(self.smtp_username)
                and bool(self.smtp_password)
            )
            checks["email"] = {
                "ready": email_ready,
                "detail": "SMTP configurado" if email_ready else "SMTP incompleto",
            }

        if self.ocr_provider == "none":
            ocr_ready = self.environment == "development"
            detail = "OCR opcional em development" if ocr_ready else "OCR não configurado"
        elif self.ocr_provider == "google_vision":
            ocr_ready = bool(self.google_vision_api_key)
            detail = "Google Vision configurado" if ocr_ready else "Google Vision sem credencial"
        else:
            ocr_ready = False
            detail = f"provider OCR não suportado: {self.ocr_provider}"
        checks["ocr"] = {"ready": ocr_ready, "detail": detail}

        secret_ready = self.environment == "development" or (
            bool(self.api_secret) and self.api_secret != "change-me"
        )
        checks["admin_secret"] = {
            "ready": secret_ready,
            "detail": "segredo administrativo configurado" if secret_ready else "troque APETIT_API_SECRET",
        }

        cors_ready = bool(self.allowed_origins)
        checks["cors"] = {
            "ready": cors_ready,
            "detail": ", ".join(self.allowed_origins) if cors_ready else "nenhuma origem permitida",
        }

        return {
            "status": "ready" if all(bool(item["ready"]) for item in checks.values()) else "not_ready",
            "environment": self.environment,
            "checks": checks,
        }


settings = Settings()
