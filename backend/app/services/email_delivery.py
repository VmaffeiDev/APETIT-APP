from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from app.settings import settings


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


def send_login_code(*, recipient: str, code: str, expires_in_minutes: int) -> str:
    provider = settings.email_provider.strip().lower()
    if provider == "console":
        if settings.environment != "development":
            raise EmailDeliveryError("provedor de e-mail 'console' não é permitido fora de development")
        return "console"

    if provider != "smtp":
        raise EmailDeliveryError(f"provedor de e-mail não suportado: {settings.email_provider}")

    if not settings.smtp_host or not settings.email_from:
        raise EmailDeliveryError("SMTP não configurado: defina APETIT_SMTP_HOST e APETIT_EMAIL_FROM")

    message = EmailMessage()
    message["Subject"] = "Seu código de acesso à Apetit"
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(
        f"Seu código de acesso à Apetit é {code}. "
        f"Ele expira em {expires_in_minutes} minutos e só pode ser usado uma vez."
    )
    message.add_alternative(_login_email_html(code, expires_in_minutes), subtype="html")

    try:
        if settings.smtp_use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10, context=context) as smtp:
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or "")
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.ehlo()
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or "")
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("não foi possível entregar o código por e-mail") from exc

    return "smtp"
