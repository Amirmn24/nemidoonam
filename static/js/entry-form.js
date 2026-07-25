/**
 * Entry form: kind/media choice cards, image preview, in-browser voice recorder.
 */
(function () {
  const form = document.getElementById('entry-form');
  if (!form) return;

  const kindSelect = document.getElementById('id_kind');
  const mediaSelect = document.getElementById('id_media_type');
  const textLabel = document.getElementById('text-label');
  const mediaFields = form.querySelectorAll('.media-field');
  const kindCards = form.querySelectorAll('[data-target="kind"]');
  const mediaCards = form.querySelectorAll('[data-target="media"]');

  const MIC_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor"/>' +
    '<path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8.94V22a1 1 0 1 0 2 0v-2.06A9 9 0 0 0 21 11a1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" fill="currentColor"/></svg>';
  const STOP_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  function setActiveCards(cards, attr, value) {
    cards.forEach((card) => {
      const on = card.getAttribute(attr) === value;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncMediaFields(value) {
    mediaFields.forEach((field) => {
      const media = field.getAttribute('data-media');
      if (media === value) {
        field.hidden = false;
      } else if (media === 'text' && value !== 'text') {
        field.hidden = false;
        if (textLabel) textLabel.textContent = 'توضیح (اختیاری)';
      } else {
        field.hidden = true;
      }
      if (media === 'text' && value === 'text' && textLabel) {
        textLabel.textContent = 'متن';
      }
    });
  }

  function selectKind(value) {
    if (!kindSelect) return;
    kindSelect.value = value;
    setActiveCards(kindCards, 'data-kind', value);
  }

  function selectMedia(value) {
    if (!mediaSelect) return;
    mediaSelect.value = value;
    setActiveCards(mediaCards, 'data-media', value);
    syncMediaFields(value);
  }

  kindCards.forEach((card) => {
    card.addEventListener('click', () => selectKind(card.getAttribute('data-kind')));
  });

  mediaCards.forEach((card) => {
    card.addEventListener('click', () => selectMedia(card.getAttribute('data-media')));
  });

  const initialKind = form.dataset.initialKind || (kindSelect && kindSelect.value) || 'viewpoint';
  const initialMedia = form.dataset.initialMedia || (mediaSelect && mediaSelect.value) || 'text';
  selectKind(initialKind);
  selectMedia(initialMedia);

  // Image drop + preview
  const imageInput = document.getElementById('id_image');
  const imageDrop = document.getElementById('image-drop');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImg = document.getElementById('image-preview-img');

  function showImagePreview(file) {
    if (!file || !imagePreview || !imagePreviewImg) return;
    const url = URL.createObjectURL(file);
    imagePreviewImg.src = url;
    imagePreview.classList.add('is-visible');
  }

  if (imageInput && imageDrop) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files && imageInput.files[0];
      if (file) showImagePreview(file);
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      imageDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        imageDrop.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      imageDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        imageDrop.classList.remove('is-dragover');
      });
    });

    imageDrop.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      showImagePreview(file);
    });
  }

  initVoiceRecorder();

  function initVoiceRecorder() {
    const recorder = document.getElementById('voice-recorder');
    const audioInput = document.getElementById('id_audio');
    if (!recorder || !audioInput) return;

    const statusEl = document.getElementById('voice-status');
    const timerEl = document.getElementById('voice-timer');
    const toggleBtn = document.getElementById('voice-toggle');
    const rerecordBtn = document.getElementById('voice-rerecord');
    const playback = document.getElementById('voice-playback');
    const preview = document.getElementById('voice-preview');
    const errorEl = document.getElementById('voice-error');
    const existing = document.getElementById('voice-existing');

    let mediaRecorder = null;
    let stream = null;
    let chunks = [];
    let startedAt = 0;
    let timerId = null;
    let hasExisting = recorder.dataset.hasExisting === '1';

    if (toggleBtn) toggleBtn.innerHTML = MIC_ICON;

    function formatTime(ms) {
      const total = Math.floor(ms / 1000);
      const m = String(Math.floor(total / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    function setError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg || '';
      errorEl.classList.toggle('is-visible', Boolean(msg));
    }

    function pickMimeType() {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
      return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    }

    function attachFile(blob) {
      const mime = blob.type || 'audio/webm';
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);
      audioInput.files = dt.files;
    }

    function clearRecording() {
      audioInput.value = '';
      if (preview) {
        preview.removeAttribute('src');
        preview.load();
      }
      if (playback) playback.classList.remove('is-visible');
      if (rerecordBtn) rerecordBtn.hidden = true;
      if (timerEl) timerEl.textContent = '00:00';
      if (statusEl) {
        statusEl.textContent = hasExisting
          ? 'ویس قبلی نگه داشته می‌شود مگر دوباره ضبط کنی'
          : 'برای شروع، دکمه میکروفون را بزن';
        statusEl.classList.remove('is-recording');
      }
      recorder.classList.remove('is-recording');
      if (toggleBtn) {
        toggleBtn.innerHTML = MIC_ICON;
        toggleBtn.setAttribute('aria-label', 'شروع ضبط');
        toggleBtn.classList.remove('is-recording');
      }
    }

    function showPlayback(blob) {
      if (!preview || !playback) return;
      preview.src = URL.createObjectURL(blob);
      playback.classList.add('is-visible');
      if (rerecordBtn) rerecordBtn.hidden = false;
      if (statusEl) {
        statusEl.textContent = 'ضبط شد — می‌توانی گوش بدهی یا دوباره ضبط کنی';
        statusEl.classList.remove('is-recording');
      }
      if (existing) existing.hidden = true;
      hasExisting = false;
    }

    function tick() {
      if (timerEl) timerEl.textContent = formatTime(Date.now() - startedAt);
    }

    function stopStream() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    }

    async function startRecording() {
      setError('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.');
        return;
      }
      if (!window.MediaRecorder) {
        setError('MediaRecorder در این مرورگر در دسترس نیست.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setError('دسترسی به میکروفون داده نشد. اجازه میکروفون را در مرورگر فعال کن.');
        return;
      }

      chunks = [];
      const mimeType = pickMimeType();
      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (err) {
        setError('شروع ضبط ممکن نشد.');
        stopStream();
        return;
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stopStream();
        const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (!blob.size) {
          setError('چیزی ضبط نشد. دوباره تلاش کن.');
          clearRecording();
          return;
        }
        attachFile(blob);
        showPlayback(blob);
        if (toggleBtn) {
          toggleBtn.innerHTML = MIC_ICON;
          toggleBtn.classList.remove('is-recording');
          toggleBtn.setAttribute('aria-label', 'شروع ضبط');
        }
        recorder.classList.remove('is-recording');
      };

      mediaRecorder.start(200);
      startedAt = Date.now();
      tick();
      timerId = setInterval(tick, 250);

      recorder.classList.add('is-recording');
      if (toggleBtn) {
        toggleBtn.classList.add('is-recording');
        toggleBtn.innerHTML = STOP_ICON;
        toggleBtn.setAttribute('aria-label', 'توقف ضبط');
      }
      if (statusEl) {
        statusEl.textContent = 'در حال ضبط… دوباره بزن تا متوقف شود';
        statusEl.classList.add('is-recording');
      }
      if (playback) playback.classList.remove('is-visible');
      if (rerecordBtn) rerecordBtn.hidden = true;
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        stopStream();
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopRecording();
        } else {
          startRecording();
        }
      });
    }

    if (rerecordBtn) {
      rerecordBtn.addEventListener('click', () => {
        clearRecording();
        startRecording();
      });
    }

    form.addEventListener('submit', (e) => {
      if (mediaSelect && mediaSelect.value === 'voice') {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          e.preventDefault();
          setError('اول ضبط را متوقف کن، بعد ذخیره کن.');
          return;
        }
        const hasFile = audioInput.files && audioInput.files.length > 0;
        if (!hasFile && !hasExisting) {
          e.preventDefault();
          setError('لطفاً یک ویس ضبط کن.');
          selectMedia('voice');
        }
      }
    });

    if (hasExisting && statusEl) {
      statusEl.textContent = 'ویس قبلی نگه داشته می‌شود مگر دوباره ضبط کنی';
    }
  }
})();
