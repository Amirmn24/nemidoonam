import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError, waitlistApi } from '../../shared/api'
import LocaleToggle from '../../shared/LocaleToggle'
import { useLandingScene, useLandingUi } from './useLandingEffects'
import './landing.css'

export default function LandingPage() {
  const { t, i18n } = useTranslation()
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const isEn = i18n.language?.startsWith('en')
  const dir = isEn ? 'ltr' : 'rtl'

  const [email, setEmail] = useState('')
  const [formMsg, setFormMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [miniFlipped, setMiniFlipped] = useState(false)
  const [demoFlipped, setDemoFlipped] = useState(false)
  const [nextReview, setNextReview] = useState('')
  const [nextPop, setNextPop] = useState(false)

  useLandingScene(canvasRef)
  useLandingUi(rootRef, i18n.language)

  useEffect(() => {
    document.title = t('landing.title')
    const prev = document.body.className
    document.body.className = ''
    return () => {
      document.body.className = prev
    }
  }, [t, i18n.language])

  useEffect(() => {
    setFormMsg('')
    setNextReview('')
  }, [i18n.language])

  const onWaitlist = async (e) => {
    e.preventDefault()
    const em = email.trim()
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)
    if (!ok) {
      setFormMsg(t('landing.waitlist.invalidEmail'))
      setShake(false)
      requestAnimationFrame(() => setShake(true))
      return
    }
    setFormMsg('')
    setBusy(true)
    try {
      await waitlistApi.join({ email: em, source: 'landing' })
      setSuccess(true)
    } catch (err) {
      setFormMsg(err instanceof ApiError ? err.message : t('landing.waitlist.failed'))
      setShake(false)
      requestAnimationFrame(() => setShake(true))
    } finally {
      setBusy(false)
    }
  }

  const setRate = (rate) => {
    const map = {
      hard: t('landing.srs.nextHard'),
      good: t('landing.srs.nextGood'),
      easy: t('landing.srs.nextEasy'),
    }
    setNextReview(map[rate] || '')
    setNextPop(false)
    requestAnimationFrame(() => setNextPop(true))
  }

  const features = [
    { id: 'f1', delay: '.05s', title: t('landing.features.f1Title'), body: t('landing.features.f1Body') },
    { id: 'f2', delay: '.12s', title: t('landing.features.f2Title'), body: t('landing.features.f2Body') },
    { id: 'f3', delay: '.19s', title: t('landing.features.f3Title'), body: t('landing.features.f3Body') },
    { id: 'f4', delay: '.05s', title: t('landing.features.f4Title'), body: t('landing.features.f4Body') },
    { id: 'f5', delay: '.12s', title: t('landing.features.f5Title'), body: t('landing.features.f5Body') },
    { id: 'f6', delay: '.19s', title: t('landing.features.f6Title'), body: t('landing.features.f6Body') },
  ]

  const steps = [
    { id: 's1', num: isEn ? '01' : '۰۱', title: t('landing.how.s1Title'), body: t('landing.how.s1Body'), d: '.05s' },
    { id: 's2', num: isEn ? '02' : '۰۲', title: t('landing.how.s2Title'), body: t('landing.how.s2Body'), d: '.15s' },
    { id: 's3', num: isEn ? '03' : '۰۳', title: t('landing.how.s3Title'), body: t('landing.how.s3Body'), d: '.25s' },
    { id: 's4', num: isEn ? '04' : '۰۴', title: t('landing.how.s4Title'), body: t('landing.how.s4Body'), d: '.35s' },
  ]

  const marqueeItems = [
    t('landing.marquee.flashcards'),
    t('landing.marquee.srs'),
    t('landing.marquee.reminders'),
    t('landing.marquee.challenges'),
    t('landing.marquee.notes'),
    t('landing.marquee.library'),
  ]

  const srsDots = [
    t('landing.srs.today'),
    t('landing.srs.d1'),
    t('landing.srs.d3'),
    t('landing.srs.d7'),
    t('landing.srs.d21'),
    t('landing.srs.d35'),
  ]

  const faqs = [
    { id: 'q1', q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { id: 'q2', q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { id: 'q3', q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { id: 'q4', q: t('landing.faq.q4'), a: t('landing.faq.a4') },
  ]

  const waitlistTitleAfter = t('landing.waitlist.titleAfter')

  return (
    <div className="landing-root" dir={dir} lang={isEn ? 'en' : 'fa'} ref={rootRef}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <symbol id="logoMark" viewBox="0 0 140 130">
          <defs>
            <linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a5b4fc" />
              <stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
          <path fill="url(#lgm)" d="M12 6 H52 C46 10 44 16 46 22 L80 104 L80 122 H58 L20 26 C18 18 16 10 12 6 Z" />
          <path fill="url(#lgm)" d="M6 18 H17 L56 112 C58 118 55 122 49 122 H47 Z" />
          <g stroke="url(#lgm)" fill="none" strokeLinecap="round">
            <path d="M124 8 L80 120" strokeWidth="7" />
            <path d="M124 8 L113 16 L79 106" strokeWidth="4" />
            <path d="M88 34 C96 16 108 8 122 6" strokeWidth="5" />
            <path d="M95 40 C103 26 112 18 124 16" strokeWidth="2.5" />
          </g>
          <path fill="url(#lgm)" d="M52 12 C70 18 80 34 80 60 C80 70 78 78 75 84 C76 56 68 34 50 20 Z" />
        </symbol>
      </svg>

      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <canvas className="landing-webgl" ref={canvasRef} />

      <header data-landing-nav>
        <div className="nav">
          <a className="brand" href="#home">
            <svg className="mark"><use href="#logoMark" /></svg>
            <span className="wordmark">Vyrvona</span>
          </a>
          <nav className="nav-links" data-landing-nav-links>
            <a href="#features">{t('landing.nav.features')}</a>
            <a href="#how">{t('landing.nav.how')}</a>
            <a href="#srs">{t('landing.nav.srs')}</a>
            <a href="#faq">{t('landing.nav.faq')}</a>
            <div className="nav-actions">
              <LocaleToggle />
              <Link to="/login" className="btn btn-ghost btn-sm">{t('landing.nav.login')}</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">{t('landing.nav.signup')}</Link>
            </div>
          </nav>
          <a href="#waitlist" className="btn btn-primary btn-sm" style={{ marginInlineStart: 16 }}>
            {t('landing.nav.waitlist')}
          </a>
          <button type="button" className="landing-burger" data-landing-burger aria-label={t('landing.nav.menu')}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero hero" id="home">
          <div className="hero-grid">
            <div>
              <span className="badge">
                <span className="pulse" /> {t('landing.hero.badge')}
                {!isEn ? (
                  <>
                    {' — '}
                    <span className="en" style={{ fontSize: '.75rem' }}>{t('landing.hero.badgeEn')}</span>
                  </>
                ) : null}
              </span>
              <h1>
                {t('landing.hero.titleBefore')}
                <br />
                <span className="grad">{t('landing.hero.titleGrad')}</span> {t('landing.hero.titleAfter')}
              </h1>
              <span className={`en-sub${isEn ? '' : ' en'}`}>{t('landing.hero.subtitle')}</span>
              <p className="lead">{t('landing.hero.lead')}</p>
              <div className="hero-cta">
                <a href="#waitlist" className="btn btn-primary">{t('landing.hero.ctaWaitlist')}</a>
                <Link to="/signup" className="btn btn-ghost">{t('landing.hero.ctaSignup')}</Link>
                <a href="#features" className="btn btn-ghost">{t('landing.hero.ctaFeatures')}</a>
              </div>
              <div className="chips">
                <span className="chip">{t('landing.hero.chipFlashcards')}</span>
                <span className="chip">{t('landing.hero.chipSrs')}</span>
                <span className="chip">{t('landing.hero.chipReminders')}</span>
                <span className="chip">{t('landing.hero.chipLibrary')}</span>
              </div>
            </div>

            <div className="scene3d reveal" style={{ '--d': '.2s' }}>
              <div className="mock" data-mock>
                <button
                  type="button"
                  className={`float-ff${miniFlipped ? ' is-flipped' : ''}`}
                  aria-label={t('landing.mock.miniAria')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMiniFlipped((v) => !v)
                  }}
                >
                  <div className="ff-inner">
                    <div className="ff-face ff-front">
                      {t('landing.mock.miniQ')}
                      <small>{t('landing.mock.miniQHint')}</small>
                    </div>
                    <div className="ff-face ff-back">
                      {t('landing.mock.miniA')}
                      <small>{t('landing.mock.miniAHint')}</small>
                    </div>
                  </div>
                </button>
                <div className="window">
                  <div className="win-bar">
                    <span className="dot r" /><span className="dot y" /><span className="dot g" />
                    <span className={`win-title${isEn ? '' : ' en'}`}>{t('landing.mock.winTitle')}</span>
                    <span className="win-chip">{t('landing.mock.winChip')}</span>
                  </div>
                  <div className="win-body">
                    <aside className="win-side">
                      <span className="side-title">{t('landing.mock.library')}</span>
                      <div className="book active">
                        <span className="spine" style={{ background: 'linear-gradient(#818cf8,#4f46e5)' }} />
                        {t('landing.mock.book1')}
                      </div>
                      <div className="book">
                        <span className="spine" style={{ background: 'linear-gradient(#f0abfc,#a855f7)' }} />
                        {t('landing.mock.book2')}
                      </div>
                      <div className="book">
                        <span className="spine" style={{ background: 'linear-gradient(#67e8f9,#0891b2)' }} />
                        {t('landing.mock.book3')}
                      </div>
                      <div className="book">
                        <span className="spine" style={{ background: 'linear-gradient(#fcd34d,#d97706)' }} />
                        {t('landing.mock.book4')}
                      </div>
                    </aside>
                    <div className="win-reader">
                      <h4>{t('landing.mock.readerTitle')}</h4>
                      <p>
                        {t('landing.mock.readerBodyBefore')}{' '}
                        <mark>
                          {t('landing.mock.readerHighlight')}
                          <span className="hl-tip">{t('landing.mock.readerTip')}</span>
                        </mark>{' '}
                        {t('landing.mock.readerBodyAfter')}
                      </p>
                    </div>
                    <aside className="win-notes">
                      <span className="side-title">{t('landing.mock.notes')}</span>
                      <div className="note">{t('landing.mock.note1')}</div>
                      <div className="note b">{t('landing.mock.note2')}</div>
                    </aside>
                  </div>
                  <div className="win-progress">
                    <span>{t('landing.mock.progress')}</span>
                    <div className="pbar"><i /></div>
                    <span>{isEn ? '68%' : '۶۸٪'}</span>
                  </div>
                </div>
                <div className="toast">{t('landing.mock.toast')}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" dir="ltr" aria-hidden="true">
          <div className="track">
            {[0, 1].map((copy) => (
              <div className="mq" key={copy}>
                {marqueeItems.map((item) => (
                  <span key={`${copy}-${item}`}>
                    {item}
                    <span className="star"> ✦ </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="features">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className={`overline${isEn ? '' : ' en'}`}>{t('landing.features.overline')}</span>
              <h2>{t('landing.features.title')}</h2>
              <p>{t('landing.features.lead')}</p>
            </div>
            <div className="f-grid">
              {features.map((f) => (
                <FeatureCard key={f.id} delay={f.delay} title={f.title}>
                  {f.body}
                </FeatureCard>
              ))}
            </div>
          </div>
        </section>

        <section id="how">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className={`overline${isEn ? '' : ' en'}`}>{t('landing.how.overline')}</span>
              <h2>{t('landing.how.title')}</h2>
              <p>{t('landing.how.lead')}</p>
            </div>
            <div className="steps">
              {steps.map((s) => (
                <div className="step reveal" style={{ '--d': s.d }} key={s.id}>
                  <div className="step-num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="srs">
          <div className="wrap">
            <div className="srs-panel reveal">
              <div className="sec-head" style={{ marginBottom: 44 }}>
                <span className={`overline${isEn ? '' : ' en'}`}>{t('landing.srs.overline')}</span>
                <h2>{t('landing.srs.title')}</h2>
                <p>{t('landing.srs.lead')}</p>
              </div>
              <div className="srs-grid">
                <div>
                  <div
                    className={`demo-card${demoFlipped ? ' flipped' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={t('landing.srs.cardAria')}
                    onClick={() => setDemoFlipped((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDemoFlipped((v) => !v)
                      }
                    }}
                  >
                    <div className="demo-inner">
                      <div className="demo-face demo-front">
                        <span className="q-ico">❓</span>
                        <h4>{t('landing.srs.q')}</h4>
                        <small>{t('landing.srs.qHint')}</small>
                      </div>
                      <div className="demo-face demo-back">
                        <span className="q-ico">💡</span>
                        <h4>{t('landing.srs.a')}</h4>
                        <small>{t('landing.srs.aHint')}</small>
                      </div>
                    </div>
                  </div>
                  <div className="rate-row">
                    <button type="button" className="rate hard" onClick={(e) => { e.stopPropagation(); setRate('hard') }}>
                      {t('landing.srs.hard')}
                    </button>
                    <button type="button" className="rate good" onClick={(e) => { e.stopPropagation(); setRate('good') }}>
                      {t('landing.srs.good')}
                    </button>
                    <button type="button" className="rate easy" onClick={(e) => { e.stopPropagation(); setRate('easy') }}>
                      {t('landing.srs.easy')}
                    </button>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className={`next-review${nextPop ? ' pop' : ''}`}>{nextReview}</span>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 14 }}>{t('landing.srs.sideTitle')}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: 8 }}>{t('landing.srs.sideBody')}</p>
                </div>
              </div>
              <div className="srs-line" aria-hidden="true">
                {srsDots.map((label) => (
                  <div className="srs-dot" key={label}><i /><span>{label}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className={`overline${isEn ? '' : ' en'}`}>{t('landing.faq.overline')}</span>
              <h2>{t('landing.faq.title')}</h2>
            </div>
            <div className="faq reveal">
              {faqs.map((item) => (
                <FaqItem key={item.id} q={item.q}>{item.a}</FaqItem>
              ))}
            </div>
          </div>
        </section>

        <section id="waitlist">
          <div className="wl-panel reveal">
            <span className={`overline${isEn ? '' : ' en'}`}>{t('landing.waitlist.overline')}</span>
            <h2>
              {t('landing.waitlist.titleBefore')} <span className="grad">Vyrvona</span>
              {waitlistTitleAfter ? ` ${waitlistTitleAfter}` : ''}
            </h2>
            <p>{t('landing.waitlist.lead')}</p>
            {!success ? (
              <form className={`wl-form${shake ? ' shake' : ''}`} onSubmit={onWaitlist} noValidate>
                <input
                  type="email"
                  className="wl-email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? t('landing.waitlist.submitting') : t('landing.waitlist.submit')}
                </button>
                <span className="wl-form-msg">{formMsg}</span>
              </form>
            ) : (
              <div className="wl-success show">
                <svg viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M14 27l8 8 16-16" />
                </svg>
                <h3>{t('landing.waitlist.successTitle')}</h3>
                <p>{t('landing.waitlist.successBody')}</p>
              </div>
            )}
            <p className="wl-note">{t('landing.waitlist.note')}</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="foot">
          <a className="brand" href="#home">
            <svg className="mark" style={{ width: 32, height: 30 }}><use href="#logoMark" /></svg>
            <span className="wordmark">Vyrvona</span>
          </a>
          <p>{t('landing.footer.tagline')}</p>
          <p>{t('landing.footer.rights')}</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ delay, title, children }) {
  return (
    <article className="f-card reveal" data-tilt style={{ '--d': delay }}>
      <div className="f-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
          <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

function FaqItem({ q, children }) {
  return (
    <div className="faq-item">
      <button type="button" className="faq-q">
        {q} <span className="arr">▾</span>
      </button>
      <div className="faq-a"><p>{children}</p></div>
    </div>
  )
}
