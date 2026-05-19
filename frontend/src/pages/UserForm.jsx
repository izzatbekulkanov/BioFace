import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  CheckmarkRegular,
  EyeRegular,
  EyeOffRegular,
  ArrowLeftRegular,
  ImageRegular,
  DismissRegular,
  CheckmarkCircleRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

/**
 * Foydalanuvchini qo'shish / tahrirlash sahifasi (alohida sahifa, modal emas).
 *
 * Marshrutlar:
 *   /users/new        — yangi foydalanuvchi yaratish
 *   /users/:id/edit   — mavjud foydalanuvchini tahrirlash
 *
 * Bo'limlar:
 *   1. Shaxsiy ma'lumotlar  — Ism, Familiya, Otasining ismi
 *   2. Kirish ma'lumotlari   — Username (tekshirish bilan), Parol, Parolni tasdiqlash
 *   3. Kontakt va rol        — Email, Telefon, Rol, Status
 *   4. Tashkilot             — multi-select tashkilotlar
 *   5. Google OAuth          — toggle
 *   6. Avatar                — fayl yuklash + URL
 *
 * Backend:
 *   POST /api/users          (multipart/form-data)
 *   PUT  /api/users/{id}     (multipart/form-data)
 *   GET  /api/users          ro'yxatdan ma'lumot olish (tahrirlashda)
 *   GET  /api/organizations
 *   GET  /api/users/username/check?username=...
 */

const ROLES = [
  { value: 'super_admin',     label_uz: 'Asosiy Administrator', label_ru: 'Главный администратор' },
  { value: 'mahalla_admin',   label_uz: 'Mahalla Admini',       label_ru: 'Махаллинский админ' },
  { value: 'maktab_admin',    label_uz: 'Maktab Admini',        label_ru: 'Школьный админ' },
  { value: 'kollej_admin',    label_uz: 'Kollej Admini',        label_ru: 'Колледжский админ' },
  { value: 'tashkilot_admin', label_uz: 'Tashkilot Admini',     label_ru: 'Админ организации' },
  { value: 'korxona_admin',   label_uz: 'Korxona Admini',       label_ru: 'Админ предприятия' },
]

