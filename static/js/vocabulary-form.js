/**
 * Vocabulary form: in-browser pronunciation recorder.
 */
(function () {
  const form = document.getElementById('vocab-form');
  if (!form) return;

  const MIC_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor"/>' +
    '<path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8.94V22a1 1 0 1 0 2 0v-2.06A9 9 0 0 0 21 11a1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" fill="currentColor"/></svg>';
  const STOP_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

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
  const clearCheckbox = form.querySelector('input[name="clear_audio"]');

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
    const file = new File([blob], `pronunciation-${Date.now()}.${ext}`, { type: mime });
    const dt = new DataTransfer();
    dt.items.add(file);
    audioInput.files = dt.files;
    if (clearCheckbox) clearCheckbox.checked = false;
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
        ? 'تلفظ قبلی نگه داشته می‌شود مگر دوباره ضبط کنی'
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

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('مرورگر از ضبط صدا پشتیبانی نمی‌کند.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
        }
        clearInterval(timerId);
        recorder.classList.remove('is-recording');
        if (toggleBtn) {
          toggleBtn.innerHTML = MIC_ICON;
          toggleBtn.setAttribute('aria-label', 'شروع ضبط');
          toggleBtn.classList.remove('is-recording');
        }
        const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (!blob.size) {
          setError('ضبط خالی بود. دوباره تلاش کن.');
          return;
        }
        attachFile(blob);
        showPlayback(blob);
      };
      mediaRecorder.start();
      startedAt = Date.now();
      timerId = setInterval(tick, 250);
      recorder.classList.add('is-recording');
      if (statusEl) {
        statusEl.textContent = 'در حال ضبط…';
        statusEl.classList.add('is-recording');
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = STOP_ICON;
        toggleBtn.setAttribute('aria-label', 'توقف ضبط');
        toggleBtn.classList.add('is-recording');
      }
    } catch (err) {
      setError('دسترسی به میکروفون ممکن نشد.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
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
      if (existing) {
        existing.hidden = false;
        hasExisting = recorder.dataset.hasExisting === '1';
      }
      startRecording();
    });
  }

  if (hasExisting && statusEl) {
    statusEl.textContent = 'تلفظ قبلی نگه داشته می‌شود مگر دوباره ضبط کنی';
  }
})();
