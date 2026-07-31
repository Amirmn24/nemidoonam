import re
import unicodedata

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def fingerprint(value: str) -> str:
    if not value:
        return ''
    char_map = str.maketrans({
        'ي': 'ی',
        'ى': 'ی',
        'ك': 'ک',
        'ة': 'ه',
        'ۀ': 'ه',
        'ھ': 'ه',
        'ە': 'ه',
        'ؤ': 'و',
        'إ': 'ا',
        'أ': 'ا',
        'ٱ': 'ا',
    })
    invisible = dict.fromkeys(map(ord, '\u200c\u200d\u200e\u200f\ufeff\u00a0'), None)
    text = unicodedata.normalize('NFKC', str(value)).strip()
    text = text.translate(char_map).translate(invisible).replace('\u0640', '')
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = text.casefold()
    text = re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE)
    text = re.sub(r'\s+', ' ', text).strip().replace(' ', '')
    return text


def forwards(apps, schema_editor):
    Book = apps.get_model('books', 'Book')
    UserBook = apps.get_model('books', 'UserBook')
    Entry = apps.get_model('books', 'Entry')
    ChallengeBook = apps.get_model('challenges', 'ChallengeBook')

    # 1) Ensure normalized fields, create one UserBook per old Book row
    old_book_to_userbook = {}
    for book in Book.objects.all().iterator():
        book.title_normalized = fingerprint(book.title)
        book.author_normalized = fingerprint(book.author)
        book.save(update_fields=['title_normalized', 'author_normalized'])
        ub = UserBook.objects.create(
            user_id=book.owner_id,
            book_id=book.id,
            current_page=book.current_page,
            status=book.status,
            notes=book.notes or '',
            created_at=book.created_at,
            updated_at=book.updated_at,
        )
        old_book_to_userbook[book.id] = ub.id

    # 2) Point entries at UserBook
    for entry in Entry.objects.all().iterator():
        ub_id = old_book_to_userbook.get(entry.book_id)
        if ub_id:
            entry.user_book_id = ub_id
            entry.save(update_fields=['user_book_id'])

    # 3) Merge duplicate catalog books (same normalized title+author)
    groups = {}
    for book in Book.objects.all().order_by('id'):
        key = (book.title_normalized, book.author_normalized)
        groups.setdefault(key, []).append(book)

    for _key, books in groups.items():
        if len(books) == 1:
            continue
        canonical = books[0]
        for dup in books[1:]:
            # Move shelves to canonical (avoid unique user+book clashes)
            for ub in UserBook.objects.filter(book_id=dup.id):
                exists = UserBook.objects.filter(
                    user_id=ub.user_id, book_id=canonical.id
                ).first()
                if exists:
                    Entry.objects.filter(user_book_id=ub.id).update(user_book_id=exists.id)
                    ub.delete()
                else:
                    ub.book_id = canonical.id
                    ub.save(update_fields=['book_id'])
            ChallengeBook.objects.filter(book_id=dup.id).update(book_id=canonical.id)
            # Prefer cover / larger page count on canonical
            changed = False
            if dup.cover and not canonical.cover:
                canonical.cover = dup.cover
                changed = True
            if dup.total_pages and dup.total_pages > canonical.total_pages:
                canonical.total_pages = dup.total_pages
                changed = True
            if changed:
                canonical.save()
            dup.delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0002_book_normalized_unique'),
        ('challenges', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Create UserBook while Book still has owner/status fields
        migrations.CreateModel(
            name='UserBook',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_page', models.PositiveIntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)], verbose_name='صفحه فعلی')),
                ('status', models.CharField(choices=[('want_to_read', 'می‌خواهم بخوانم'), ('reading', 'در حال خواندن'), ('paused', 'متوقف شده'), ('finished', 'تمام شده'), ('abandoned', 'رها شده')], db_index=True, default='want_to_read', max_length=20, verbose_name='وضعیت')),
                ('notes', models.TextField(blank=True, verbose_name='یادداشت کلی')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='آخرین به‌روزرسانی')),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shelves', to='books.book', verbose_name='کتاب')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shelf_books', to=settings.AUTH_USER_MODEL, verbose_name='کاربر')),
            ],
            options={
                'verbose_name': 'کتاب قفسه',
                'verbose_name_plural': 'کتاب‌های قفسه',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddField(
            model_name='entry',
            name='user_book',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='entries',
                to='books.userbook',
                verbose_name='کتاب قفسه',
            ),
        ),
        migrations.RunPython(forwards, noop_reverse),
        migrations.AlterField(
            model_name='entry',
            name='user_book',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='entries',
                to='books.userbook',
                verbose_name='کتاب قفسه',
            ),
        ),
        migrations.RemoveField(model_name='entry', name='book'),
        migrations.RemoveConstraint(
            model_name='book',
            name='books_unique_owner_title_author_norm',
        ),
        migrations.RemoveIndex(
            model_name='book',
            name='books_book_owner_i_3f6702_idx',
        ),
        migrations.RemoveIndex(
            model_name='book',
            name='books_book_owner_i_7c1db3_idx',
        ),
        migrations.RemoveField(model_name='book', name='owner'),
        migrations.RemoveField(model_name='book', name='current_page'),
        migrations.RemoveField(model_name='book', name='status'),
        migrations.RemoveField(model_name='book', name='notes'),
        migrations.AlterModelOptions(
            name='book',
            options={
                'ordering': ['title', 'author'],
                'verbose_name': 'کتاب',
                'verbose_name_plural': 'کتاب‌ها',
            },
        ),
        migrations.AddIndex(
            model_name='book',
            index=models.Index(fields=['title_normalized', 'author_normalized'], name='books_book_title_n_8a1c01_idx'),
        ),
        migrations.AddConstraint(
            model_name='book',
            constraint=models.UniqueConstraint(
                fields=('title_normalized', 'author_normalized'),
                name='books_unique_title_author_norm',
            ),
        ),
        migrations.AddIndex(
            model_name='userbook',
            index=models.Index(fields=['user', 'status'], name='books_userb_user_id_0f5a2c_idx'),
        ),
        migrations.AddConstraint(
            model_name='userbook',
            constraint=models.UniqueConstraint(
                fields=('user', 'book'),
                name='books_unique_user_book',
            ),
        ),
        migrations.AddIndex(
            model_name='entry',
            index=models.Index(fields=['user_book', 'page_number'], name='books_entry_user_bo_9c1d01_idx'),
        ),
        migrations.AddIndex(
            model_name='entry',
            index=models.Index(fields=['user_book', 'kind'], name='books_entry_user_bo_1a2b03_idx'),
        ),
    ]
