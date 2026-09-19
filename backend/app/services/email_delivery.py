from __future__ import annotations

import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import parseaddr

from app.settings import settings

MAILTRAP_SANDBOX_API_URL = "https://sandbox.api.mailtrap.io/api/send/{sandbox_id}"
MAILTRAP_SEND_API_URL = "https://send.api.mailtrap.io/api/send"
MAILTRAP_USER_AGENT = "apetit-backend/0.1 (+https://github.com/VmaffeiDev/APETIT-APP)"
LOGIN_EMAIL_SUBJECT = "Seu código de acesso à Apetit"


class EmailDeliveryError(RuntimeError):
    pass


def _login_email_html(code: str, expires_in_minutes: int) -> str:
    return f"""<!doctype html>
<html lang=\"pt-BR\">
  <body style=\"margin:0;background:#f5f4f0;font-family:Arial,sans-serif;color:#171714\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"padding:32px 16px\">
      <tr><td align=\"center\">
        <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:560px;background:#ffffff;border-radius:24px;padding:32px\">
          <tr><td style=\"font-size:12px;letter-spacing:4px;font-weight:700;color:#9a792d\">APETIT</td></tr>
          <tr><td style=\"padding-top:22px;font-size:28px;line-height:34px;font-weight:700\">Seu código de acesso</td></tr>
          <tr><td style=\"padding-top:12px;font-size:15px;line-height:22px;color:#6f6a61\">Use o código abaixo para entrar no aplicativo. Ele expira em {expires_in_minutes} minutos e só pode ser usado uma vez.</td></tr>
          <tr><td align=\"center\" style=\"padding:28px 0\"><div style=\"display:inline-block;background:#171714;color:#d8b248;border-radius:18px;padding:18px 24px;font-size:32px;letter-spacing:8px;font-weight:700\">{code}</div></td></tr>
          <tr><td style=\"font-size:12px;line-height:18px;color:#8a8479\">Se você não solicitou este acesso, ignore este e-mail. Nunca compartilhe seu código com outras pessoas.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _login_email_text(code: str, expires_in_minutes: int) -> str:
    return (
        f"Seu código de acesso à Apetit é {code}. "
        f"Ele expira em {expires_in_minutes} minutos e só pode ser usado uma vez."
    )


def send_login_code(*, recipient: str, code: str, expires_in_minutes: int) -> str:
    provider = settings.normalized_email_provider
    if provider == "console":
        if settings.environment != "development":
            raise EmailDeliveryError("provedor de e-mail 'console' não é permitido fora de development")
        return "console"

    if not settings.email_from:
        raise EmailDeliveryError("remetente não configurado: defina APETIT_EMAIL_FROM")

    text_body = _login_email_text(code, expires_in_minutes)
    html_body = _login_email_html(code, expires_in_minutes)

    if provider == "smtp":
        _send_via_smtp(recipient=recipient, text_body=text_body, html_body=html_body)
        return "smtp"
    if provider == "mailtrap_api":
        _send_via_mailtrap_api(recipient=recipient, text_body=text_body, html_body=html_body)
        return "mailtrap_api"

    raise EmailDeliveryError(f"provedor de e-mail não suportado: {settings.email_provider}")


def _send_via_smtp(*, recipient: str, text_body: str, html_body: str) -> None:
    if not settings.smtp_host:
        raise EmailDeliveryError("SMTP não configurado: defina APETIT_SMTP_HOST")

    message = EmailMessage()
    message["Subject"] = LOGIN_EMAIL_SUBJECT
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    timeout = settings.email_timeout_seconds
    try:
        if settings.smtp_use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=timeout, context=context) as smtp:
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or "")
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=timeout) as smtp:
                smtp.ehlo()
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or "")
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("não foi possível entregar o código por e-mail") from exc


def _mailtrap_url() -> str:
    if settings.mailtrap_api_url:
        return settings.mailtrap_api_url
    if settings.mailtrap_sandbox_id:
        return MAILTRAP_SANDBOX_API_URL.format(sandbox_id=settings.mailtrap_sandbox_id.strip())
    return MAILTRAP_SEND_API_URL


def _sender() -> dict[str, str]:
    name, address = parseaddr(settings.email_from or "")
    if not address or "@" not in address:
        raise EmailDeliveryError("APETIT_EMAIL_FROM inválido; use 'Nome <email@dominio>'")
    sender = {"email": address}
    if name:
        sender["name"] = name
    return sender


def _mailtrap_error_reason(exc: urllib.error.HTTPError) -> str:
    """Resumo curto e seguro do erro (só as mensagens de erro, nunca headers ou token)."""
    try:
        raw = exc.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return "sem corpo"
    try:
        data = json.loads(raw)
    except ValueError:
        snippet = " ".join(raw.split())[:120]
        return f"resposta não-JSON: {snippet}" if snippet else "sem corpo"
    errors = data.get("errors") if isinstance(data, dict) else None
    if isinstance(errors, list):
        return "; ".join(str(item) for item in errors)[:200]
    if isinstance(errors, str):
        return errors[:200]
    return str(data)[:200]


def _send_via_mailtrap_api(*, recipient: str, text_body: str, html_body: str) -> None:
    if not settings.mailtrap_api_token:
        raise EmailDeliveryError("Mailtrap não configurado: defina APETIT_MAILTRAP_API_TOKEN")

    payload = {
        "from": _sender(),
        "to": [{"email": recipient}],
        "subject": LOGIN_EMAIL_SUBJECT,
        "text": text_body,
        "html": html_body,
        "category": "login-code",
    }
    request = urllib.request.Request(
        _mailtrap_url(),
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Api-Token": settings.mailtrap_api_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": MAILTRAP_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.email_timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        reason = _mailtrap_error_reason(exc)
        raise EmailDeliveryError(f"Mailtrap recusou o envio (HTTP {exc.code}): {reason}") from exc
    except (OSError, ValueError) as exc:
        raise EmailDeliveryError("não foi possível contatar a API do Mailtrap") from exc

    if not body.get("success"):
        raise EmailDeliveryError("Mailtrap não confirmou o envio")
