from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from pypdf import PdfWriter
from rest_framework.test import APIClient

from apps.books.models import ResourceKind, UserBook
from apps.books.services.echo import (
    echo_night_key,
    is_echo_window_open,
    publish_entry_with_consent,
)
from apps.books.models import Book, BookStatus, Entry, EntryKind, EntryMediaType
from datetime import timedelta
from unittest.mock import patch
from django.utils import timezone


User = get_user_model()


def make_pdf_bytes(pages: int = 3) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


class DigitalShelfApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='dig@example.com',
            password='x',
            username='dig',
        )
        self.client.force_authenticate(user=self.user)

    def test_create_booklet_from_pdf(self):
        pdf = SimpleUploadedFile(
            'notes.pdf',
            make_pdf_bytes(4),
            content_type='application/pdf',
        )
        res = self.client.post(
            '/api/v1/shelf/',
            {
                'resource_kind': 'booklet',
                'title': 'جزوه مدار',
                'course': 'مدار ۱',
                'pdf': pdf,
                'status': 'reading',
            },
            format='multipart',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['resource_kind'], ResourceKind.BOOKLET)
        self.assertTrue(res.data['is_digital'])
        self.assertEqual(res.data['total_pages'], 4)
        self.assertEqual(res.data['course'], 'مدار ۱')
        self.assertTrue(res.data['document']['pdf_url'])
        self.assertFalse(res.data['await_setup'])
        shelf = UserBook.objects.get(pk=res.data['id'])
        self.assertTrue(shelf.document.has_file)


# Keep previous echo/publish tests from earlier session
class EchoWindowTests(TestCase):
    def test_window_open_at_night(self):
        local = timezone.localtime()
        night = local.replace(hour=22, minute=0, second=0, microsecond=0)
        morning = local.replace(hour=3, minute=0, second=0, microsecond=0)
        day = local.replace(hour=12, minute=0, second=0, microsecond=0)
        self.assertTrue(is_echo_window_open(night))
        self.assertTrue(is_echo_window_open(morning))
        self.assertFalse(is_echo_window_open(day))

    def test_night_key_spans_midnight(self):
        local = timezone.localtime()
        before_midnight = local.replace(hour=23, minute=0, second=0, microsecond=0)
        after_midnight = (before_midnight + timedelta(hours=3)).replace(microsecond=0)
        self.assertEqual(echo_night_key(before_midnight), before_midnight.date())
        self.assertEqual(echo_night_key(after_midnight), before_midnight.date())


class PublishConsentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='a@example.com',
            password='x',
            username='reader-a',
        )
        book = Book.objects.create(title='T', author='A', total_pages=100)
        self.shelf = UserBook.objects.create(user=self.user, book=book, status=BookStatus.READING)
        self.entry = Entry.objects.create(
            user_book=self.shelf,
            kind=EntryKind.FEELING,
            media_type=EntryMediaType.TEXT,
            page_number=10,
            text_content='حس خوبی بود',
            is_public=False,
        )

    def test_publish_requires_confirm(self):
        with self.assertRaises(ValueError):
            publish_entry_with_consent(self.entry, confirm=False)

    def test_publish_feeling(self):
        published = publish_entry_with_consent(self.entry, confirm=True)
        self.assertTrue(published.is_public)


@override_settings(ROOT_URLCONF='config.urls')
class EchoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='x',
            username='owner',
        )
        self.reader = User.objects.create_user(
            email='reader@example.com',
            password='x',
            username='reader',
        )
        book = Book.objects.create(title='Echo Book', author='Someone', total_pages=200)
        shelf = UserBook.objects.create(user=self.owner, book=book, status=BookStatus.READING)
        Entry.objects.create(
            user_book=shelf,
            kind=EntryKind.VIEWPOINT,
            media_type=EntryMediaType.TEXT,
            page_number=5,
            text_content='یک دیدگاه عمومی',
            is_public=True,
        )
        self.client.force_authenticate(user=self.reader)

    def test_publish_endpoint_needs_confirm(self):
        book = Book.objects.create(title='Mine', author='Me', total_pages=50)
        shelf = UserBook.objects.create(user=self.reader, book=book)
        entry = Entry.objects.create(
            user_book=shelf,
            kind=EntryKind.BOOK_TEXT,
            media_type=EntryMediaType.TEXT,
            page_number=2,
            text_content='نقل قول',
        )
        res = self.client.post(
            f'/api/v1/shelf/{shelf.pk}/entries/{entry.pk}/publish/',
            {'confirm': False},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

        res = self.client.post(
            f'/api/v1/shelf/{shelf.pk}/entries/{entry.pk}/publish/',
            {'confirm': True},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        entry.refresh_from_db()
        self.assertTrue(entry.is_public)

    @patch('apps.books.services.echo.is_echo_window_open', return_value=True)
    def test_echo_draw_hides_book_until_reveal(self, _mock):
        res = self.client.post('/api/v1/books/echo/')
        self.assertEqual(res.status_code, 200)
        claim = res.data['claim']
        self.assertIsNotNone(claim)
        self.assertIsNone(claim['content']['book'])
        self.assertIn('یک دیدگاه', claim['content']['text'])

        token = claim['token']
        revealed = self.client.post(f'/api/v1/books/echo/{token}/reveal/')
        self.assertEqual(revealed.status_code, 200)
        self.assertEqual(revealed.data['claim']['content']['book']['title'], 'Echo Book')

        saved = self.client.post(f'/api/v1/books/echo/{token}/save/')
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(
            UserBook.objects.filter(user=self.reader, book__title='Echo Book').exists()
        )

    def test_echo_excludes_final_viewpoint(self):
        from apps.books.services.echo import public_echo_queryset

        book = Book.objects.create(title='Final Only', author='X', total_pages=80)
        shelf = UserBook.objects.create(user=self.owner, book=book, status=BookStatus.FINISHED)
        Entry.objects.create(
            user_book=shelf,
            kind=EntryKind.FINAL_VIEWPOINT,
            media_type=EntryMediaType.TEXT,
            page_number=80,
            text_content='دیدگاه پایانی نباید در پژواک باشد',
            is_public=True,
        )
        ids = list(public_echo_queryset(exclude_user_id=self.reader.pk).values_list('kind', flat=True))
        self.assertNotIn(EntryKind.FINAL_VIEWPOINT, ids)
        self.assertIn(EntryKind.VIEWPOINT, ids)

    @patch('apps.books.services.echo.is_echo_window_open', return_value=False)
    def test_echo_blocked_outside_window(self, _mock):
        res = self.client.post('/api/v1/books/echo/')
        self.assertEqual(res.status_code, 403)
