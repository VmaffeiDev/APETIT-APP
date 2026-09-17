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
