import json

import pytest

from app.services import email_delivery
from app.settings import Settings


class _FakeResponse:
    def __init__(self, body: dict):
        self._body = json.dumps(body).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _use(monkeypatch, **overrides):
    base = {
        "_env_file": None,
        "environment": "staging",
        "email_from": "Apetit Staging <no-reply@example.com>",
    }
    base.update(overrides)
    monkeypatch.setattr(email_delivery, "settings", Settings(**base))


def test_mailtrap_sandbox_request(monkeypatch):
    _use(monkeypatch, email_provider="mailtrap_api", mailtrap_api_token="tok", mailtrap_sandbox_id="4916789")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data)
        captured["timeout"] = timeout
        return _FakeResponse({"success": True, "message_ids": ["1"]})

    monkeypatch.setattr(email_delivery.urllib.request, "urlopen", fake_urlopen)
    result = email_delivery.send_login_code(recipient="ana@example.com", code="123456", expires_in_minutes=10)

    assert result == "mailtrap_api"
    assert captured["url"] == "https://sandbox.api.mailtrap.io/api/send/4916789"
    assert captured["headers"]["Api-token"] == "tok"
    assert captured["body"]["from"] == {"email": "no-reply@example.com", "name": "Apetit Staging"}
    assert captured["body"]["to"] == [{"email": "ana@example.com"}]
    assert "123456" in captured["body"]["text"] and "123456" in captured["body"]["html"]
    assert captured["timeout"] == 10


def test_mailtrap_live_url_without_sandbox(monkeypatch):
    _use(monkeypatch, email_provider="mailtrap_api", mailtrap_api_token="tok")
    assert email_delivery._mailtrap_url() == "https://send.api.mailtrap.io/api/send"


def test_mailtrap_http_error_becomes_delivery_error(monkeypatch):
    _use(monkeypatch, email_provider="mailtrap_api", mailtrap_api_token="bad", mailtrap_sandbox_id="1")

    def fake_urlopen(request, timeout):
        raise email_delivery.urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr(email_delivery.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(email_delivery.EmailDeliveryError, match="HTTP 401"):
        email_delivery.send_login_code(recipient="ana@example.com", code="1", expires_in_minutes=10)


def test_mailtrap_requires_token(monkeypatch):
    _use(monkeypatch, email_provider="mailtrap_api")
    with pytest.raises(email_delivery.EmailDeliveryError, match="MAILTRAP_API_TOKEN"):
        email_delivery.send_login_code(recipient="ana@example.com", code="1", expires_in_minutes=10)


def test_unknown_provider_rejected(monkeypatch):
    _use(monkeypatch, email_provider="sendgrid")
    with pytest.raises(email_delivery.EmailDeliveryError, match="não suportado"):
        email_delivery.send_login_code(recipient="ana@example.com", code="1", expires_in_minutes=10)
