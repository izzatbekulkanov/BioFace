import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  CheckmarkRegular,
  EyeRegular,
  EyeOffRegular,
  ImageRegular,
  DismissRegular,
  LockClosedRegular,
  PhoneRegular,
  MailRegular,
  ShieldRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

export default function Profile() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [currentUser, setCurrentUser] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
    image_url: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [clearImage, setClearImage] = useState(false)

  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then(data => {
        setCurrentUser(data)
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          middle_name: data.middle_name || '',
          email: data.email || '',
          phone: data.phone || '',
          password: '',
          password_confirm: '',
          image_url: data.image_url || '',
        })
        if (data.image_url) {
          setImagePreview(data.image_url)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading profile:', err)
        toast.error(isRu ? 'Авторизуйтесь для просмотра профиля' : 'Profilni ko\'rish uchun tizimga kiring')
        navigate('/login')
      })
  }, [navigate, isRu])

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const onPickImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setClearImage(false)
    }
  }

  const onClearImage = () => {
    setImageFile(null)
    setImagePreview('')
    setClearImage(true)
    setForm(prev => ({ ...prev, image_url: '' }))
  }

  const validate = () => {
    if (!form.first_name.trim()) {
      return isRu ? 'Имя обязательно для заполнения' : 'Ism kiritilishi shart'
    }
    if (!form.email.trim()) {
      return isRu ? 'Email обязателен для заполнения' : 'Email kiritilishi shart'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      return isRu ? 'Некорректный email адрес' : 'Email manzili noto\'g\'ri kiritilgan'
    }
    if (form.password.trim()) {
      if (form.password.length < 6) {
        return isRu ? 'Пароль должен состоять минимум из 6 символов' : 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak'
      }
      if (form.password !== form.password_confirm) {
        return isRu ? 'Пароли не совпадают' : 'Parollar mos kelmadi'
      }
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errText = validate()
    if (errText) {
      setError(errText)
      toast.error(errText)
      return
    }
    setError('')
    setSaving(true)

    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      fd.set('middle_name', form.middle_name.trim())
      fd.set('email', form.email.trim())
      fd.set('phone', form.phone.trim())
      
      // Do not send role or status, but send existing google_oauth_enabled/menu_permissions/organizations
      // to keep them unaltered, or just omit them since backend only updates sent fields.
      if (form.password.trim()) {
        fd.set('password', form.password.trim())
      }
      
      if (imageFile) {
        fd.set('image', imageFile)
      } else if (form.image_url.trim()) {
        fd.set('image_url', form.image_url.trim())
      }

      if (clearImage && !imageFile) {
        fd.set('clear_image', '1')
      }

      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: fd
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }

      toast.success(isRu ? 'Профиль успешно обновлен' : 'Profil muvaffaqiyatli yangilandi')
      
      // Dispatch custom event to notify Navbar of initials updates
      window.dispatchEvent(new Event('user-profile-updated'))
      
      // Refetch latest details to sync UI
      const refreshRes = await fetch('/api/auth/me', { credentials: 'include' })
      if (refreshRes.ok) {
        const freshData = await refreshRes.json()
        setCurrentUser(freshData)
      }
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge="✦"
          title={isRu ? 'Мой профиль' : 'Mening profilim'}
        />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px' }}>
          <div style={cardStyle}>
            <Skeleton width={140} height={14} />
            <div style={{ marginTop: 14 }}><Skeleton.Stats count={5} /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Профиль' : '✦ Profil'}
        title={isRu ? 'Личный профиль' : 'Shaxsiy profil'}
        sub={isRu ? 'Управление учетными данными и настройками' : 'Hisob ma\'lumotlarini va sozlamalarni boshqarish'}
      />

      <form onSubmit={onSubmit} style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={{
            marginBottom: 20, padding: 16, background: 'var(--red-bg)', color: 'var(--red)',
            borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 13, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Main profile form card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
                <PersonRegular fontSize={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {isRu ? 'Основные сведения' : 'Asosiy ma\'lumotlar'}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label={isRu ? 'Имя' : 'Ism'} required>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={setField('first_name')}
                    style={inpStyle}
                    placeholder={isRu ? 'Введите имя' : 'Ismni kiriting'}
                  />
                </Field>

                <Field label={isRu ? 'Фамилия' : 'Familiya'}>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={setField('last_name')}
                    style={inpStyle}
                    placeholder={isRu ? 'Введите фамилию' : 'Familiyani kiriting'}
                  />
                </Field>

                <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={setField('middle_name')}
                    style={inpStyle}
                    placeholder={isRu ? 'Введите отчество' : 'Otasining ismini kiriting'}
                  />
                </Field>

                <Field label={isRu ? 'Роль в системе' : 'Tizimdagi roli'}>
                  <div style={{
                    ...inpStyle,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--text-4)',
                    cursor: 'not-allowed',
                  }}>
                    <ShieldRegular fontSize={14} />
                    <span>{currentUser.role || 'User'}</span>
                  </div>
                </Field>

                <Field label="Email" required>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={setField('email')}
                      style={{ ...inpStyle, paddingLeft: 36 }}
                      placeholder="user@example.com"
                    />
                    <MailRegular fontSize={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-4)' }} />
                  </div>
                </Field>

                <Field label={isRu ? 'Телефон' : 'Telefon'}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={setField('phone')}
                      style={{ ...inpStyle, paddingLeft: 36 }}
                      placeholder="+998..."
                    />
                    <PhoneRegular fontSize={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-4)' }} />
                  </div>
                </Field>
              </div>
            </div>

            {/* Password edit card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-2)', paddingBottom: 12 }}>
                <LockClosedRegular fontSize={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {isRu ? 'Изменить пароль' : 'Parolni o\'zgartirish'}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field
                  label={isRu ? 'Новый пароль' : 'Yangi parol'}
                  hint={isRu ? 'Оставьте пустым, чтобы не менять' : 'O\'zgartirmaslik uchun bo\'sh qoldiring'}
                >
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={setField('password')}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPwd(s => !s)} style={eyeBtn} aria-label="toggle">
                      {showPwd ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                    </button>
                  </div>
                </Field>

                <Field
                  label={isRu ? 'Подтверждение пароля' : 'Parolni tasdiqlash'}
                  hint={isRu ? 'Должен совпадать с новым паролем' : 'Yangi parol bilan bir xil bo\'lishi kerak'}
                  hintTone={form.password_confirm && form.password === form.password_confirm ? 'ok' : (form.password_confirm ? 'err' : 'muted')}
                >
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd2 ? 'text' : 'password'}
                      value={form.password_confirm}
                      onChange={setField('password_confirm')}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPwd2(s => !s)} style={eyeBtn} aria-label="toggle">
                      {showPwd2 ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                    </button>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Avatar block */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Avatar
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 130, height: 130, borderRadius: '50%',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImagePreview('')} />
                    : <PersonRegular fontSize={44} style={{ color: 'var(--text-4)' }} />}
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                  border: '1px solid var(--accent-bd)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                >
                  <ImageRegular fontSize={14} />
                  {isRu ? 'Выбрать фото' : 'Rasm tanlash'}
                  <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
                </label>

                {imagePreview && (
                  <button type="button" onClick={onClearImage} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 7,
                    background: 'transparent', color: 'var(--red)',
                    border: '1px solid var(--red-bd)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <DismissRegular fontSize={13} />
                    {isRu ? 'Удалить' : 'O\'chirish'}
                  </button>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <Field label={isRu ? 'URL изображения' : 'Rasm URL'}>
                  <input
                    value={form.image_url}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm(prev => ({ ...prev, image_url: v }))
                      if (!imageFile) setImagePreview(v)
                    }}
                    style={inpStyle}
                    placeholder="https://..."
                  />
                </Field>
              </div>
            </div>

            {/* Google OAuth Status Card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Integratsiya
                </h3>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid var(--border-2)', background: 'var(--bg)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: currentUser.google_oauth_enabled ? 'rgba(76, 175, 80, 0.15)' : 'var(--surface-2)',
                  color: currentUser.google_oauth_enabled ? '#4caf50' : 'var(--text-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, flexShrink: 0,
                  border: currentUser.google_oauth_enabled ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid var(--border-2)',
                }}>G</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Google OAuth</div>
                  <div style={{ fontSize: 11, color: currentUser.google_oauth_enabled ? '#4caf50' : 'var(--text-4)', marginTop: 2, fontWeight: 500 }}>
                    {currentUser.google_oauth_enabled 
                      ? (isRu ? 'Интеграция активна' : 'Google orqali kirish faol')
                      : (isRu ? 'Интеграция отключена' : 'Google orqali kirish faol emas')}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Buttons footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button type="button" onClick={() => navigate('/dashboard')} disabled={saving} style={btnStyle('subtle')}>
            {isRu ? 'Назад' : 'Orqaga'}
          </button>
          <button type="submit" disabled={saving} style={btnStyle('accent')}>
            {saving
              ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <CheckmarkRegular fontSize={14} />}
            {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styling tokens
// ────────────────────────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
}

const inpStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-2)',
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontSize: 13.5,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const eyeBtn = {
  position: 'absolute', right: 0, top: 0, bottom: 0,
  width: 36, border: 'none', background: 'transparent',
  color: 'var(--text-4)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

function btnStyle(variant) {
  const isAccent = variant === 'accent'
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: isAccent ? 'none' : '1px solid var(--border-2)',
    background: isAccent ? 'var(--accent)' : 'var(--surface-2)',
    color: isAccent ? '#fff' : 'var(--text-1)',
    transition: 'all 0.15s ease',
  }
}

function Field({ label, required, hint, hintTone = 'muted', children }) {
  const toneColor = {
    muted: 'var(--text-4)',
    ok: '#4caf50',
    err: '#f44336'
  }[hintTone] || 'var(--text-4)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: toneColor }}>{hint}</span>}
    </div>
  )
}
