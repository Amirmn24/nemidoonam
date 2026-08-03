"""متن‌های صمیمی برای ایمیل‌های یادآوری چالش — بدون لحن اسپم‌مانند."""

from __future__ import annotations

import html


def _books_phrase(book_titles: list[str]) -> str:
    if not book_titles:
        return 'کتاب‌هات'
    if len(book_titles) == 1:
        return f'کتاب «{book_titles[0]}»'
    if len(book_titles) == 2:
        return f'کتاب‌های «{book_titles[0]}» و «{book_titles[1]}»'
    head = '»، «'.join(book_titles[:-1])
    return f'کتاب‌های «{head}» و «{book_titles[-1]}»'


def _greeting(name: str) -> str:
    return name.strip() or 'رفیق'


def _escape(value: str) -> str:
    return html.escape(value, quote=True)


def _to_html(plain: str) -> str:
    paragraphs = [
        f'<p style="margin:0 0 12px;line-height:1.7;">{_escape(p).replace(chr(10), "<br>")}</p>'
        for p in plain.split('\n\n')
        if p.strip()
    ]
    body = ''.join(paragraphs)
    return (
        '<!DOCTYPE html><html lang="fa" dir="rtl"><head>'
        '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'</head><body style="margin:0;padding:24px;background:#f7f7f5;'
        'font-family:Tahoma,Arial,sans-serif;color:#222;">'
        '<div style="max-width:560px;margin:0 auto;background:#fff;'
        'padding:28px 24px;border-radius:12px;border:1px solid #ecece8;">'
        f'{body}'
        '<p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.6;">'
        'این یک پیام یادآوری از اپلیکیشن نمی‌دونم است.'
        '</p></div></body></html>'
    )


def challenge_started(
    *,
    name: str,
    challenge_title: str,
    period_label: str,
    book_titles: list[str],
    ends_on: str,
) -> tuple[str, str, str]:
    who = _greeting(name)
    books = _books_phrase(book_titles)
    subject = f'شروع چالش «{challenge_title}»'
    body = (
        f'سلام {who}،\n\n'
        f'چالش «{challenge_title}» برات ثبت شد.\n'
        f'{period_label} وقت داری تا {books} را بخوانی.\n'
        f'مهلت پایان: {ends_on}\n\n'
        f'آرام و پیوسته پیش برو؛ ما هم هوات را داریم.\n\n'
        f'با مهر،\n'
        f'نمی‌دونم'
    )
    return subject, body, _to_html(body)


def halfway_time(
    *,
    name: str,
    challenge_title: str,
    days_left: int,
    completion_percent: int,
    book_titles: list[str],
) -> tuple[str, str, str]:
    who = _greeting(name)
    books = _books_phrase(book_titles)
    subject = f'یادآوری چالش «{challenge_title}»'
    body = (
        f'سلام {who}،\n\n'
        f'نصف زمان چالش «{challenge_title}» گذشته است.\n'
        f'تا اینجا حدود {completion_percent}٪ پیش رفته‌ای و {days_left} روز مانده.\n'
        f'{books} هنوز منتظر توست.\n\n'
        f'اگر چند صفحه هم امروز بخوانی، دوباره جریان می‌افتد.\n\n'
        f'مواظبتم،\n'
        f'نمی‌دونم'
    )
    return subject, body, _to_html(body)


def one_day_before(
    *,
    name: str,
    challenge_title: str,
    completion_percent: int,
    book_titles: list[str],
) -> tuple[str, str, str]:
    who = _greeting(name)
    books = _books_phrase(book_titles)
    subject = f'فردا آخرین روز «{challenge_title}» است'
    body = (
        f'سلام {who}،\n\n'
        f'فردا مهلت چالش «{challenge_title}» تمام می‌شود.\n'
        f'پیشرفت فعلی‌ات حدود {completion_percent}٪ است.\n'
        f'اگر فرصت داشتی، سری به {books} بزن.\n\n'
        f'حتی یک نشست کوتاه کتاب‌خوانی هم ارزشمند است.\n\n'
        f'موفق باشی،\n'
        f'نمی‌دونم'
    )
    return subject, body, _to_html(body)


def halfway_progress(
    *,
    name: str,
    challenge_title: str,
    completion_percent: int,
    days_left: int,
    book_titles: list[str],
) -> tuple[str, str, str]:
    who = _greeting(name)
    books = _books_phrase(book_titles)
    subject = f'نصف راه «{challenge_title}» را آمده‌ای'
    body = (
        f'سلام {who}،\n\n'
        f'خبر خوب: از چالش «{challenge_title}» حدود {completion_percent}٪ را '
        f'پشت سر گذاشته‌ای.\n'
        f'{books} دیگر نیمه‌راه است و هنوز {days_left} روز فرصت داری.\n\n'
        f'همین‌طور ادامه بده؛ عالی پیش می‌روی.\n\n'
        f'با مهر،\n'
        f'نمی‌دونم'
    )
    return subject, body, _to_html(body)


def challenge_completed(
    *,
    name: str,
    challenge_title: str,
    days_left: int,
    book_titles: list[str],
) -> tuple[str, str, str]:
    who = _greeting(name)
    books = _books_phrase(book_titles)
    early = (
        f'و هنوز {days_left} روز مانده بود؛ یعنی زودتر از موعد تمامش کردی.'
        if days_left > 0
        else 'درست سر وقت تمامش کردی.'
    )
    subject = f'چالش «{challenge_title}» تمام شد'
    body = (
        f'{who} عزیز، تبریک!\n\n'
        f'چالش «{challenge_title}» را به پایان رساندی — {early}\n'
        f'{books} حالا بخشی از مسیر مطالعه‌ات است.\n\n'
        f'هر وقت خواستی، یک چالش تازه بساز. ما اینجاییم.\n\n'
        f'آفرین،\n'
        f'نمی‌دونم'
    )
    return subject, body, _to_html(body)
