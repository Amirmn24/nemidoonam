from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction

from emails.models import ChallengeEmailKind, ChallengeEmailLog

logger = logging.getLogger(__name__)


def already_sent(challenge_id: int, kind: str) -> bool:
    return ChallengeEmailLog.objects.filter(
        challenge_id=challenge_id,
        kind=kind,
    ).exists()


def mark_sent(challenge, kind: str, to_email: str) -> bool:
    """ثبت ارسال؛ اگر قبلاً ثبت شده باشد False برمی‌گرداند."""
    try:
        with transaction.atomic():
            ChallengeEmailLog.objects.create(
                challenge=challenge,
                kind=kind,
                to_email=to_email,
            )
        return True
    except IntegrityError:
        return False


def deliver_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> bool:
    if not to_email:
        logger.warning('آدرس ایمیل گیرنده خالی است؛ ارسال رد شد.')
        return False

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or settings.EMAIL_HOST_USER
    reply_to = getattr(settings, 'EMAIL_REPLY_TO', None) or settings.EMAIL_HOST_USER

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=from_email,
            to=[to_email],
            reply_to=[reply_to] if reply_to else None,
        )
        if html_body:
            message.attach_alternative(html_body, 'text/html')
        # هدرهای ساده‌تر برای ایمیل تراکنشی
        message.extra_headers['X-Auto-Response-Suppress'] = 'OOF, AutoReply'
        message.send(fail_silently=False)
        return True
    except Exception:
        logger.exception('ارسال ایمیل به %s ناموفق بود.', to_email)
        return False


def send_challenge_mail(
    challenge,
    kind: str,
    *,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> bool:
    """ارسال یکبارهٔ ایمیل چالش؛ تکراری نمی‌فرستد."""
    owner = challenge.owner
    to_email = (owner.email or '').strip()
    if already_sent(challenge.pk, kind):
        return False
    if not mark_sent(challenge, kind, to_email):
        return False
    ok = deliver_email(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )
    if not ok:
        ChallengeEmailLog.objects.filter(challenge=challenge, kind=kind).delete()
    return ok


__all__ = [
    'ChallengeEmailKind',
    'already_sent',
    'deliver_email',
    'mark_sent',
    'send_challenge_mail',
]
