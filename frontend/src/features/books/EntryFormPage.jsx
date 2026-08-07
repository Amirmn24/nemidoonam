import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import EntryFlagToggles from './components/EntryFlagToggles'

const KINDS = [
  { value: 'viewpoint', label: 'دیدگاه' },
  { value: 'feeling', label: 'حس' },
  { value: 'book_text', label: 'متن کتاب' },
]
const MEDIAS = [
  { value: 'text', label: 'متن' },
  { value: 'voice', label: 'ویس' },
  { value: 'image', label: 'تصویر' },
]

export default function EntryFormPage() {
  const { id: bookId, entryId } = useParams()
  const isEdit = Boolean(entryId)
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [kind, setKind] = useState('viewpoint')
  const [media, setMedia] = useState('text')
  const [isPublic, setIsPublic] = useState(false)
  const [isSealed, setIsSealed] = useState(false)
  const [entry, setEntry] = useState(null)
  const [book, setBook] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [timer, setTimer] = useState(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    booksApi.detail(bookId).then((data) => setBook(data.book))
    if (isEdit) {
      booksApi.getEntry(bookId, entryId).then((data) => {
        setEntry(data)
        setKind(data.kind === 'final_viewpoint' ? 'viewpoint' : data.kind)
        setMedia(data.media_type)
        setIsPublic(Boolean(data.is_public))
        setIsSealed(Boolean(data.is_sealed))
        if (data.image_url) setImagePreview(data.image_url)
        if (data.audio_url) setAudioUrl(data.audio_url)
      })
    }
  }, [bookId, entryId, isEdit])

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  const startRecording = async () => {
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
      setError('دسترسی به میکروفون ممکن نشد.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = e.target
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('media_type', media)
    fd.set('page_number', form.page_number.value)
    fd.set('entry_date', form.entry_date.value)
    fd.set('text_content', form.text_content?.value || '')
    fd.set('is_public', isPublic ? 'true' : 'false')
    fd.set('is_sealed', isSealed ? 'true' : 'false')
    if (media === 'image' && form.image?.files?.[0]) fd.set('image', form.image.files[0])
    if (media === 'voice' && audioBlob) {
      fd.set('audio', audioBlob, 'recording.webm')
    }

    try {
      if (isEdit) await booksApi.updateEntry(bookId, entryId, fd)
      else await booksApi.createEntry(bookId, fd)
      showToast('یادداشت ذخیره شد.', 'success')
      navigate(`/books/${bookId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const showPublicToggle = kind === 'viewpoint'

  return (
    <div className="page-entry-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? 'ویرایش یادداشت' : 'یادداشت جدید'}</h1>
          {book ? <p>{book.title}</p> : null}
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel" id="entry-form" onSubmit={onSubmit}>
          <div className="form-step">
            <div className="form-step-label">نوع محتوا</div>
            <div className="choice-grid" id="kind-choices">
              {KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`choice-card${kind === item.value ? ' is-active' : ''}`}
                  onClick={() => {
                    setKind(item.value)
                    if (item.value !== 'viewpoint') setIsPublic(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-step">
            <div className="form-step-label">رسانه</div>
            <div className="choice-grid" id="media-choices">
              {MEDIAS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`choice-card${media === item.value ? ' is-active' : ''}`}
                  onClick={() => setMedia(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-step">
            <div className="form-step-label">پرچم‌ها</div>
            <EntryFlagToggles
              isPublic={isPublic}
              isSealed={isSealed}
              showPublic={showPublicToggle}
              onPublicChange={setIsPublic}
              onSealedChange={setIsSealed}
            />
          </div>

          <div className="field media-field">
            <label>{media === 'text' ? 'متن' : 'توضیح (اختیاری)'}</label>
            <textarea
              name="text_content"
              className="field-textarea"
              rows={media === 'text' ? 6 : 3}
              defaultValue={entry?.text_content || ''}
              required={media === 'text'}
              key={`text-${entry?.id || 'new'}-${media}`}
            />
          </div>

          {media === 'image' ? (
            <div
              className="field media-field"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (!file || !file.type.startsWith('image/')) return
                const input = e.currentTarget.querySelector('input[name="image"]')
                if (input) {
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  input.files = dt.files
                }
                setImagePreview(URL.createObjectURL(file))
              }}
            >
              <label>تصویر</label>
              <input
                name="image"
                type="file"
                accept="image/*"
                className="field-file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  setImagePreview(file ? URL.createObjectURL(file) : entry?.image_url)
                }}
              />
              {imagePreview ? (
                <div className="image-preview is-visible">
                  <img src={imagePreview} alt="" />
                </div>
              ) : null}
            </div>
          ) : null}

          {media === 'voice' ? (
            <div className="field media-field voice-recorder" id="voice-recorder">
              <div className="cluster">
                <button
                  type="button"
                  className={`btn btn-record${recording ? ' is-recording' : ''}`}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? 'توقف' : 'ضبط'}
                </button>
                <span>{`${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}</span>
              </div>
              {audioUrl ? <audio controls src={audioUrl} className="is-visible" /> : null}
              {entry?.audio_url && !audioBlob ? (
                <p className="field-hint">ویس قبلی نگه داشته می‌شود مگر دوباره ضبط کنی</p>
              ) : null}
            </div>
          ) : null}

          <div className="form-grid two">
            <div className="field">
              <label>شماره صفحه</label>
              <input
                name="page_number"
                type="number"
                min="1"
                className="field-input"
                defaultValue={entry?.page_number || Math.max(book?.current_page || 1, 1)}
                required
              />
            </div>
            <div className="field">
              <label>تاریخ</label>
              <input
                name="entry_date"
                type="date"
                className="field-input"
                defaultValue={entry?.entry_date || today}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              ذخیره
            </button>
            <Link to={`/books/${bookId}`} className="btn btn-ghost">
              انصراف
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
