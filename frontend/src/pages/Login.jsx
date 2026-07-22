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

  useEffect(() => {
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
  }, [i18n.language, isRu, searchParams])

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
    <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', position: 'relative', overflow: 'hidden', padding: '24px 16px' }}>
      
      {/* Background Floating Orbs */}
      <div className="glass-orb orb-1"></div>
      <div className="glass-orb orb-2"></div>
      <div className="glass-orb orb-3"></div>

      <style>{`
        /* Floating Glass Orbs */
        .glass-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 1;
          opacity: 0.45;
          animation: floatAround 22s infinite ease-in-out alternate;
          pointer-events: none;
        }
        .orb-1 {
          width: 300px;
          height: 300px;
          background: rgba(99, 102, 241, 0.15); /* Indigo */
          top: 10%;
          left: 10%;
        }
        .orb-2 {
          width: 350px;
          height: 350px;
          background: rgba(16, 185, 129, 0.13); /* Green */
          bottom: 10%;
          right: 15%;
          animation-delay: -5s;
        }
        .orb-3 {
          width: 250px;
          height: 250px;
          background: rgba(236, 72, 153, 0.08); /* Pink */
          top: 40%;
          right: 40%;
          animation-delay: -10s;
        }

        @keyframes floatAround {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          50% { transform: translate(40px, 30px) scale(1.1) rotate(180deg); }
          100% { transform: translate(-20px, 40px) scale(0.9) rotate(360deg); }
        }

        /* Grid Container Layout */
        .login-grid-container {
          display: grid;
          grid-template-columns: 360px 400px;
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 20px;
          overflow: hidden;
          z-index: 10;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        /* Scanner Panel Styling */
        .scanner-panel {
          border-right: 1px solid var(--border-2);
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .scanner-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(135deg, rgba(10, 20, 10, 0.72) 0%, rgba(5, 10, 5, 0.88) 100%), url('/tech_login_bg.jpg');
          background-size: cover;
          background-position: center;
          filter: blur(6px);
          transform: scale(1.1);
          z-index: 0;
          pointer-events: none;
        }
        .scanner-viewfinder {
          width: 180px;
          height: 180px;
          position: relative;
          z-index: 2;
          border: 1px solid rgba(16, 185, 129, 0.3);
          background: rgba(0, 0, 0, 0.5);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-size: 16px 16px;
          background-image: 
            linear-gradient(rgba(16, 185, 129, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.04) 1px, transparent 1px);
        }
        .corner-bracket {
          position: absolute;
          width: 14px;
          height: 14px;
          border: 2.5px solid var(--green);
        }
        .top-left { top: 8px; left: 8px; border-right: none; border-bottom: none; border-top-left-radius: 4px; }
        .top-right { top: 8px; right: 8px; border-left: none; border-bottom: none; border-top-right-radius: 4px; }
        .bottom-left { bottom: 8px; left: 8px; border-right: none; border-top: none; border-bottom-left-radius: 4px; }
        .bottom-right { bottom: 8px; right: 8px; border-left: none; border-top: none; border-bottom-right-radius: 4px; }

        .face-vector {
          width: 110px;
          height: 110px;
          z-index: 5;
        }
        .pulse-node {
          animation: pulseNodeKey 2s infinite ease-in-out;
        }
        @keyframes pulseNodeKey {
          0%, 100% { r: 1.5; opacity: 0.6; }
          50% { r: 3; opacity: 1; fill: var(--green); filter: drop-shadow(0 0 4px var(--green)); }
        }

        .laser-bar {
          position: absolute;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--green), transparent);
          box-shadow: 0 0 10px var(--green);
          z-index: 10;
          animation: scanLaser 3s infinite ease-in-out;
        }
        @keyframes scanLaser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }

        .scanner-status {
          margin-top: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 20px;
          padding: 6px 16px;
          z-index: 2;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          background: var(--green);
          border-radius: 50%;
        }
        .status-dot.pulsing {
          animation: pulseStatus 1.5s infinite alternate;
        }
        @keyframes pulseStatus {
          from { opacity: 0.3; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.25); filter: drop-shadow(0 0 3px var(--green)); }
        }
        .status-text {
          font-size: 11px;
          font-family: monospace;
          color: var(--green);
          font-weight: 700;
          letter-spacing: 1px;
        }

        .login-card-panel {
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        @media (max-width: 800px) {
          .login-grid-container {
            grid-template-columns: 1fr;
            width: 400px;
            max-width: 100%;
          }
          .scanner-panel {
            padding: 30px 20px 20px;
            border-right: none;
            border-bottom: 1px solid var(--border-2);
          }
          .scanner-viewfinder {
            width: 140px;
            height: 140px;
          }
          .face-vector {
            width: 90px;
            height: 90px;
          }
        }
      `}</style>

      <div className="login-grid-container">
        
        {/* Face ID Scanner Graphic Panel */}
        <div className="scanner-panel">
          <div className="scanner-viewfinder">
            {/* Corner brackets */}
            <div className="corner-bracket top-left"></div>
            <div className="corner-bracket top-right"></div>
            <div className="corner-bracket bottom-left"></div>
            <div className="corner-bracket bottom-right"></div>
            
            {/* Green grid pattern */}
            <div className="grid-overlay"></div>

            {/* Glowing Face ID Vector */}
            <svg viewBox="0 0 100 100" className="face-vector">
              <path d="M50 20 C35 20, 25 30, 25 45 C25 60, 32 75, 50 80 C68 75, 75 60, 75 45 C75 30, 65 20, 50 20 Z" fill="none" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M50 25 C38 25, 30 33, 30 45 C30 57, 36 68, 50 73 C64 68, 70 57, 70 45 C70 33, 62 25, 50 25 Z" fill="none" stroke="var(--green)" strokeWidth="1.5" />
              
              <circle cx="40" cy="42" r="2" fill="var(--green)" className="pulse-node" />
              <circle cx="60" cy="42" r="2" fill="var(--green)" className="pulse-node" />
              <circle cx="50" cy="50" r="1.5" fill="var(--green)" />
              <path d="M43 60 Q50 64 57 60" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" />

              <line x1="40" y1="42" x2="50" y2="50" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="0.5" />
              <line x1="60" y1="42" x2="50" y2="50" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="0.5" />
              <line x1="40" y1="42" x2="43" y2="60" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="0.5" />
              <line x1="60" y1="42" x2="57" y2="60" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="0.5" />
            </svg>

            {/* Laser scanning bar */}
            <div className="laser-bar"></div>
          </div>
          
          <div className="scanner-status">
            <div className="status-dot pulsing"></div>
            <span className="status-text">BIOMETRIC ACTIVE</span>
          </div>
        </div>

        {/* Login Form Panel */}
        <div className="login-card-panel">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  objectFit: 'contain',
                  margin: '0 auto 10px',
                  display: 'block'
                }}
              />
            ) : (
              <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <FingerprintRegular fontSize={24} color="#fff" />
              </div>
            )}
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--white)', margin: '0 0 3px' }}>{appName}</h1>
            <p style={{ color: 'var(--text-4)', fontSize: 12.5 }}>{t('login.subtitle')}</p>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-5)' }}>{t('login.or')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Username */}
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>{t('login.username')}</label>
              <div style={{ position: 'relative' }}>
                <PersonRegular fontSize={14} style={iconStyle} />
                <input type="text" value={username} required onChange={e => setUsername(e.target.value)} placeholder={t('login.username')}
                  style={{ ...inputBase, padding: '10px 13px 10px 36px' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--input-bd)'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>{t('login.password')}</label>
              <div style={{ position: 'relative' }}>
                <LockClosedRegular fontSize={14} style={iconStyle} />
                <input type={showPass ? 'text' : 'password'} value={password} required onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ ...inputBase, padding: '10px 38px 10px 36px' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--input-bd)'}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', padding: 0 }}>
                  {showPass ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                </button>
              </div>
            </div>

            {/* Captcha */}
            {captcha.required && (
              <div>
                <label style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>🔢 {captcha.question}</label>
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
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12 }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '11px', background: loading ? 'var(--accent-h)' : 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-h)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)' }}
            >
              {loading && <Spinner size="tiny" appearance="inverted" />}
              {loading ? t('login.loading') : t('login.submit')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 10.5, color: 'var(--text-5)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <span>BioFace Attendance System v{version}</span>
            <a href="/privacy-policy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {isRu ? 'Политика конфиденциальности' : 'Maxfiylik siyosati'}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
