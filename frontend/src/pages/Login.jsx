import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  FingerprintRegular, PersonRegular,
  LockClosedRegular, EyeRegular, EyeOffRegular,
} from '@fluentui/react-icons'
import { useToast } from '../components/Toaster'

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 13 5 4 14 4 24s9 19 20 19c11 0 19-8 19-19 0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 16.3 5 9.6 8.9 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 43c5 0 9.4-1.9 12.8-5l-5.9-5C29.3 34.5 26.8 35 24 35c-5.3 0-9.7-3.5-11.3-8.3l-6.5 5C9.5 39 16.2 43 24 43z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l5.9 5C36.8 39.7 44 34.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
)

const TelegramIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#0088cc" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-2 .12-3.82 1.34-.27.18-.51.27-.72.27-.23 0-.67-.12-1-.23-.4-.13-.72-.2-.69-.43.02-.11.18-.23.5-.35 1.96-.85 3.27-1.42 3.93-1.7 1.86-.77 2.25-.91 2.5-.91.06 0 .18.01.26.08.07.05.09.13.1.2.01.07.01.14 0 .22z"/>
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

  const [logoUrl, setLogoUrl] = useState('')
  const [appName, setAppName] = useState('BioFace')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Failed to load settings')
      })
      .then(data => {
        if (data) {
          setAppName(data.app_name || 'BioFace')
          setLogoUrl(data.logo_url || '')
        }
      })
      .catch(err => {
        console.log('Error loading branding settings:', err)
      })
  }, [])
  const [version, setVersion] = useState('1.0')

  useEffect(() => {
    fetch('/api/versions')
      .then(r => r.ok ? r.json() : null)
      .then(list => { if (list?.length) setVersion(list[0].version) })
      .catch(() => {})
  }, [])


  const toast = useToast()
  const isRu = i18n.language === 'ru'

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
    if (ge && GOOGLE_ERRORS[ge]) {
      setError(GOOGLE_ERRORS[ge][i18n.language] ?? GOOGLE_ERRORS[ge].uz)
    } else {
      const err = searchParams.get('error')
      if (err === 'not_staff') {
        setError(isRu 
          ? 'Вход в веб-панель разрешен только для системных пользователей. Пожалуйста, используйте мобильное приложение.' 
          : 'Veb-panelga faqat tizim foydalanuvchilari (adminlar) kira oladi. Iltimos, mobil ilovadan foydalaning.')
      }
    }
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
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={appName}
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                objectFit: 'contain',
                margin: '0 auto 12px',
                display: 'block'
              }}
            />
          ) : (
            <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <FingerprintRegular fontSize={28} color="#fff" />
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--white)', margin: '0 0 5px' }}>{appName}</h1>
          <p style={{ color: 'var(--text-4)', fontSize: 13 }}>{t('login.subtitle')}</p>
        </div>

        {/* Google */}
        <button type="button" onClick={() => { window.location.href = '/auth/google/start' }}
          style={{ width: '100%', padding: '10px', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
        >
          <GoogleIcon /> {t('login.google')}
        </button>

        {/* Telegram */}
        <button type="button" onClick={() => {
          toast.warning(isRu ? 'Вход через Telegram временно недоступен (в разработке).' : 'Telegram orqali kirish vaqtincha ish faoliyatida emas (ishlab chiqilmoqda).')
        }}
          style={{ width: '100%', padding: '10px', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
        >
          <TelegramIcon /> {isRu ? 'Войти через Telegram' : 'Telegram orqali kirish'}
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
              <input type="text" value={username} required onChange={e => setUsername(e.target.value)} placeholder={t('login.username')}
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
          BioFace Attendance System v{version}
        </p>
      </div>
    </div>
  )
}
