from io import BytesIO
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APIClient

from apps.books.models import (
    Book,
    BookStatus,
    DocumentHighlight,
    Entry,
    EntryKind,
    EntryMediaType,
    ResourceKind,
    UserBook,
    UserBookDocument,
)
from apps.books.services.echo import (
    echo_night_key,
    is_echo_window_open,
    publish_entry_with_consent,
)
from apps.books.services.highlights import normalize_rects


User = get_user_model()


def make_pdf_bytes(pages: int = 3) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


@override_settings(DOCUMENTS_USE_S3=False, ROOT_URLCONF='config.urls')
class DigitalShelfApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='dig@example.com',
            password='x',
            username='dig',
        )
        self.client.force_authenticate(user=self.user)

    def test_create_booklet_via_upload_session(self):
        pdf_bytes = make_pdf_bytes(4)
        intent = self.client.post(
            '/api/v1/documents/upload-sessions/',
            {
                'filename': 'notes.pdf',
                'content_type': 'application/pdf',
                'size_bytes': len(pdf_bytes),
            },
            format='json',
        )
        self.assertEqual(intent.status_code, 201, intent.data)
        token = intent.data['token']
        self.assertEqual(intent.data['backend'], 'local')

        upload = self.client.post(
            f'/api/v1/documents/upload-sessions/{token}/binary/',
            {'file': SimpleUploadedFile('notes.pdf', pdf_bytes, content_type='application/pdf')},
            format='multipart',
        )
        self.assertEqual(upload.status_code, 200, upload.data)

        res = self.client.post(
            '/api/v1/shelf/',
            {
                'resource_kind': 'booklet',
                'title': 'جزوه مدار',
                'course': 'مدار ۱',
                'upload_token': token,
                'status': 'reading',
            },
            format='multipart',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['resource_kind'], ResourceKind.BOOKLET)
        self.assertEqual(res.data['total_pages'], 4)
        self.assertEqual(res.data['course'], 'مدار ۱')
        self.assertIn('/document/content/', res.data['document']['content_url'])
        self.assertNotIn('/media/', res.data['document']['content_url'])

        shelf_id = res.data['id']
        # مالک می‌تواند محتوا را ببیند
        content = self.client.get(f'/api/v1/shelf/{shelf_id}/document/content/')
        self.assertEqual(content.status_code, 200)
        self.assertEqual(content['Content-Type'], 'application/pdf')

        # کاربر دیگر نه
        other = User.objects.create_user(email='o@example.com', password='x', username='other')
        self.client.force_authenticate(user=other)
        denied = self.client.get(f'/api/v1/shelf/{shelf_id}/document/content/')
        self.assertEqual(denied.status_code, 404)


class HighlightRectTests(TestCase):
    def test_normalize_rects_clamps_and_drops_tiny(self):
        rects = normalize_rects(
            [
                {'x': -0.01, 'y': 0.2, 'w': 0.3, 'h': 0.05},
                {'x': 0.1, 'y': 0.2, 'w': 0.001, 'h': 0.05},
            ]
        )
        self.assertEqual(len(rects), 1)
        self.assertEqual(rects[0]['x'], 0.0)

    def test_normalize_rects_rejects_empty(self):
        with self.assertRaises(ValidationError):
            normalize_rects([])


@override_settings(DOCUMENTS_USE_S3=False, ROOT_URLCONF='config.urls')
class DocumentHighlightApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='hl@example.com',
            password='x',
            username='hl',
        )
        self.client.force_authenticate(user=self.user)

    def _create_booklet(self):
        pdf_bytes = make_pdf_bytes(4)
        intent = self.client.post(
            '/api/v1/documents/upload-sessions/',
            {
                'filename': 'notes.pdf',
                'content_type': 'application/pdf',
                'size_bytes': len(pdf_bytes),
            },
            format='json',
        )
        self.assertEqual(intent.status_code, 201, intent.data)
        token = intent.data['token']
        upload = self.client.post(
            f'/api/v1/documents/upload-sessions/{token}/binary/',
            {'file': SimpleUploadedFile('notes.pdf', pdf_bytes, content_type='application/pdf')},
            format='multipart',
        )
        self.assertEqual(upload.status_code, 200, upload.data)
        res = self.client.post(
            '/api/v1/shelf/',
            {
                'resource_kind': 'booklet',
                'title': 'جزوه هایلایت',
                'course': 'مدار ۱',
                'upload_token': token,
                'status': 'reading',
            },
            format='multipart',
        )
        self.assertEqual(res.status_code, 201, res.data)
        return res.data['id']

    def test_highlight_crud_does_not_rewrite_pdf(self):
        shelf_id = self._create_booklet()
        doc = UserBookDocument.objects.get(user_book_id=shelf_id)
        key_before = doc.storage_key
        size_before = doc.size_bytes

        created = self.client.post(
            f'/api/v1/shelf/{shelf_id}/document/highlights/',
            {
                'page_number': 1,
                'color': 'lime',
                'quote': 'یک جمله',
                'rects': [{'x': 0.1, 'y': 0.2, 'w': 0.3, 'h': 0.04}],
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        hid = created.data['id']
        self.assertEqual(created.data['color'], 'lime')
        self.assertEqual(created.data['page_number'], 1)

        doc.refresh_from_db()
        self.assertEqual(doc.storage_key, key_before)
        self.assertEqual(doc.size_bytes, size_before)
        self.assertEqual(DocumentHighlight.objects.filter(document=doc).count(), 1)

        listed = self.client.get(f'/api/v1/shelf/{shelf_id}/document/highlights/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data['results']), 1)

        patched = self.client.patch(
            f'/api/v1/shelf/{shelf_id}/document/highlights/{hid}/',
            {'color': 'rose'},
            format='json',
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.data['color'], 'rose')

        deleted = self.client.delete(f'/api/v1/shelf/{shelf_id}/document/highlights/{hid}/')
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(DocumentHighlight.objects.filter(document=doc).count(), 0)

        other = User.objects.create_user(email='hl2@example.com', password='x', username='hl2')
        self.client.force_authenticate(user=other)
        denied = self.client.get(f'/api/v1/shelf/{shelf_id}/document/highlights/')
        self.assertEqual(denied.status_code, 404)

    def test_physical_book_cannot_highlight(self):
        book = Book.objects.create(
            title='Physical',
            author='A',
            total_pages=10,
            resource_kind=ResourceKind.PHYSICAL,
        )
        shelf = UserBook.objects.create(user=self.user, book=book, status=BookStatus.READING)
        res = self.client.post(
            f'/api/v1/shelf/{shelf.pk}/document/highlights/',
            {
                'page_number': 1,
                'rects': [{'x': 0.1, 'y': 0.2, 'w': 0.3, 'h': 0.04}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, 404)


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

    @patch('apps.books.services.echo.is_echo_window_open', return_value=True)
    def test_echo_draw_hides_book_until_reveal(self, _mock):
        res = self.client.post('/api/v1/books/echo/')
        self.assertEqual(res.status_code, 200)
        claim = res.data['claim']
        self.assertIsNone(claim['content']['book'])
        token = claim['token']
        revealed = self.client.post(f'/api/v1/books/echo/{token}/reveal/')
        self.assertEqual(revealed.status_code, 200)
        saved = self.client.post(f'/api/v1/books/echo/{token}/save/')
        self.assertEqual(saved.status_code, 200)

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

    @patch('apps.books.services.echo.is_echo_window_open', return_value=False)
    def test_echo_blocked_outside_window(self, _mock):
        res = self.client.post('/api/v1/books/echo/')
        self.assertEqual(res.status_code, 403)
