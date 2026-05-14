import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  FingerprintRegular, PersonRegular,
  LockClosedRegular, EyeRegular, EyeOffRegular,
} from '@fluentui/react-icons'

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 13 5 4 14 4 24s9 19 20 19c11 0 19-8 19-19 0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 16.3 5 9.6 8.9 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 43c5 0 9.4-1.9 12.8-5l-5.9-5C29.3 34.5 26.8 35 24 35c-5.3 0-9.7-3.5-11.3-8.3l-6.5 5C9.5 39 16.2 43 24 43z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l5.9 5C36.8 39.7 44 34.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
)

const iconStyle = {
  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-4)', pointerEvents: 'none',
}

export default function Login({ onLogin }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [captcha, setCaptcha]   = useState({ required: false, question: '', answer: '' })

  const GOOGLE_ERRORS = {
    not_configured: { uz: 'Google OAuth sozlanmagan',                      ru: 'Google OAuth не настроен' },
    cancelled:      { uz: 'Google orqali kirish bekor qilindi',            ru: 'Вход через Google отменён' },
    no_user:        { uz: 'Bu Google email uchun foydalanuvchi topilmadi', ru: 'Пользователь не найден'    },
    not_enabled:    { uz: 'So\'rovingiz administratorga yuborildi',        ru: 'Запрос отправлен администратору' },
  }

  useState(() => {
    const ge = searchParams.get('google_error')
    if (ge && GOOGLE_ERRORS[ge]) setError(GOOGLE_ERRORS[ge][i18n.language] ?? GOOGLE_ERRORS[ge].uz)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: username, password, captcha_answer: captcha.answer || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (onLogin) onLogin()
        navigate('/dashboard')
      } else {
        const detail = data.detail || {}
        const msg = typeof detail === 'string' ? detail : (detail.message || t('login.errCreds'))
        setError(msg)
        if (detail.captcha_required) {
          setCaptcha(c => ({ ...c, required: true, question: detail.captcha_question || '', answer: '' }))
        }
      }
    } catch {
      setError(t('login.errConn'))
    } finally {
      setLoading(false)
    }
  }

  const inputBase = {
    width: '100%',
    background: 'var(--input-bg)',
    border: '1px solid var(--input-bd)',
    borderRadius: 8, color: 'var(--text-1)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 400, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 32px', boxShadow: 'var(--shadow)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FingerprintRegular fontSize={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--white)', margin: '0 0 5px' }}>BioFace</h1>
          <p style={{ color: 'var(--text-4)', fontSize: 13 }}>{t('login.subtitle')}</p>
        </div>

        {/* Google */}
        <button type="button" onClick={() => { window.location.href = 'http://127.0.0.1:8000/auth/google/start' }}
          style={{ width: '100%', padding: '10px', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
        >
          <GoogleIcon /> {t('login.google')}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-5)' }}>{t('login.or')}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Username */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{t('login.username')}</label>
            <div style={{ position: 'relative' }}>
              <PersonRegular fontSize={15} style={iconStyle} />
              <input type="text" value={username} required onChange={e => setUsername(e.target.value)} placeholder="admin"
                style={{ ...inputBase, padding: '10px 13px 10px 38px' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--input-bd)'}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>{t('login.password')}</label>
            <div style={{ position: 'relative' }}>
              <LockClosedRegular fontSize={15} style={iconStyle} />
              <input type={showPass ? 'text' : 'password'} value={password} required onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                style={{ ...inputBase, padding: '10px 40px 10px 38px' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--input-bd)'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 0 }}>
                {showPass ? <EyeOffRegular fontSize={15} /> : <EyeRegular fontSize={15} />}
              </button>
            </div>
          </div>

          {/* Captcha */}
          {captcha.required && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>🔢 {captcha.question}</label>
              <input type="text" value={captcha.answer} required onChange={e => setCaptcha(c => ({ ...c, answer: e.target.value }))}
                placeholder={t('login.captchaPlh')}
                style={{ ...inputBase, padding: '10px 13px', borderColor: 'var(--yellow-bd)' }}
                onFocus={e => e.target.style.borderColor = 'var(--yellow)'}
                onBlur={e => e.target.style.borderColor = 'var(--yellow-bd)'}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '9px 13px', color: 'var(--red)', fontSize: 12.5 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ marginTop: 4, padding: '11px', background: loading ? 'var(--accent-h)' : 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-h)' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)' }}
          >
            {loading && <Spinner size="tiny" appearance="inverted" />}
            {loading ? t('login.loading') : t('login.submit')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-5)' }}>
          {t('login.footer')}
        </p>
      </div>
    </div>
  )
}
