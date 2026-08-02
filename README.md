# نمی‌دونم

دفترخانه شخصی کتاب — Django API + React SPA

## قابلیت‌ها

- قفسه کتاب با وضعیت و پیشرفت
- یادداشت متن / ویس / تصویر
- چالش مطالعه
- واژه‌نامه با فلش‌کارت
- رابط RTL فارسی

## معماری

- **Backend:** Django + DRF (`/api/v1/`) با Session + CSRF
- **Frontend:** React + Vite در پوشه `frontend/`
- مدل‌ها و `services/` بدون تغییر منطق دامنه پشت API مانده‌اند

## اجرا (توسعه)

### ۱) بک‌اند

```bat
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### ۲) فرانت (HMR)

```bat
cd frontend
npm install
npm run dev
```

سپس Vite روی [http://127.0.0.1:5173](http://127.0.0.1:5173) با proxy به API جنگو.

### سرو از خود جنگو (بدون Vite)

```bat
cd frontend
npm run build
cd ..
python manage.py runserver 127.0.0.1:8000
```

بعد به [http://127.0.0.1:8000](http://127.0.0.1:8000) برو.

## ساختار

```
apps/                 # accounts, books, challenges, vocabulary
  */api.py            # DRF endpoints
  models/ services/   # منطق دامنه
frontend/             # React SPA (feature-based)
config/               # settings + api_urls + spa
```

## API

پایه: `/api/v1/`

- `auth/csrf|login|signup|logout|me`
- `shelf/` + entries + progress
- `books/suggest/`
- `challenges/`
- `vocabulary/`
