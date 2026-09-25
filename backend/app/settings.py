from pydantic import field_validator
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

    mailtrap_api_token: str | None = None
    mailtrap_sandbox_id: str | None = None
    mailtrap_api_url: str | None = None
    email_timeout_seconds: int = 10

    ocr_provider: str = "none"
    google_vision_api_key: str | None = None
    ocr_timeout_seconds: int = 20
    ocr_pdf_max_pages: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APETIT_",
        extra="ignore",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def normalized_email_provider(self) -> str:
        return self.email_provider.strip().lower()

    def _email_readiness(self) -> dict[str, str | bool]:
        provider = self.normalized_email_provider
        if provider == "console":
            if self.environment == "development":
                return {"ready": True, "detail": "provider console (permitido em development)"}
            return {"ready": False, "detail": "provider console não é permitido fora de development"}

        missing: list[str] = []
        if not self.email_from:
            missing.append("APETIT_EMAIL_FROM")

        if provider == "smtp":
            for name, value in (
                ("APETIT_SMTP_HOST", self.smtp_host),
                ("APETIT_SMTP_USERNAME", self.smtp_username),
                ("APETIT_SMTP_PASSWORD", self.smtp_password),
            ):
                if not value:
                    missing.append(name)
            label = "provider smtp"
        elif provider == "mailtrap_api":
            if not self.mailtrap_api_token:
                missing.append("APETIT_MAILTRAP_API_TOKEN")
            mode = "sandbox" if self.mailtrap_sandbox_id else "envio real"
            label = f"provider mailtrap_api ({mode})"
        else:
            return {"ready": False, "detail": f"provider de e-mail não suportado: {self.email_provider}"}

        if missing:
            return {"ready": False, "detail": f"{label} incompleto: falta {', '.join(missing)}"}
        return {"ready": True, "detail": f"{label} configurado"}

    def readiness(self) -> dict:
        checks: dict[str, dict[str, str | bool]] = {}

        database_ready = bool(self.database_url.strip())
        checks["database"] = {
            "ready": database_ready,
            "detail": "database_url configurada" if database_ready else "database_url ausente",
        }

        checks["email"] = self._email_readiness()

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
