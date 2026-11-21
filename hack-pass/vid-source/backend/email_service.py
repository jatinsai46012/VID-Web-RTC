import os
import re
import ipaddress
import asyncio
import logging
import smtplib
from email.message import EmailMessage
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

from fastapi import HTTPException

logger = logging.getLogger(__name__)

_DEFAULT_FROM_NAME = "VID"

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _from_name() -> str:
    return os.environ.get("EMAIL_FROM_NAME", _DEFAULT_FROM_NAME)


def smtp_configured() -> bool:
    """True when real SMTP credentials are present. False means dev fallback mode."""
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


def _build_message(*, to: str, subject: str, html: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = f"{_from_name()} <{os.environ['SMTP_USER']}>"
    msg["To"] = to
    msg["Subject"] = subject
    if os.environ.get("EMAIL_REPLY_TO"):
        msg["Reply-To"] = os.environ["EMAIL_REPLY_TO"]
    msg.set_content("Your mail client does not support HTML email. Your sign-in code is in the HTML version.")
    msg.add_alternative(html, subtype="html")
    return msg


def _send_smtp(msg: EmailMessage, to: str) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    with smtplib.SMTP(host, port, timeout=30) as server:
        if os.environ.get("SMTP_STARTTLS", "true").lower() != "false":
            server.starttls()
        server.login(user, password)
        server.send_message(msg, from_addr=user, to_addrs=[to])


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if not smtp_configured():
        logger.warning("SMTP not configured — email to %s not sent. Subject: %s", to, subject)
        return None
    msg = _build_message(to=to, subject=subject, html=html)
    try:
        await asyncio.to_thread(_send_smtp, msg, to)
    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP authentication failed: %s", e)
        raise HTTPException(status_code=502, detail="Email sign-in is misconfigured. Please contact the site owner.")
    except (smtplib.SMTPException, OSError) as e:
        logger.error("SMTP send failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to send email")
    return None


async def send_otp_email(to: str, code: str, name: str = ""):
    if not smtp_configured():
        logger.warning("=" * 64)
        logger.warning("SMTP NOT CONFIGURED — sign-in code for %s is: %s", to, code)
        logger.warning("Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in backend/.env")
        logger.warning("to have real codes emailed instead of printed here.")
        logger.warning("=" * 64)
        return

    brand = escape(_from_name())
    digits = "".join(
        f'<td style="padding:0 4px"><div style="width:44px;height:54px;line-height:54px;border-radius:10px;'
        f'background:#e6fbf8;color:#0b3f3b;font:bold 26px Arial,sans-serif;text-align:center">{escape(d)}</div></td>'
        for d in code
    )
    hi = f"Hi {escape(name)}," if name else "Hi,"
    html = (
        '<table role="presentation" width="100%" style="background:#5fe3d8;padding:32px 0"><tr><td align="center">'
        '<table role="presentation" width="440" style="background:#ffffff;border-radius:20px;padding:32px;font-family:Arial,sans-serif">'
        f'<tr><td style="font-size:26px;font-weight:bold;color:#0b3f3b">{brand}</td></tr>'
        f'<tr><td style="padding-top:16px;color:#334155;font-size:15px">{hi}<br>Use this code to sign in. It expires in 10 minutes.</td></tr>'
        f'<tr><td align="center" style="padding:24px 0"><table role="presentation"><tr>{digits}</tr></table></td></tr>'
        '<tr><td style="color:#64748b;font-size:13px">Type it into the sign-in screen. If you did not try to sign in, you can ignore this email.</td></tr>'
        f'<tr><td style="padding-top:20px;font-size:12px;color:#94a3b8">Sent by {brand}. We never ask for your password by email.</td></tr>'
        '</table></td></tr></table>'
    )
    await send_email(to=to, subject=f"{code} is your {brand} sign-in code", html=html)
