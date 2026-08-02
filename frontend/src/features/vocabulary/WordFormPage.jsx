import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { vocabularyApi, ApiError } from '../../shared/api'
import { useAuth } from '../../shared/AuthContext'

export default function WordFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { showToast } = useAuth()
  const [word, setWord] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [timer, setTimer] = useState(0)
  const [clearAudio, setClearAudio] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isEdit) return
    vocabularyApi
      .detail(id)
      .then((data) => {
        setWord(data)
        if (data.audio_url) setAudioUrl(data.audio_url)
      })
      .finally(() => setLoading(false))
  }, [id, isEdit])

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
        setClearAudio(false)
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
    fd.set('term', form.term.value)
    fd.set('meaning', form.meaning.value)
    fd.set('usage', form.usage.value || '')
    if (audioBlob) fd.set('audio', audioBlob, 'pronunciation.webm')
    if (clearAudio) fd.set('clear_audio', 'true')

    try {
      if (isEdit) await vocabularyApi.update(id, fd)
      else await vocabularyApi.create(fd)
      showToast('واژه ذخیره شد.', 'success')
      navigate('/vocabulary')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>در حال بارگذاری…</p>

  return (
    <div className="page-vocabulary-form">
      <section className="section form-page">
        <div className="page-toolbar">
          <h1>{isEdit ? 'ویرایش واژه' : 'واژه جدید'}</h1>
        </div>
        {error ? <div className="form-errors">{error}</div> : null}
        <form className="form-panel" id="vocab-form" onSubmit={onSubmit}>
          <div className="field">
            <label>واژه</label>
            <input name="term" className="field-input" defaultValue={word?.term || ''} required />
          </div>
          <div className="field">
            <label>معنی</label>
            <textarea
              name="meaning"
              className="field-textarea"
              rows={3}
              defaultValue={word?.meaning || ''}
              required
            />
          </div>
          <div className="field">
            <label>کاربرد</label>
            <textarea
              name="usage"
              className="field-textarea"
              rows={3}
              defaultValue={word?.usage || ''}
            />
          </div>

          <div className="field voice-recorder">
            <div className="form-step-label">تلفظ</div>
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
            {audioUrl ? <audio controls src={audioUrl} /> : null}
            {word?.has_audio ? (
              <label>
                <input
                  type="checkbox"
                  checked={clearAudio}
                  onChange={(e) => setClearAudio(e.target.checked)}
                />{' '}
                حذف تلفظ فعلی
              </label>
            ) : null}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              ذخیره
            </button>
            <Link to="/vocabulary" className="btn btn-ghost">
              انصراف
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
