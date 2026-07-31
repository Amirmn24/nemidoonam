/**
 * Vocabulary flashcards: flip, usage modal, audio playback.
 */
(function () {
  const root = document.querySelector('[data-flashcards]');
  const modal = document.querySelector('[data-usage-modal]');
  if (!root) return;

  let activeAudio = null;

  function stopAudio() {
    if (!activeAudio) return;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
    root.querySelectorAll('[data-play].is-playing').forEach((btn) => {
      btn.classList.remove('is-playing');
    });
  }

  function setFlipped(card, flipped) {
    card.classList.toggle('is-flipped', flipped);
    const back = card.querySelector('.flashcard-back');
    if (back) back.setAttribute('aria-hidden', flipped ? 'false' : 'true');
  }

  root.addEventListener('click', (event) => {
    const flipBtn = event.target.closest('[data-flip]');
    if (flipBtn) {
      const card = flipBtn.closest('[data-flashcard]');
      if (card) setFlipped(card, !card.classList.contains('is-flipped'));
      return;
    }

    const usageBtn = event.target.closest('[data-usage]');
    if (usageBtn && !usageBtn.disabled) {
      const card = usageBtn.closest('[data-flashcard]');
      const content = card && card.querySelector('[data-usage-content]');
      openUsageModal(
        usageBtn.getAttribute('data-usage-term') || '',
        content ? content.textContent.trim() : ''
      );
      return;
    }

    const playBtn = event.target.closest('[data-play]');
    if (playBtn && !playBtn.disabled) {
      const src = playBtn.getAttribute('data-audio-src');
      if (!src) return;

      if (playBtn.classList.contains('is-playing') && activeAudio) {
        stopAudio();
        return;
      }

      stopAudio();
      const audio = new Audio(src);
      activeAudio = audio;
      playBtn.classList.add('is-playing');
      audio.addEventListener('ended', () => {
        playBtn.classList.remove('is-playing');
        if (activeAudio === audio) activeAudio = null;
      });
      audio.addEventListener('error', () => {
        playBtn.classList.remove('is-playing');
        if (activeAudio === audio) activeAudio = null;
      });
      audio.play().catch(() => {
        playBtn.classList.remove('is-playing');
        if (activeAudio === audio) activeAudio = null;
      });
    }
  });

  function openUsageModal(term, text) {
    if (!modal) return;
    const title = modal.querySelector('[data-usage-title]');
    const body = modal.querySelector('[data-usage-body]');
    if (title) title.textContent = term;
    if (body) body.textContent = text;
    modal.hidden = false;
    document.body.classList.add('vocab-modal-open');
    const closeBtn = modal.querySelector('.vocab-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeUsageModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('vocab-modal-open');
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-usage-close]')) closeUsageModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeUsageModal();
      stopAudio();
    }
  });
})();
