import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftRegular,
  CheckmarkRegular,
  PhoneRegular,
  LocationRegular,
  ClockRegular,
  OrganizationRegular,
  PersonRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import { REGIONS, getDistricts } from '../lib/uzLocations'

export default function OrganizationForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    organization_type: 'boshqa',
    region: '',
    district: '',
    village: '',
    phone: '',
    address: '',
    default_start_time: '09:00',
    default_end_time: '18:00',
    subscription_status: 'active',
  })

  const abortRef = useRef(null)

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      const typesPromise = fetch(`/api/organizations/types?lang=${i18n.language}`, { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; })
      const orgPromise = isEdit ? fetch(`/api/organizations/${id}?lang=${i18n.language}`, { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; }) : Promise.resolve(null)

      const [typesRes, orgRes] = await Promise.all([
        typesPromise,
        orgPromise,
      ])
      if (signal.aborted || !typesRes || (isEdit && !orgRes)) return

      const typesData = typesRes.ok ? await typesRes.json() : []
      setTypes(Array.isArray(typesData) ? typesData : [])

      if (isEdit && orgRes?.ok) {
        const org = await orgRes.json()
        setForm({
          name: org.name || '',
          organization_type: org.organization_type || 'boshqa',
          region: org.region || '',
          district: org.district || '',
          village: org.village || '',
          phone: org.phone || '',
          address: org.address || '',
          default_start_time: org.default_start_time || '09:00',
          default_end_time: org.default_end_time || '18:00',
          subscription_status: org.subscription_status || 'active',
        })
      } else if (isEdit && !orgRes?.ok) {
        toast.error(isRu ? 'Организация не найдена' : 'Tashkilot topilmadi')
        navigate('/organizations')
      }
    } catch (e) {
      if (e.name === 'AbortError') return
      toast.error(isRu ? 'Ошибка загрузки данных' : "Ma'lumot yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }, [id, isEdit, i18n.language, navigate, isRu, toast])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleRegionChange = (regionId) =>
    setForm(f => ({ ...f, region: regionId, district: '', village: '' }))

  const handleDistrictChange = (districtId) =>
    setForm(f => ({ ...f, district: districtId, village: '' }))

  const districts = getDistricts(form.region)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(isRu ? 'Название организации обязательно' : 'Tashkilot nomi majburiy')
      return
    }
    setSaving(true)
    try {
      const url = isEdit ? `/api/organizations/${id}` : '/api/organizations'
      const method = isEdit ? 'PUT' : 'POST'
      const body = {
        name: form.name.trim(),
        organization_type: form.organization_type,
        default_start_time: form.default_start_time,
        default_end_time: form.default_end_time,
        region: form.region || null,
        district: form.district || null,
        village: form.village.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ...(isEdit && { subscription_status: form.subscription_status }),
      }
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || `HTTP ${res.status}`)
      }
      toast.success(
        isEdit
          ? (isRu ? 'Организация обновлена' : 'Tashkilot yangilandi')
          : (isRu ? 'Организация добавлена' : "Tashkilot qo'shildi")
      )
      navigate('/organizations')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSkeleton />

  // ── Shared input style ──────────────────────────────
  const inp = {
    width: '100%', padding: '11px 14px', borderRadius: 9,
    border: '1.5px solid var(--border-2)', background: 'var(--bg)',
    color: 'var(--text-1)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.18s',
    fontFamily: 'inherit',
  }
  const inpDisabled = { ...inp, opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      background: 'var(--bg)',
      color: 'var(--text-1)',
    }}>
      {/* ── Hero ── */}
      <PageHero
        badge={isEdit ? (isRu ? '✦ Редактирование' : '✦ Tahrirlash') : (isRu ? '✦ Yangi' : '✦ Yangi')}
        title={isEdit
          ? (isRu ? 'Редактировать организацию' : 'Tashkilotni tahrirlash')
          : (isRu ? 'Добавить организацию' : "Yangi tashkilot qo'shish")
        }
        sub={isEdit
          ? (isRu ? 'Измените данные организации и сохраните' : "Ma'lumotlarni o'zgartiring va saqlang")
          : (isRu ? 'Введите данные новой организации' : "Yangi tashkilot ma'lumotlarini kiriting")
        }
        right={
          <button
            type="button"
            onClick={() => navigate('/organizations')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9,
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'Orqaga' : 'Orqaga'}
          </button>
        }
      />

      {/* ── Form wrapper ── */}
      <div className="org-form-container">
        <form onSubmit={handleSubmit}>

          {/* ═══ ROW 1: Asosiy + Joylashuv ═══ */}
          <div className="org-form-grid-2">

            {/* Card 1 — Asosiy ma'lumotlar */}
            <Card
              icon={<OrganizationRegular fontSize={18} />}
              title={isRu ? 'Asosiy ma\'lumotlar' : "Asosiy ma'lumotlar"}
            >
              <Field label={isRu ? 'Название организации' : 'Tashkilot nomi'} required>
                <input
                  id="org-name"
                  type="text"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder={isRu ? 'Например: Школа №10' : 'Masalan: 10-maktab'}
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-2)')}
                  required
                  autoFocus
                />
              </Field>

              <Field label={isRu ? 'Тип организации' : 'Tashkilot turi'} required>
                <select
                  id="org-type"
                  value={form.organization_type}
                  onChange={e => setField('organization_type', e.target.value)}
                  style={inp}
                >
                  {types.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <Field label={isRu ? 'Телефон организации' : 'Tashkilot telefon raqami'}>
                <div style={{ position: 'relative' }}>
                  <PhoneRegular
                    fontSize={14}
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }}
                  />
                  <input
                    id="org-phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    placeholder="+998 90 123 45 67"
                    style={{ ...inp, paddingLeft: 36 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-2)')}
                  />
                </div>
              </Field>
            </Card>

            {/* Card 2 — Joylashuv */}
            <Card
              icon={<LocationRegular fontSize={18} />}
              title={isRu ? 'Местоположение' : 'Joylashuv'}
            >
              {/* Viloyat */}
              <Field label={isRu ? 'Viloyat / Respublika' : 'Viloyat / Respublika'}>
                <select
                  id="org-region"
                  value={form.region}
                  onChange={e => handleRegionChange(e.target.value)}
                  style={inp}
                >
                  <option value="">{isRu ? '— Viloyatni tanlang —' : '— Viloyatni tanlang —'}</option>
                  {REGIONS.map(r => (
                    <option key={r.id} value={r.id}>{isRu ? r.ru : r.uz}</option>
                  ))}
                </select>
              </Field>

              {/* Tuman */}
              <Field label={isRu ? 'Tuman' : 'Tuman'}>
                <select
                  id="org-district"
                  value={form.district}
                  onChange={e => handleDistrictChange(e.target.value)}
                  style={form.region ? inp : inpDisabled}
                  disabled={!form.region}
                >
                  <option value="">
                    {!form.region
                      ? (isRu ? '— Avval viloyatni tanlang —' : '— Avval viloyatni tanlang —')
                      : (isRu ? '— Tumanni tanlang —' : '— Tumanni tanlang —')}
                  </option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{isRu ? d.ru : d.uz}</option>
                  ))}
                </select>
              </Field>

              {/* Qishloq / MFY */}
              <Field label={isRu ? "Qishloq / MFY / Ko'cha" : "Qishloq / MFY / Ko'cha"}>
                <input
                  id="org-village"
                  type="text"
                  value={form.village}
                  onChange={e => setField('village', e.target.value)}
                  placeholder={isRu ? "Yangiobod MFY, Navoiy ko'chasi 12" : "Yangiobod MFY, Navoiy ko'chasi 12"}
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-2)')}
                />
              </Field>

              {/* Preview */}
              {(form.region || form.district || form.village) && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '10px 14px', borderRadius: 8, marginTop: 2,
                  background: 'rgba(0,120,212,0.07)',
                  border: '1px solid rgba(0,120,212,0.18)',
                }}>
                  <LocationRegular fontSize={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {[
                      form.region && (isRu ? REGIONS.find(r => r.id === form.region)?.ru : REGIONS.find(r => r.id === form.region)?.uz),
                      form.district && (isRu ? districts.find(d => d.id === form.district)?.ru : districts.find(d => d.id === form.district)?.uz),
                      form.village || null,
                    ].filter(Boolean).join(' → ')}
                  </span>
                </div>
              )}
            </Card>
          </div>

          {/* ═══ ROW 2: Ish vaqti + Obuna holati ═══ */}
          <div className={isEdit ? "org-form-grid-2" : "org-form-grid-1"}>

            {/* Card 3 — Ish vaqti */}
            <Card
              icon={<ClockRegular fontSize={18} />}
              title={isRu ? 'Standart ish vaqti' : 'Standart ish vaqti'}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label={isRu ? 'Boshlanishi' : 'Boshlanishi'} required>
                  <input
                    id="org-start-time"
                    type="time"
                    value={form.default_start_time}
                    onChange={e => setField('default_start_time', e.target.value)}
                    style={inp}
                    required
                  />
                </Field>
                <Field label={isRu ? 'Tugashi' : 'Tugashi'} required>
                  <input
                    id="org-end-time"
                    type="time"
                    value={form.default_end_time}
                    onChange={e => setField('default_end_time', e.target.value)}
                    style={inp}
                    required
                  />
                </Field>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)', lineHeight: 1.5 }}>
                {isRu
                  ? 'Bu vaqt yangi xodimlar uchun standart qilib o\'rnatiladi'
                  : "Bu vaqt yangi xodimlar uchun standart qilib o'rnatiladi"}
              </p>
            </Card>

            {/* Card 4 — Obuna holati (faqat edit) */}
            {isEdit && (
              <Card
                icon={<PersonRegular fontSize={18} />}
                title={isRu ? 'Obuna holati' : 'Obuna holati'}
              >
                <Field label={isRu ? 'Joriy holat' : 'Joriy holat'}>
                  <select
                    id="org-sub-status"
                    value={form.subscription_status}
                    onChange={e => setField('subscription_status', e.target.value)}
                    style={inp}
                  >
                    <option value="active">{isRu ? 'Faol (Active)' : 'Faol'}</option>
                    <option value="pending">{isRu ? 'Kutilmoqda (Pending)' : 'Kutilmoqda'}</option>
                    <option value="expired">{isRu ? 'Muddati tugagan (Expired)' : 'Muddati tugagan'}</option>
                    <option value="inactive">{isRu ? 'Nofaol (Inactive)' : 'Nofaol'}</option>
                  </select>
                </Field>

                {/* Holat badge */}
                <div style={{ marginTop: 4 }}>
                  <StatusBadge status={form.subscription_status} isRu={isRu} />
                </div>
              </Card>
            )}
          </div>

          {/* ═══ Action buttons ═══ */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'flex-end',
            paddingTop: 4, borderTop: '1px solid var(--border-2)', paddingTop: 20,
          }}>
            <button
              type="button"
              onClick={() => navigate('/organizations')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '11px 24px', borderRadius: 9,
                background: 'var(--surface)', border: '1.5px solid var(--border-2)',
                color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {isRu ? 'Bekor qilish' : 'Bekor qilish'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 28px', borderRadius: 9,
                background: saving ? '#0060aa' : 'var(--accent)',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.8 : 1, transition: 'all 0.18s',
                boxShadow: saving ? 'none' : '0 2px 12px rgba(0,120,212,0.35)',
              }}
            >
              <CheckmarkRegular fontSize={17} />
              {saving
                ? (isRu ? 'Saqlanmoqda...' : 'Saqlanmoqda...')
                : isEdit
                  ? (isRu ? "O'zgarishlarni saqlash" : "O'zgarishlarni saqlash")
                  : (isRu ? "Tashkilot qo'shish" : "Tashkilot qo'shish")
              }
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .org-form-container {
          padding: 32px 32px 80px;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .org-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .org-form-grid-1 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 28px;
        }
        @media (max-width: 768px) {
          .org-form-container {
            padding: 16px 16px 60px;
          }
          .org-form-grid-2 {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Helper: Card ────────────────────────────────────────────────────────────

function Card({ icon, title, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1.5px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '15px 20px',
        borderBottom: '1.5px solid var(--border-2)',
        background: 'var(--surface-2)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'rgba(0,120,212,0.12)',
          border: '1.5px solid rgba(0,120,212,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)', flexShrink: 0,
        }}>
          {icon}
        </div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
          {title}
        </h3>
      </div>
      {/* Card body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Helper: Field ───────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{
        fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        {label}
        {required && <span style={{ color: '#f43f5e' }}>*</span>}
      </span>
      {children}
    </label>
  )
}

// ─── Helper: StatusBadge ─────────────────────────────────────────────────────

function StatusBadge({ status, isRu }) {
  const map = {
    active:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', text: 'Faol',              dot: '#10b981' },
    pending:  { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', text: 'Kutilmoqda',        dot: '#f59e0b' },
    expired:  { bg: 'rgba(244,63,94,0.1)',   color: '#f43f5e', text: 'Muddati tugagan',   dot: '#f43f5e' },
    inactive: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', text: 'Nofaol',            dot: '#64748b' },
  }
  const s = map[status] || map.inactive
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px', borderRadius: 8,
      background: s.bg, color: s.color,
      fontSize: 12.5, fontWeight: 600,
      border: `1px solid ${s.color}33`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.text}
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="org-form-container">
      <div className="org-form-grid-2">
        {[1, 2].map(i => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{ height: 64, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map(j => (
                <div key={j} style={{ height: 42, borderRadius: 8, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .org-form-container {
          padding: 32px 32px 80px;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .org-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 768px) {
          .org-form-container {
            padding: 16px 16px 60px;
          }
          .org-form-grid-2 {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  )
}