const STATUSES = [
  { value: 'active',   label_uz: 'Faol (Active)',          label_ru: 'Активен' },
  { value: 'pending',  label_uz: 'Kutilmoqda (Pending)',   label_ru: 'Ожидает' },
  { value: 'inactive', label_uz: 'Nofaol (Inactive)',      label_ru: 'Неактивен' },
]

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isEdit = Boolean(id)
  const toast = useToast()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState([])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    username: '',
    password: '',
    password_confirm: '',
    email: '',
    phone: '',
    role: 'tashkilot_admin',
    status: 'active',
    organization_ids: [],
    google_oauth_enabled: false,
    image_url: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [clearImage, setClearImage] = useState(false)

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: '' })
  const usernameCheckRef = useRef(0)

  // Password reveals
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  // Load orgs + (in edit mode) user data
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const orgRes = await fetch('/api/organizations', { credentials: 'include' })
        if (orgRes.ok) {
          const data = await orgRes.json()
          if (alive) setOrgs(Array.isArray(data) ? data : (data?.items || []))
        }
        if (isEdit) {
          // /api/users qaytaradi to'liq ro'yxatni — ichidan keraklisini tanlaymiz
          const uRes = await fetch('/api/users', { credentials: 'include' })
          if (uRes.ok) {
            const list = await uRes.json()
            const u = (Array.isArray(list) ? list : []).find(x => String(x.id) === String(id))
            if (u && alive) {
              setForm(prev => ({
                ...prev,
                first_name: u.first_name || '',
                last_name: u.last_name || '',
                middle_name: u.middle_name || '',
                username: u.name || '',
                email: u.email || '',
                phone: u.phone || '',
                role: ROLES.find(r => r.label_uz.includes(u.role) || r.value.toLowerCase() === String(u.role || '').toLowerCase())?.value
                  || mapBackendRole(u.role)
                  || 'tashkilot_admin',
                status: u.status || 'active',
                organization_ids: (u.organization_ids || []).map(String),
                google_oauth_enabled: !!u.google_oauth_enabled,
                image_url: u.image_url || '',
              }))
              setImagePreview(u.image_url || '')
            } else if (alive) {
              setError(isRu ? 'Пользователь не найден' : 'Foydalanuvchi topilmadi')
            }
          }
        }
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, isEdit, isRu])

  // Username live check
  useEffect(() => {
    const u = form.username.trim()
    if (!u) {
      setUsernameStatus({ checking: false, available: null, message: '' })
      return
    }
    if (u.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: isRu ? 'Минимум 3 символа' : "Kamida 3 ta belgi" })
      return
    }
    const ticket = ++usernameCheckRef.current
    setUsernameStatus(prev => ({ ...prev, checking: true }))
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ username: u })
        if (isEdit && id) params.set('exclude_user_id', String(id))
        const res = await fetch(`/api/users/username/check?${params}`, { credentials: 'include' })
        const data = res.ok ? await res.json() : { available: false, message: `HTTP ${res.status}` }
        if (ticket === usernameCheckRef.current) {
          setUsernameStatus({ checking: false, available: !!data.available, message: data.message || '' })
        }
      } catch (e) {
        if (ticket === usernameCheckRef.current) {
          setUsernameStatus({ checking: false, available: null, message: e.message })
        }
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [form.username, isEdit, id, isRu])

  const setField = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [k]: v }))
  }

  const toggleOrg = (orgId) => {
    setForm(prev => {
      const sid = String(orgId)
      const has = prev.organization_ids.includes(sid)
      return { ...prev, organization_ids: has ? prev.organization_ids.filter(x => x !== sid) : [...prev.organization_ids, sid] }
    })
  }

  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setClearImage(false)
  }

  const onClearImage = () => {
    setImageFile(null)
    setImagePreview('')
    setForm(prev => ({ ...prev, image_url: '' }))
    if (isEdit) setClearImage(true)
  }

  const validate = () => {
    if (!form.first_name.trim()) return isRu ? 'Имя обязательно' : 'Ism majburiy'
    if (!form.username.trim()) return 'Username majburiy'
    if (usernameStatus.available === false) return usernameStatus.message || (isRu ? 'Username недоступен' : "Username band")
    if (!form.email.trim()) return 'Email majburiy'
    if (!isEdit && !form.password.trim()) return isRu ? 'Пароль обязателен' : 'Parol majburiy'
    if (form.password.trim() && form.password !== form.password_confirm) {
      return isRu ? 'Пароли не совпадают' : 'Parollar mos kelmaydi'
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }
    setError('')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      fd.set('middle_name', form.middle_name.trim())
      fd.set('username', form.username.trim())
      fd.set('email', form.email.trim())
      fd.set('phone', form.phone.trim())
      if (form.password.trim()) fd.set('password', form.password.trim())
      fd.set('role', form.role)
      fd.set('status', form.status)
      fd.set('google_oauth_enabled', form.google_oauth_enabled ? '1' : '0')
      const orgIds = form.organization_ids.map(Number).filter(Boolean)
      if (orgIds.length) {
        fd.set('organization_ids', orgIds.join(','))
        fd.set('organization_id', String(orgIds[0]))
      } else {
        fd.set('organization_ids', '')
      }
      if (imageFile) {
        fd.set('image', imageFile)
      } else if (form.image_url.trim()) {
        fd.set('image_url', form.image_url.trim())
      }
      if (isEdit && clearImage && !imageFile) fd.set('clear_image', '1')

      const url = isEdit ? `/api/users/${id}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, credentials: 'include', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      toast.success(isEdit
        ? (isRu ? 'Пользователь обновлён' : 'Foydalanuvchi yangilandi')
        : (isRu ? 'Пользователь создан' : 'Foydalanuvchi yaratildi'))
      navigate('/users')
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
          title={isEdit ? (isRu ? 'Редактировать пользователя' : 'Foydalanuvchini tahrirlash') : (isRu ? 'Новый пользователь' : 'Yangi foydalanuvchi')}
          backPath="/users"
        />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
          <div style={cardStyle}>
            <Skeleton width={140} height={14} />
            <div style={{ marginTop: 14 }}><Skeleton.Stats count={6} /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isEdit ? (isRu ? '✦ Редактирование' : '✦ Tahrirlash') : (isRu ? '✦ Новый пользователь' : '✦ Yangi foydalanuvchi')}
        title={isEdit ? (isRu ? 'Редактировать пользователя' : 'Foydalanuvchini tahrirlash') : (isRu ? 'Новый пользователь' : 'Yangi foydalanuvchi')}
        sub={isRu
          ? 'Заполните данные системного пользователя'
          : "Tizim foydalanuvchisi ma'lumotlarini to'ldiring"}
        backPath="/users"
        right={
          <button
            type="button"
            onClick={() => navigate('/users')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'К списку' : "Ro'yxatga"}
          </button>
        }
      />

      <form onSubmit={onSubmit} style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={errBannerStyle}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Shaxsiy ma'lumotlar */}
            <Section
              kicker={isRu ? 'Личные данные' : "Shaxsiy ma'lumotlar"}
              title={isRu ? 'Имя пользователя' : "Foydalanuvchi ma'lumotlari"}
            >
              <div style={grid3}>
                <Field label={isRu ? 'Имя' : 'Ism'} required>
                  <input value={form.first_name} onChange={setField('first_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Фамилия' : 'Familiya'}>
                  <input value={form.last_name} onChange={setField('last_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                  <input value={form.middle_name} onChange={setField('middle_name')} style={inpStyle} />
                </Field>
              </div>
            </Section>

            {/* 2. Kirish ma'lumotlari */}
            <Section
              kicker={isRu ? 'Учётные данные' : "Kirish ma'lumotlari"}
              title={isRu ? 'Логин, пароль' : 'Login, parol'}
            >
              <div style={grid3}>
                <Field label="Username" required hint={
                  usernameStatus.message ||
                  (isRu ? 'Должно быть уникальным в системе' : "Tizimda yagona bo'lishi kerak")
                } hintTone={usernameStatus.checking ? 'muted' : (usernameStatus.available === true ? 'ok' : usernameStatus.available === false ? 'err' : 'muted')}>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={form.username}
                      onChange={setField('username')}
                      style={{ ...inpStyle, paddingRight: 36 }}
                      placeholder="username"
                      autoComplete="username"
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      {usernameStatus.checking
                        ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                        : usernameStatus.available === true
                          ? <CheckmarkCircleRegular fontSize={16} style={{ color: '#10b981' }} />
                          : usernameStatus.available === false
                            ? <WarningRegular fontSize={14} style={{ color: '#f43f5e' }} />
                            : null}
                    </span>
                  </div>
                </Field>

                <Field
                  label={isRu ? 'Пароль' : 'Parol'}
                  required={!isEdit}
                  hint={isEdit
                    ? (isRu ? 'Оставьте пустым, чтобы не менять' : "O'zgartirmaslik uchun bo'sh qoldiring")
                    : (isRu ? 'Минимум 8 символов, 1 буква и 1 цифра' : "Kamida 8 ta belgi, 1 harf va 1 raqam")}
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
                  label={isRu ? 'Подтверждение пароля' : 'Parol tasdiqlash'}
                  required={!isEdit}
                  hint={isRu ? 'Должен совпадать с паролем' : "Parol bilan bir xil bo'lishi kerak"}
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
            </Section>

            {/* 3. Kontakt va rol */}
            <Section
              kicker={isRu ? 'Контакты и роль' : 'Kontakt va rol'}
              title={isRu ? 'Email, роль, статус' : 'Email, rol, status'}
            >
              <div style={grid2}>
                <Field label="Email" required>
                  <input type="email" value={form.email} onChange={setField('email')} style={inpStyle} placeholder="user@example.com" />
                </Field>
                <Field label={isRu ? 'Телефон' : 'Telefon'}>
                  <input value={form.phone} onChange={setField('phone')} style={inpStyle} placeholder="+998..." />
                </Field>
                <Field label={isRu ? 'Роль' : 'Huquqi'} required>
                  <select value={form.role} onChange={setField('role')} style={inpStyle}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{isRu ? r.label_ru : r.label_uz}</option>)}
                  </select>
                </Field>
                <Field label="Status" required>
                  <select value={form.status} onChange={setField('status')} style={inpStyle}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{isRu ? s.label_ru : s.label_uz}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            {/* 4. Tashkilot */}
            <Section
              kicker={isRu ? 'Организация' : 'Tashkilot'}
              title={isRu ? 'Доступ к организациям' : 'Tashkilotlarga ruxsat'}
              hint={isRu ? 'Можно выбрать несколько организаций' : "Bir nechta tashkilot tanlanishi mumkin"}
            >
              {orgs.length === 0 ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                  {isRu ? 'Сначала создайте организацию' : "Avval tashkilot yarating"}
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8, maxHeight: 260, overflowY: 'auto',
                  padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  {orgs.map(o => {
                    const checked = form.organization_ids.includes(String(o.id))
                    return (
                      <label key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 7,
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                        cursor: 'pointer', fontSize: 13,
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOrg(o.id)} style={{ accentColor: 'var(--accent)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </Section>

            {/* 5. Google OAuth */}
            <Section
              kicker="Google"
              title="Google OAuth"
            >
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid var(--border-2)', background: 'var(--bg)',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--surface-2)', color: 'var(--text-1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 14, flexShrink: 0,
                  }}>G</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Google OAuth</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                      {isRu ? 'Разрешить вход через Google' : "Google orqali kirish ruxsati"}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.google_oauth_enabled}
                  onChange={setField('google_oauth_enabled')}
                  style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                />
              </label>
            </Section>
          </div>

          {/* SIDE COLUMN — Avatar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section
              kicker="Avatar"
              title={isRu ? 'Фотография' : 'Rasm'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 140, height: 140, borderRadius: '50%',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImagePreview('')} />
                    : <PersonRegular fontSize={48} style={{ color: 'var(--text-4)' }} />}
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                  border: '1px solid var(--accent-bd)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
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

              <div style={{ marginTop: 14 }}>
                <Field label={isRu ? 'URL изображения' : 'Rasm URL'} hint={isRu ? 'Ixtiyoriy' : 'Ixtiyoriy'}>
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
            </Section>
          </aside>
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button type="button" onClick={() => navigate('/users')} disabled={saving} style={btnStyle('subtle')}>
            {isRu ? 'Отмена' : 'Bekor qilish'}
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
// Helpers and styles
// ────────────────────────────────────────────────────────────────────────────

function mapBackendRole(role) {
  // backend ".name" qaytaradi (e.g. SuperAdmin), biz value sifatida "super_admin" kerak
  const map = {
    SuperAdmin: 'super_admin',
    MahallaAdmin: 'mahalla_admin',
    MaktabAdmin: 'maktab_admin',
    KollejAdmin: 'kollej_admin',
    TashkilotAdmin: 'tashkilot_admin',
    KorxonaAdmin: 'korxona_admin',
  }
  return map[role] || null
}

function Section({ kicker, title, hint, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)',
          textTransform: 'uppercase', letterSpacing: 0.7,
        }}>{kicker}</div>
        <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{title}</h2>
        {hint && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-4)' }}>{hint}</div>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, hintTone = 'muted', required, children }) {
  const hintColor = hintTone === 'ok' ? '#10b981' : hintTone === 'err' ? '#f43f5e' : 'var(--text-4)'
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: hintColor }}>{hint}</span>}
    </label>
  )
}

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const errBannerStyle = { marginBottom: 18, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
const inpStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const eyeBtn = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none',
  color: 'var(--text-3)', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center',
}

function btnStyle(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 8,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }
}
