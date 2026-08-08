import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { booksApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'
import EntryFlagToggles from './components/EntryFlagToggles'

const KINDS = ['viewpoint', 'feeling', 'book_text']
const MEDIAS = ['text', 'voice', 'image']

export default function EntryFormPage() {
  const { t } = useTranslation()
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
        stream.getTracks().forEach((track) => track.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => setTimer((n) => n + 1), 1000)
    } catch {
      setError(t('api.micDenied'))
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
      showToast(t('books.entry.savedToast'), 'success')
      navigate(`/books/${bookId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('app.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const showPublicToggle = kind === 'viewpoint' || kind === 'feeling' || kind === 'book_text'

  return (
    <div className="page-entry-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? t('books.entry.editTitle') : t('books.entry.newTitle')}</h1>
          {book ? <p>{book.title}</p> : null}
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel" id="entry-form" onSubmit={onSubmit}>
          <div className="form-step">
            <div className="form-step-label">{t('books.entry.contentType')}</div>
            <div className="choice-grid" id="kind-choices">
              {KINDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card${kind === value ? ' is-active' : ''}`}
                  onClick={() => {
                    setKind(value)
                  }}
                >
                  {t(`books.kind.${value}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-step">
            <div className="form-step-label">{t('books.entry.mediaType')}</div>
            <div className="choice-grid" id="media-choices">
              {MEDIAS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card${media === value ? ' is-active' : ''}`}
                  onClick={() => setMedia(value)}
                >
                  {t(`books.media.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-step">
            <div className="form-step-label">{t('books.entry.flags')}</div>
            <EntryFlagToggles
              isPublic={isPublic}
              isSealed={isSealed}
              showPublic={showPublicToggle}
              onPublicChange={setIsPublic}
              onSealedChange={setIsSealed}
            />
          </div>

          <div className="field media-field">
            <label>{media === 'text' ? t('books.entry.text') : t('books.entry.captionOptional')}</label>
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
              <label>{t('books.entry.image')}</label>
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
                  {recording ? t('app.stop') : t('app.record')}
                </button>
                <span>{`${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}</span>
              </div>
              {audioUrl ? <audio controls src={audioUrl} className="is-visible" /> : null}
              {entry?.audio_url && !audioBlob ? (
                <p className="field-hint">{t('books.entry.keepPreviousVoice')}</p>
              ) : null}
            </div>
          ) : null}

          <div className="form-grid two">
            <div className="field">
              <label>{t('books.entry.pageNumber')}</label>
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
              <label>{t('books.entry.date')}</label>
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
              {t('app.save')}
            </button>
            <Link to={`/books/${bookId}`} className="btn btn-ghost">
              {t('app.cancel')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
