import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * پاپ‌آپ ثبت دیدگاه پایانی — همیشه final_viewpoint؛ متن یا ویس؛ بدون شماره صفحه.
 */
export default function FinalViewpointModal({
  open,
  busy,
  bookTitle,
  onSubmit,
  onClose,
}) {
  const { t } = useTranslation()
  const [media, setMedia] = useState('text')
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [timer, setTimer] = useState(0)
  const [localError, setLocalError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setMedia('text')
      setText('')
      setRecording(false)
      setAudioBlob(null)
      setAudioUrl(null)
      setTimer(0)
      setLocalError('')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy && !recording) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [open, busy, recording, onClose])

  const startRecording = async () => {
    setLocalError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => setTimer((n) => n + 1), 1000)
    } catch {
      setLocalError(t('api.micDenied'))
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const canSubmit =
    !busy &&
    !recording &&
    ((media === 'text' && text.trim()) || (media === 'voice' && audioBlob))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLocalError('')
    onSubmit({
      media_type: media,
      text_content: media === 'text' ? text.trim() : '',
      audioBlob: media === 'voice' ? audioBlob : null,
    })
  }

  if (!open) return null

  return (
    <div className="book-modal" role="dialog" aria-modal="true" aria-labelledby="final-viewpoint-title">
      <div className="book-modal-backdrop" onClick={busy || recording ? undefined : onClose} />
      <div className="book-modal-sheet final-viewpoint-sheet">
        <div className="book-modal-head">
          <div>
            <p className="eyebrow">{t('books.finalModal.eyebrow')}</p>
            <h2 id="final-viewpoint-title">{t('books.finalModal.title')}</h2>
          </div>
        </div>
        <p className="final-viewpoint-hint">
          {bookTitle
            ? t('books.finalModal.hintWithTitle', { title: bookTitle })
            : t('books.finalModal.hint')}
        </p>

        {localError ? <p className="form-errors">{localError}</p> : null}

        <form onSubmit={handleSubmit}>
          <div className="choice-grid final-media-choices" role="group" aria-label={t('books.finalModal.mediaAria')}>
            <button
              type="button"
              className={`choice-card${media === 'text' ? ' is-active' : ''}`}
              disabled={busy || recording}
              onClick={() => setMedia('text')}
            >
              {t('books.media.text')}
            </button>
            <button
              type="button"
              className={`choice-card${media === 'voice' ? ' is-active' : ''}`}
              disabled={busy || recording}
              onClick={() => setMedia('voice')}
            >
              {t('books.media.voice')}
            </button>
          </div>

          {media === 'text' ? (
            <div className="field">
              <label htmlFor="final-viewpoint-text">{t('books.finalModal.textLabel')}</label>
              <textarea
                id="final-viewpoint-text"
                className="field-textarea"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('books.finalModal.textPlaceholder')}
                maxLength={4000}
                required
                autoFocus
                disabled={busy}
              />
            </div>
          ) : (
            <div className="field voice-recorder">
              <div className="cluster">
                <button
                  type="button"
                  className={`btn btn-record${recording ? ' is-recording' : ''}`}
                  disabled={busy}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording
                    ? t('app.stop')
                    : audioBlob
                      ? t('books.finalModal.recordAgain')
                      : t('books.finalModal.recordVoice')}
                </button>
                <span>{`${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}</span>
              </div>
              {audioUrl ? <audio controls src={audioUrl} className="is-visible final-viewpoint-audio" /> : null}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {busy ? t('app.submitting') : t('books.finalModal.submit')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy || recording} onClick={onClose}>
              {t('app.later')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
