import { useEffect, useRef, useState } from 'react'

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
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000)
    } catch {
      setLocalError('دسترسی به میکروفون ممکن نشد.')
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
            <p className="eyebrow">دیدگاه پایانی</p>
            <h2 id="final-viewpoint-title">تحلیل آخرت از این کتاب چیه؟</h2>
          </div>
        </div>
        <p className="final-viewpoint-hint">
          {bookTitle ? (
            <>
              برای «{bookTitle}» یک دیدگاه پایانی ثبت کن؛ عمومی می‌شود و قفل دیدن دیدگاه دیگران باز می‌شود.
            </>
          ) : (
            <>یک دیدگاه پایانی ثبت کن؛ عمومی می‌شود و قفل دیدن دیدگاه دیگران باز می‌شود.</>
          )}
        </p>

        {localError ? <p className="form-errors">{localError}</p> : null}

        <form onSubmit={handleSubmit}>
          <div className="choice-grid final-media-choices" role="group" aria-label="نوع محتوا">
            <button
              type="button"
              className={`choice-card${media === 'text' ? ' is-active' : ''}`}
              disabled={busy || recording}
              onClick={() => setMedia('text')}
            >
              متن
            </button>
            <button
              type="button"
              className={`choice-card${media === 'voice' ? ' is-active' : ''}`}
              disabled={busy || recording}
              onClick={() => setMedia('voice')}
            >
              ویس
            </button>
          </div>

          {media === 'text' ? (
            <div className="field">
              <label htmlFor="final-viewpoint-text">متن دیدگاه</label>
              <textarea
                id="final-viewpoint-text"
                className="field-textarea"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="حس نهایی، تحلیل، یا حرفی که بعد از تمام شدن کتاب ماند…"
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
                  {recording ? 'توقف' : audioBlob ? 'ضبط دوباره' : 'ضبط ویس'}
                </button>
                <span>{`${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}</span>
              </div>
              {audioUrl ? <audio controls src={audioUrl} className="is-visible final-viewpoint-audio" /> : null}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {busy ? 'در حال ثبت…' : 'ثبت دیدگاه پایانی'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy || recording} onClick={onClose}>
              بعداً
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
