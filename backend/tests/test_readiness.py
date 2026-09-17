from app.settings import Settings


def test_development_defaults_are_ready():
    settings = Settings(_env_file=None)
    payload = settings.readiness()
    assert payload["status"] == "ready"
    assert payload["checks"]["email"]["ready"] is True
    assert payload["checks"]["ocr"]["ready"] is True


def test_staging_requires_real_integrations():
    settings = Settings(
        _env_file=None,
        environment="staging",
        api_secret="change-me",
        email_provider="console",
        ocr_provider="none",
    )
    payload = settings.readiness()
    assert payload["status"] == "not_ready"
    assert payload["checks"]["email"]["ready"] is False
    assert payload["checks"]["ocr"]["ready"] is False
    assert payload["checks"]["admin_secret"]["ready"] is False


def test_staging_with_smtp_and_vision_is_ready():
    settings = Settings(
        _env_file=None,
        environment="staging",
        database_url="postgresql+psycopg://user:pass@db/apetit",
        api_secret="a-long-random-secret",
        cors_origins="https://admin-staging.apetit.example",
        email_provider="smtp",
        email_from="Apetit <staging@apetit.example>",
        smtp_host="smtp.example",
        smtp_username="user",
        smtp_password="secret",
        ocr_provider="google_vision",
        google_vision_api_key="test-key",
    )
    payload = settings.readiness()
    assert payload["status"] == "ready"
    assert all(item["ready"] for item in payload["checks"].values())


def _staging(**overrides):
    base = {
        "_env_file": None,
        "environment": "staging",
        "api_secret": "a-long-random-secret",
        "email_from": "Apetit <no-reply@example.com>",
        "ocr_provider": "google_vision",
        "google_vision_api_key": "k",
    }
    base.update(overrides)
    return Settings(**base).readiness()


def test_mailtrap_api_ready_ignores_smtp_vars():
    payload = _staging(email_provider="mailtrap_api", mailtrap_api_token="tok", mailtrap_sandbox_id="1")
    assert payload["checks"]["email"] == {
        "ready": True,
        "detail": "provider mailtrap_api (sandbox) configurado",
    }
    assert payload["status"] == "ready"


def test_mailtrap_api_without_token_not_ready_even_with_smtp_vars():
    payload = _staging(
        email_provider="mailtrap_api",
        smtp_host="smtp.example",
        smtp_username="u",
        smtp_password="p",
    )
    assert payload["checks"]["email"]["ready"] is False
    assert "APETIT_MAILTRAP_API_TOKEN" in payload["checks"]["email"]["detail"]


def test_smtp_incomplete_lists_missing_vars():
    payload = _staging(email_provider="smtp", smtp_host="smtp.example")
    detail = payload["checks"]["email"]["detail"]
    assert payload["checks"]["email"]["ready"] is False
    assert "APETIT_SMTP_USERNAME" in detail and "APETIT_SMTP_PASSWORD" in detail


def test_unknown_email_provider_not_ready():
    payload = _staging(email_provider="sendgrid")
    assert payload["checks"]["email"]["ready"] is False
