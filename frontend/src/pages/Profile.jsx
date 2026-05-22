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
  BuildingRegular,
  CameraRegular,
  ClockRegular,
  GlobeRegular,
  Wifi4Regular,
  WifiOffRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  InfoRegular,
  SearchRegular,
  ChevronDownRegular,
  ChevronUpRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

const TABS = ['profile', 'organizations', 'logs', 'sessions']

export default function Profile() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [dashboard, setDashboard] = useState(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', middle_name: '',
    email: '', phone: '', password: '', password_confirm: '', image_url: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [clearImage, setClearImage] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [expandedOrg, setExpandedOrg] = useState({})

  const currentUser = dashboard?.user

  useEffect(() => {
    fetch('/api/profile/dashboard', { credentials: 'include' })
      .then(r => { if (r.ok) return r.json(); throw new Error('Not authenticated') })
      .then(data => {
        setDashboard(data)
        const u = data.user
        setForm({
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          middle_name: u.middle_name || '',
          email: u.email || '',
          phone: u.phone || '',
          password: '', password_confirm: '',
          image_url: u.image_url || '',
        })
        if (u.image_url) setImagePreview(u.image_url)
        setLoading(false)
      })
      .catch(() => {
        toast.error(isRu ? 'Авторизуйтесь для просмотра профиля' : 'Profilni ko\'rish uchun tizimga kiring')
        navigate('/login')
      })
  }, [])

  const setField = k => e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(p => ({ ...p, [k]: v }))
  }

  const onPickImage = e => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0]
      setImageFile(f)
      setImagePreview(URL.createObjectURL(f))
      setClearImage(false)
    }
  }

  const onClearImage = () => {
    setImageFile(null); setImagePreview(''); setClearImage(true)
    setForm(p => ({ ...p, image_url: '' }))
  }

  const validate = () => {
    if (!form.first_name.trim()) return isRu ? 'Имя обязательно' : 'Ism kiritilishi shart'
    if (!form.email.trim()) return isRu ? 'Email обязателен' : 'Email kiritilishi shart'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return isRu ? 'Некорректный email' : 'Email noto\'g\'ri'
    if (form.password.trim()) {
      if (form.password.length < 6) return isRu ? 'Пароль мин. 6 символов' : 'Parol kamida 6 ta belgi'
      if (form.password !== form.password_confirm) return isRu ? 'Пароли не совпадают' : 'Parollar mos kelmadi'
    }
    return ''
  }

  const onSubmit = async e => {
    e.preventDefault()
    const errText = validate()
    if (errText) { setError(errText); toast.error(errText); return }
    setError(''); setSaving(true)
    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      fd.set('middle_name', form.middle_name.trim())
      fd.set('email', form.email.trim())
      fd.set('phone', form.phone.trim())
      if (form.password.trim()) fd.set('password', form.password.trim())
      if (imageFile) fd.set('image', imageFile)
      else if (form.image_url.trim()) fd.set('image_url', form.image_url.trim())
      if (clearImage && !imageFile) fd.set('clear_image', '1')

      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT', credentials: 'include', body: fd
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`)
      }
      toast.success(isRu ? 'Профиль обновлён' : 'Profil yangilandi')
      window.dispatchEvent(new Event('user-profile-updated'))
      const refreshRes = await fetch('/api/profile/dashboard', { credentials: 'include' })
      if (refreshRes.ok) { const d = await refreshRes.json(); setDashboard(d) }
    } catch (err) {
      setError(err.message); toast.error(err.message)
    } finally { setSaving(false) }
  }

  const toggleOrg = id => setExpandedOrg(p => ({ ...p, [id]: !p[id] }))

  const tabLabels = {
    profile:       isRu ? 'Профиль'         : 'Profil',
    organizations: isRu ? 'Организации'     : 'Tashkilotlar',
    logs:          isRu ? 'Журнал активности': 'Faollik jurnali',
    sessions:      isRu ? 'Сеансы'          : 'Seanslar',
  }

  const tabIcons = {
    profile:       <PersonRegular fontSize={16} />,
    organizations: <BuildingRegular fontSize={16} />,
    logs:          <SearchRegular fontSize={16} />,
    sessions:      <GlobeRegular fontSize={16} />,
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <PageHero badge="✦" title={isRu ? 'Мой профиль' : 'Mening profilim'} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          <div style={card}><Skeleton width={160} height={14} /><div style={{ marginTop: 16 }}><Skeleton.Stats count={6} /></div></div>
        </div>
      </div>
    )
  }

  const stats = dashboard?.stats || {}

  return (
    <div style={pageWrap}>
      <style>{`
        .prof-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .prof-tab-nav {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 4px;
          width: fit-content;
          max-width: 100%;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
        }
        .prof-main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }
        .prof-inner-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .prof-readonly-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .prof-password-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .prof-org-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          cursor: pointer;
        }
        .prof-cameras-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }
        .prof-camera-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .prof-session-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .prof-account-info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        @media (max-width: 900px) {
          .prof-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .prof-main-grid {
            grid-template-columns: 1fr;
          }
          .prof-account-info-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .prof-org-header {
            flex-wrap: wrap;
          }
          .prof-org-header-right {
            width: 100%;
            margin-top: 12px;
            justify-content: space-between;
            border-top: 1px dashed var(--border-2);
            padding-top: 12px;
          }
        }

        @media (max-width: 600px) {
          .prof-stats-grid {
            grid-template-columns: 1fr;
          }
          .prof-inner-grid {
            grid-template-columns: 1fr;
          }
          .prof-readonly-grid {
            grid-template-columns: 1fr;
          }
          .prof-password-grid {
            grid-template-columns: 1fr;
          }
          .prof-cameras-grid {
            grid-template-columns: 1fr;
          }
          .prof-camera-details-grid {
            grid-template-columns: 1fr;
          }
          .prof-session-details-grid {
            grid-template-columns: 1fr;
          }
          .prof-account-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <PageHero
        badge={isRu ? '✦ Профиль' : '✦ Profil'}
        title={isRu ? 'Личный кабинет' : 'Shaxsiy kabinet'}
        sub={isRu ? 'Полная информация о вашем аккаунте' : 'Hisobingiz haqida to\'liq ma\'lumot'}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Stats bar ── */}
        <div className="prof-stats-grid">
          {[
            { icon: <BuildingRegular fontSize={22} />, val: stats.total_organizations ?? 0, label: isRu ? 'Организаций' : 'Tashkilotlar', color: '#6366f1' },
            { icon: <CameraRegular fontSize={22} />, val: stats.total_cameras ?? 0, label: isRu ? 'Камер всего' : 'Jami kameralar', color: '#0ea5e9' },
            { icon: <Wifi4Regular fontSize={22} />, val: stats.online_cameras ?? 0, label: isRu ? 'Онлайн' : 'Onlayn', color: '#22c55e' },
            { icon: <SearchRegular fontSize={22} />, val: stats.total_logs ?? 0, label: isRu ? 'Запросов' : 'So\'rovlar', color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} style={{ ...card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + '1a', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab Nav ── */}
        <div className="prof-tab-nav">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
              borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              transition: 'all 0.18s',
              background: activeTab === t ? 'var(--accent)' : 'transparent',
              color: activeTab === t ? '#fff' : 'var(--text-2)',
            }}>
              {tabIcons[t]} {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ══════════════════════════ TAB: PROFILE ══════════════════════════ */}
        {activeTab === 'profile' && (
          <form onSubmit={onSubmit}>
            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div className="prof-main-grid">
              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Main info */}
                <div style={card}>
                  <SectionHeader icon={<PersonRegular fontSize={18} />} title={isRu ? 'Основные сведения' : 'Asosiy ma\'lumotlar'} />
                  <div className="prof-inner-grid">
                    <Field label={isRu ? 'Имя' : 'Ism'} required>
                      <input type="text" value={form.first_name} onChange={setField('first_name')} style={inp} placeholder={isRu ? 'Введите имя' : 'Ismni kiriting'} />
                    </Field>
                    <Field label={isRu ? 'Фамилия' : 'Familiya'}>
                      <input type="text" value={form.last_name} onChange={setField('last_name')} style={inp} placeholder={isRu ? 'Введите фамилию' : 'Familiyani kiriting'} />
                    </Field>
                    <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                      <input type="text" value={form.middle_name} onChange={setField('middle_name')} style={inp} placeholder={isRu ? 'Введите отчество' : 'Otasining ismini kiriting'} />
                    </Field>
                    <Field label={isRu ? 'Роль' : 'Rol'}>
                      <div style={{ ...inp, background: 'var(--surface-2)', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'not-allowed' }}>
                        <ShieldRegular fontSize={14} /> <span>{currentUser.role || '—'}</span>
                      </div>
                    </Field>
                    <Field label="Email" required>
                      <div style={{ position: 'relative' }}>
                        <input type="email" value={form.email} onChange={setField('email')} style={{ ...inp, paddingLeft: 36 }} placeholder="user@example.com" />
                        <MailRegular fontSize={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-4)' }} />
                      </div>
                    </Field>
                    <Field label={isRu ? 'Телефон' : 'Telefon'}>
                      <div style={{ position: 'relative' }}>
                        <input type="text" value={form.phone} onChange={setField('phone')} style={{ ...inp, paddingLeft: 36 }} placeholder="+998..." />
                        <PhoneRegular fontSize={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-4)' }} />
                      </div>
                    </Field>
                  </div>

                  {/* Read-only info */}
                  <div className="prof-readonly-grid">
                    {[
                      { label: isRu ? 'Статус аккаунта' : 'Hisob holati', val: currentUser.status || 'active', ok: currentUser.status === 'active' },
                      { label: isRu ? 'Метод входа' : 'Kirish usuli', val: currentUser.last_login_provider === 'google' ? 'Google OAuth' : 'Parol', icon: currentUser.last_login_provider === 'google' ? '🔵' : '🔑' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: item.ok === false ? 'var(--red)' : item.ok ? '#22c55e' : 'var(--text-1)' }}>
                          {item.icon && <span>{item.icon}</span>}
                          {item.ok !== undefined && (item.ok ? <CheckmarkCircleRegular fontSize={14} /> : <DismissCircleRegular fontSize={14} />)}
                          {item.val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Password */}
                <div style={card}>
                  <SectionHeader icon={<LockClosedRegular fontSize={18} />} title={isRu ? 'Изменить пароль' : 'Parolni o\'zgartirish'} />
                  <div className="prof-password-grid">
                    <Field label={isRu ? 'Новый пароль' : 'Yangi parol'} hint={isRu ? 'Оставьте пустым, чтобы не менять' : 'O\'zgartirmaslik uchun bo\'sh qoldiring'}>
                      <div style={{ position: 'relative' }}>
                        <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={setField('password')} style={{ ...inp, paddingRight: 36 }} autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPwd(s => !s)} style={eyeBtn}>
                          {showPwd ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                        </button>
                      </div>
                    </Field>
                    <Field
                      label={isRu ? 'Подтверждение' : 'Tasdiqlash'}
                      hintTone={form.password_confirm && form.password === form.password_confirm ? 'ok' : form.password_confirm ? 'err' : 'muted'}
                      hint={isRu ? 'Повторите новый пароль' : 'Yangi parolni takrorlang'}
                    >
                      <div style={{ position: 'relative' }}>
                        <input type={showPwd2 ? 'text' : 'password'} value={form.password_confirm} onChange={setField('password_confirm')} style={{ ...inp, paddingRight: 36 }} autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPwd2(s => !s)} style={eyeBtn}>
                          {showPwd2 ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Avatar */}
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Avatar</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--surface-2)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                      {imagePreview
                        ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImagePreview('')} />
                        : <PersonRegular fontSize={44} style={{ color: 'var(--text-4)' }} />}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent-tx)', border: '1px solid var(--accent-bd)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <ImageRegular fontSize={13} />{isRu ? 'Выбрать фото' : 'Rasm tanlash'}
                      <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
                    </label>
                    {imagePreview && (
                      <button type="button" onClick={onClearImage} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, background: 'transparent', color: 'var(--red)', border: '1px solid var(--red-bd)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <DismissRegular fontSize={12} />{isRu ? 'Удалить' : 'O\'chirish'}
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Field label={isRu ? 'URL изображения' : 'Rasm URL'}>
                      <input value={form.image_url} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, image_url: v })); if (!imageFile) setImagePreview(v) }} style={inp} placeholder="https://..." />
                    </Field>
                  </div>
                </div>

                {/* Google OAuth */}
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Integratsiya</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-2)', background: 'var(--bg)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: currentUser.google_oauth_enabled ? 'rgba(76,175,80,0.15)' : 'var(--surface-2)', color: currentUser.google_oauth_enabled ? '#4caf50' : 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, border: currentUser.google_oauth_enabled ? '1px solid rgba(76,175,80,0.3)' : '1px solid var(--border-2)' }}>G</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Google OAuth</div>
                      <div style={{ fontSize: 11, color: currentUser.google_oauth_enabled ? '#4caf50' : 'var(--text-4)', marginTop: 2, fontWeight: 500 }}>
                        {currentUser.google_oauth_enabled ? (isRu ? 'Активна' : 'Faol') : (isRu ? 'Отключена' : 'Faol emas')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organization badge */}
                {dashboard?.organizations?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{isRu ? 'Основная организация' : 'Asosiy tashkilot'}</div>
                    {dashboard.organizations.filter(o => o.is_primary).slice(0, 1).map(org => (
                      <div key={org.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border-2)' }}>
                        <BuildingRegular fontSize={20} style={{ color: '#6366f1', marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{org.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{org.organization_type}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <Chip color={org.subscription_status === 'active' ? '#22c55e' : '#f59e0b'}>
                              {org.subscription_status}
                            </Chip>
                            <Chip color="#0ea5e9">{org.cameras.length} {isRu ? 'камер' : 'kamera'}</Chip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => navigate('/dashboard')} disabled={saving} style={btn('subtle')}>{isRu ? 'Назад' : 'Orqaga'}</button>
              <button type="submit" disabled={saving} style={btn('accent')}>
                {saving ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckmarkRegular fontSize={14} />}
                {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Сохранить' : 'Saqlash')}
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════ TAB: ORGANIZATIONS ══════════════════════════ */}
        {activeTab === 'organizations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!dashboard?.organizations?.length ? (
              <EmptyState icon={<BuildingRegular fontSize={48} />} label={isRu ? 'Вы не привязаны ни к одной организации' : 'Hech qanday tashkilotga biriktirilmagansiz'} />
            ) : dashboard.organizations.map(org => (
              <div key={org.id} style={card}>
                {/* Org header */}
                <div className="prof-org-header" onClick={() => toggleOrg(org.id)}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BuildingRegular fontSize={22} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{org.name}</span>
                      {org.is_primary && <Chip color="#6366f1">{isRu ? 'Основная' : 'Asosiy'}</Chip>}
                      <Chip color={org.subscription_status === 'active' ? '#22c55e' : '#f59e0b'}>{org.subscription_status}</Chip>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                      {[
                        { icon: <InfoRegular fontSize={13} />, val: org.organization_type },
                        org.address && { icon: <GlobeRegular fontSize={13} />, val: org.address },
                        org.phone && { icon: <PhoneRegular fontSize={13} />, val: org.phone },
                      ].filter(Boolean).map((it, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-4)' }}>{it.icon}{it.val}</span>
                      ))}
                    </div>
                  </div>
                  <div className="prof-org-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatPill label={isRu ? 'Камер' : 'Kamera'} val={org.cameras.length} color="#0ea5e9" />
                      <StatPill label={isRu ? 'Онлайн' : 'Onlayn'} val={org.cameras.filter(c => c.is_online).length} color="#22c55e" />
                    </div>
                    {expandedOrg[org.id] ? <ChevronUpRegular fontSize={16} style={{ color: 'var(--text-4)' }} /> : <ChevronDownRegular fontSize={16} style={{ color: 'var(--text-4)' }} />}
                  </div>
                </div>

                {/* Cameras list */}
                {expandedOrg[org.id] && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CameraRegular fontSize={14} />{isRu ? 'Камеры' : 'Kameralar'} ({org.cameras.length})
                    </div>
                    {!org.cameras.length ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-4)', fontSize: 13 }}>
                        {isRu ? 'Нет камер' : 'Kamera yo\'q'}
                      </div>
                    ) : (
                      <div className="prof-cameras-grid">
                        {org.cameras.map(cam => (
                          <div key={cam.id} style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: cam.is_online ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {cam.is_online
                                  ? <Wifi4Regular fontSize={18} style={{ color: '#22c55e' }} />
                                  : <WifiOffRegular fontSize={18} style={{ color: 'var(--text-4)' }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cam.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                                  <span style={{ color: cam.is_online ? '#22c55e' : 'var(--text-4)', fontWeight: 600 }}>● {cam.is_online ? (isRu ? 'Онлайн' : 'Onlayn') : (isRu ? 'Офлайн' : 'Oflayn')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="prof-camera-details-grid">
                              {[
                                { k: isRu ? 'Модель' : 'Model', v: cam.model || '—' },
                                { k: isRu ? 'Направление' : 'Yo\'nalish', v: cam.direction || '—' },
                                { k: 'MAC', v: cam.mac_address },
                                { k: isRu ? 'Серийный' : 'Serial', v: cam.serial_number || '—' },
                                { k: 'IP', v: cam.external_ip || '—' },
                                { k: isRu ? 'Местонахождение' : 'Joylashuv', v: cam.location || '—' },
                              ].map((row, i) => (
                                <div key={i} style={{ background: 'var(--surface)', borderRadius: 6, padding: '5px 8px' }}>
                                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>{row.k}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-1)', fontWeight: 600, marginTop: 1, wordBreak: 'break-all' }}>{row.v}</div>
                                </div>
                              ))}
                            </div>
                            {/* Memory bar */}
                            <div style={{ marginTop: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-4)', marginBottom: 4 }}>
                                <span>{isRu ? 'Использовано лиц' : 'Yuzlar'}: {cam.used_faces}/{cam.max_memory}</span>
                                <span>{Math.round((cam.used_faces / cam.max_memory) * 100)}%</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--border-2)', borderRadius: 2 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, (cam.used_faces / cam.max_memory) * 100)}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
                              </div>
                            </div>
                            {cam.last_seen_at && (
                              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ClockRegular fontSize={11} />{isRu ? 'Последний сигнал' : 'Oxirgi signal'}: {new Date(cam.last_seen_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════ TAB: LOGS ══════════════════════════ */}
        {activeTab === 'logs' && (
          <div style={card}>
            <SectionHeader icon={<SearchRegular fontSize={18} />} title={isRu ? 'Журнал запросов (последние 100)' : "So'rovlar jurnali (so'nggi 100 ta)"} />
            {!dashboard?.activity_logs?.length ? (
              <EmptyState icon={<SearchRegular fontSize={48} />} label={isRu ? 'Записей нет' : 'Yozuvlar yo\'q'} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['#', isRu ? 'Метод' : 'Metod', 'URL', isRu ? 'Статус' : 'Status', 'IP', isRu ? 'Время (мс)' : 'Vaqt (ms)', isRu ? 'Дата' : 'Sana'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-4)', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.activity_logs.map((log, i) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-4)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ ...methodBadge(log.method) }}>{log.method}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-2)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.url}>{log.url}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: statusColor(log.status_code), fontWeight: 700 }}>{log.status_code}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11 }}>{log.client_ip}</td>
                        <td style={{ padding: '8px 12px', color: log.response_time_ms > 500 ? '#f59e0b' : 'var(--text-3)' }}>{log.response_time_ms}ms</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-4)', whiteSpace: 'nowrap' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════ TAB: SESSIONS ══════════════════════════ */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card}>
              <SectionHeader icon={<GlobeRegular fontSize={18} />} title={isRu ? 'Активные сеансы' : 'Faol seanslar'} />
              {(dashboard?.sessions || []).map((sess, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px', borderRadius: 10, background: sess.current ? 'rgba(99,102,241,0.06)' : 'var(--bg)', border: `1px solid ${sess.current ? 'rgba(99,102,241,0.3)' : 'var(--border-2)'}`, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: sess.current ? 'rgba(99,102,241,0.15)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GlobeRegular fontSize={20} style={{ color: sess.current ? '#6366f1' : 'var(--text-4)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{isRu ? 'Текущий сеанс' : 'Joriy seans'}</span>
                      {sess.current && <Chip color="#22c55e">{isRu ? 'Активен' : 'Faol'}</Chip>}
                    </div>
                    <div className="prof-session-details-grid">
                      {[
                        { label: 'IP', val: sess.ip, icon: <GlobeRegular fontSize={12} /> },
                        { label: isRu ? 'Провайдер входа' : 'Kirish usuli', val: sess.login_provider, icon: <ShieldRegular fontSize={12} /> },
                        { label: 'User Agent', val: sess.user_agent?.substring(0, 60) + (sess.user_agent?.length > 60 ? '...' : ''), icon: <GlobeRegular fontSize={12} /> },
                        { label: isRu ? 'Статус' : 'Holat', val: isRu ? 'Авторизован' : 'Kirgan', icon: <CheckmarkCircleRegular fontSize={12} /> },
                      ].map((row, j) => (
                        <div key={j} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-4)', fontWeight: 600, marginBottom: 3 }}>{row.icon}{row.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 600, wordBreak: 'break-all' }}>{row.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Account info */}
            <div style={card}>
              <SectionHeader icon={<ShieldRegular fontSize={18} />} title={isRu ? 'Информация об аккаунте' : 'Hisob ma\'lumotlari'} />
              <div className="prof-account-info-grid">
                {[
                  { label: 'ID', val: `#${currentUser.id}`, icon: '🆔' },
                  { label: isRu ? 'Роль' : 'Rol', val: currentUser.role || '—', icon: '🛡️' },
                  { label: isRu ? 'Статус' : 'Holat', val: currentUser.status || 'active', icon: currentUser.status === 'active' ? '✅' : '⛔' },
                  { label: 'Email', val: currentUser.email, icon: '📧' },
                  { label: isRu ? 'Телефон' : 'Telefon', val: currentUser.phone || '—', icon: '📱' },
                  { label: 'Google OAuth', val: currentUser.google_oauth_enabled ? (isRu ? 'Включён' : 'Yoqilgan') : (isRu ? 'Выключен' : 'O\'chirilgan'), icon: '🔵' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border-2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginBottom: 4 }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', wordBreak: 'break-all' }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border-2)' }}>
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
    </div>
  )
}

function Chip({ color, children }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: color + '18', color: color, border: `1px solid ${color}40` }}>{children}</span>
  )
}

function StatPill({ label, val, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 12px', borderRadius: 8, background: color + '12', border: `1px solid ${color}30` }}>
      <span style={{ fontSize: 16, fontWeight: 800, color }}>{val}</span>
      <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function EmptyState({ icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12, color: 'var(--text-4)' }}>
      {icon}
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function Field({ label, required, hint, hintTone = 'muted', children }) {
  const toneColor = { muted: 'var(--text-4)', ok: '#22c55e', err: '#f44336' }[hintTone]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: toneColor }}>{hint}</span>}
    </div>
  )
}

function statusColor(code) {
  if (!code) return 'var(--text-4)'
  if (code < 300) return '#22c55e'
  if (code < 400) return '#0ea5e9'
  if (code < 500) return '#f59e0b'
  return '#ef4444'
}

function methodBadge(method) {
  const colors = { GET: '#22c55e', POST: '#0ea5e9', PUT: '#f59e0b', DELETE: '#ef4444', PATCH: '#a855f7' }
  const c = colors[method] || '#6b7280'
  return { display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 800, background: c + '18', color: c, border: `1px solid ${c}30`, fontFamily: 'monospace' }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageWrap = { minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 24,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
}

const inp = {
  width: '100%', padding: '9px 13px', borderRadius: 8,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const eyeBtn = {
  position: 'absolute', right: 0, top: 0, bottom: 0, width: 36,
  border: 'none', background: 'transparent', color: 'var(--text-4)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function btn(variant) {
  const accent = variant === 'accent'
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: accent ? 'none' : '1px solid var(--border-2)',
    background: accent ? 'var(--accent)' : 'var(--surface-2)',
    color: accent ? '#fff' : 'var(--text-1)',
    transition: 'all 0.15s',
  }
}
