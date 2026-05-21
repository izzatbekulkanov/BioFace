import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PersonRegular,
  ArrowSyncRegular,
  CheckmarkRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ArrowLeftRegular,
  ImageRegular,
  DismissRegular,
  CameraRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

/**
 * Xodim/o'quvchi qo'shish va tahrirlash sahifasi.
 *
 * Marshrutlar:
 *   /users/staff/new       — yangi hodim/o'qituvchi
 *   /users/students/new    — yangi o'quvchi/talaba
 *   /employees/:id/edit    — tahrirlash
 *
 * Backend:
 *   GET  /api/employees/:id          (tahrirlash uchun)
 *   POST /api/employees              (multipart/form-data)
 *   PUT  /api/employees/:id          (multipart/form-data)
 *   GET  /api/organizations
 *   GET  /api/cameras
 */
const EMPLOYEE_TYPES = [
  { value: 'hodim',     label_uz: 'Hodim',           label_ru: 'Сотрудник' },
  { value: 'oqituvchi', label_uz: "O'qituvchi",      label_ru: 'Преподаватель' },
  { value: 'oquvchi',   label_uz: "O'quvchi",        label_ru: 'Учащийся' },
  { value: 'talaba',    label_uz: 'Talaba',          label_ru: 'Студент' },
]

export default function EmployeeForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const isEdit = Boolean(id)
  const toast = useToast()

  // mode parametri orqali default tip belgilanadi (URL: ?type=oquvchi)
  const initialType = searchParams.get('type') || 'hodim'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [orgs, setOrgs] = useState([])
  const [cameras, setCameras] = useState([])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    personal_id: '',
    department: '',
    position: '',
    employee_type: initialType,
    start_time: '',
    end_time: '',
    organization_id: '',
    camera_ids: [],
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const fileRef = useRef(null)
  const initialPidRef = useRef('')

  const setField = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  // Initial load
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [orgRes, camRes] = await Promise.all([
          fetch('/api/organizations', { credentials: 'include' }),
          fetch('/api/cameras', { credentials: 'include' }),
        ])
        if (orgRes.ok) {
          const data = await orgRes.json()
          if (alive) setOrgs(Array.isArray(data) ? data : (data?.items || []))
        }
        if (camRes.ok) {
          const data = await camRes.json()
          if (alive) setCameras(Array.isArray(data) ? data : (data?.items || []))
        }

        if (isEdit) {
          const r = await fetch(`/api/employees/${id}`, { credentials: 'include' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const data = await r.json()
          const it = data?.item
          if (it && alive) {
            initialPidRef.current = it.personal_id || ''
            setForm(prev => ({
              ...prev,
              first_name: it.first_name || '',
              last_name: it.last_name || '',
              middle_name: it.middle_name || '',
              personal_id: it.personal_id || '',
              department: it.department || '',
              position: it.position || '',
              employee_type: it.employee_type || 'hodim',
              start_time: it.start_time || '',
              end_time: it.end_time || '',
              organization_id: it.organization_id != null ? String(it.organization_id) : '',
              camera_ids: (it.camera_ids || []).map(Number),
            }))
            if (it.avatar) setImagePreview(it.avatar)
          }
        }
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, isEdit])

  // Personal ID availability check (debounced)
  const [pidStatus, setPidStatus] = useState({ checking: false, available: null, message: '' })
  const pidCheckRef = useRef(0)

  useEffect(() => {
    const v = (form.personal_id || '').trim()
    // Tahrirlashda boshlang'ich qiymat o'zgarmagan bo'lsa tekshirmaymiz
    if (isEdit && initialPidRef.current === v) {
      setPidStatus({ checking: false, available: null, message: '' })
      return
    }
    if (!v) {
      setPidStatus({ checking: false, available: null, message: '' })
      return
    }
    if (!/^\d{4,12}$/.test(v)) {
      setPidStatus({ checking: false, available: false, message: isRu ? '4–12 цифр' : "4-12 raqam" })
      return
    }
    const ticket = ++pidCheckRef.current
    setPidStatus(prev => ({ ...prev, checking: true }))
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ personal_id: v, allow_legacy: 'true' })
        if (isEdit && id) params.set('exclude_employee_id', String(id))
        const r = await fetch(`/api/employees/personal-id/validate?${params}`, { credentials: 'include' })
        const data = r.ok ? await r.json() : null
        if (ticket !== pidCheckRef.current) return
        if (!data) {
          setPidStatus({ checking: false, available: null, message: `HTTP ${r.status}` })
          return
        }
        setPidStatus({
          checking: false,
          available: !!data.available,
          message: data.message || (data.available
            ? (isRu ? 'ID свободен' : "ID bo'sh")
            : (isRu ? 'ID занят' : 'ID band')),
        })
      } catch (e) {
        if (ticket === pidCheckRef.current) {
          setPidStatus({ checking: false, available: null, message: e.message })
        }
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [form.personal_id, isEdit, id, isRu])

  // Personal ID auto-generate (yangi xodim uchun)
  const generateId = async () => {
    try {
      const r = await fetch('/api/employees/personal-id/generate', { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        if (data?.personal_id) {
          setForm(prev => ({ ...prev, personal_id: data.personal_id }))
          toast.info(isRu ? 'ID сгенерирован' : 'ID generatsiya qilindi')
        }
      }
    } catch (e) {
      toast.error(e.message)
    }
  }

  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onClearImage = () => {
    setImageFile(null)
    setImagePreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleCamera = (camId) => {
    setForm(prev => {
      const has = prev.camera_ids.includes(camId)
      return { ...prev, camera_ids: has ? prev.camera_ids.filter(x => x !== camId) : [...prev.camera_ids, camId] }
    })
  }

  const cameraSelected = form.camera_ids.length
  const camerasOfOrg = form.organization_id
    ? cameras.filter(c => String(c.organization_id) === String(form.organization_id))
    : cameras

  const validate = () => {
    if (!form.first_name.trim()) return isRu ? 'Имя обязательно' : 'Ism majburiy'
    if (!form.last_name.trim())  return isRu ? 'Фамилия обязательна' : 'Familiya majburiy'
    const pidValue = (form.personal_id || '').trim()
    if (pidValue && !/^\d{4,12}$/.test(pidValue)) {
      return isRu ? 'ID должен быть 4–12 цифр' : "Shaxsiy ID 4-12 raqam bo'lishi kerak"
    }
    if (pidValue && pidStatus.available === false && !pidStatus.checking) {
      return isRu ? 'Этот ID уже занят' : 'Bu ID allaqachon band'
    }
    if (pidValue && pidStatus.checking) {
      return isRu ? 'Подождите проверку ID' : "ID tekshiruvi tugashini kuting"
    }
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); toast.error(v); return }
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('first_name', form.first_name.trim())
      fd.set('last_name', form.last_name.trim())
      if (form.middle_name.trim())  fd.set('middle_name', form.middle_name.trim())
      if (form.personal_id.trim())  fd.set('personal_id', form.personal_id.trim())
      if (form.department.trim())   fd.set('department', form.department.trim())
      if (form.position.trim())     fd.set('position', form.position.trim())
      if (form.employee_type)       fd.set('employee_type', form.employee_type)
      if (form.start_time)          fd.set('start_time', form.start_time)
      if (form.end_time)            fd.set('end_time', form.end_time)
      if (form.organization_id)     fd.set('organization_id', String(form.organization_id))
      if (form.camera_ids.length)   fd.set('camera_ids', form.camera_ids.join(','))
      if (imageFile)                fd.set('image', imageFile)

      const url = isEdit ? `/api/employees/${id}` : '/api/employees'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, credentials: 'include', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      toast.success(isEdit
        ? (isRu ? 'Сохранено' : 'Saqlandi')
        : (isRu ? 'Сотрудник добавлен' : "Xodim qo'shildi"))
      // Tegishli ro'yxatga qaytamiz
      const isStudent = ['oquvchi', 'talaba', 'student'].includes(form.employee_type)
      navigate(isStudent ? '/users/students' : '/users/staff')
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isStudentMode = ['oquvchi', 'talaba', 'student'].includes(form.employee_type)
  const backPath = isStudentMode ? '/users/students' : '/users/staff'

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero badge="✦" title={isEdit ? (isRu ? 'Редактирование' : 'Tahrirlash') : (isRu ? 'Новый' : 'Yangi')} backPath={backPath} />
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
        badge={isEdit ? (isRu ? '✦ Редактирование' : '✦ Tahrirlash') : (isRu ? '✦ Новый сотрудник' : '✦ Yangi xodim')}
        title={isEdit
          ? (isRu ? 'Редактировать данные' : "Ma'lumotlarni tahrirlash")
          : (isRu ? 'Добавить сотрудника' : "Xodim qo'shish")}
        sub={isStudentMode
          ? (isRu ? 'Учащийся / студент' : "O'quvchi yoki talaba")
          : (isRu ? 'Сотрудник или преподаватель' : "Hodim yoki o'qituvchi")}
        backPath={backPath}
        right={
          <button type="button" onClick={() => navigate(backPath)} style={heroBtnStyle}>
            <ArrowLeftRegular fontSize={16} />
            {isRu ? 'К списку' : "Ro'yxatga"}
          </button>
        }
      />

      <form onSubmit={onSubmit} style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && <div style={errBannerStyle}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Shaxsiy ma'lumotlar */}
            <Section
              kicker={isRu ? 'Личные данные' : "Shaxsiy ma'lumotlar"}
              title={isRu ? 'ФИО и ID' : "F.I.SH va ID"}
            >
              <div style={grid3}>
                <Field label={isRu ? 'Имя' : 'Ism'} required>
                  <input value={form.first_name} onChange={setField('first_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Фамилия' : 'Familiya'} required>
                  <input value={form.last_name} onChange={setField('last_name')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Отчество' : 'Otasining ismi'}>
                  <input value={form.middle_name} onChange={setField('middle_name')} style={inpStyle} />
                </Field>
              </div>

              <div style={{ ...grid2, marginTop: 12 }}>
                <Field
                  label={isRu ? 'Личный ID (для камеры)' : 'Shaxsiy ID (kamera uchun)'}
                  hint={
                    pidStatus.message ||
                    (isRu
                      ? '7-значный ID. Если оставите пустым — будет сгенерирован.'
                      : "7 xonali ID. Bo'sh qoldirsangiz avtomatik generatsiya qilinadi.")
                  }
                  hintTone={
                    pidStatus.checking ? 'muted'
                    : pidStatus.available === true ? 'ok'
                    : pidStatus.available === false ? 'err'
                    : 'muted'
                  }
                >
                  <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        value={form.personal_id}
                        onChange={setField('personal_id')}
                        style={{ ...inpStyle, paddingRight: 36 }}
                        placeholder="1234567"
                        inputMode="numeric"
                      />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        {pidStatus.checking
                          ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                          : pidStatus.available === true
                            ? <CheckmarkCircleRegular fontSize={16} style={{ color: '#10b981' }} />
                            : pidStatus.available === false
                              ? <WarningRegular fontSize={14} style={{ color: '#f43f5e' }} />
                              : null}
                      </span>
                    </div>
                    {!isEdit && (
                      <button type="button" onClick={generateId} style={smallBtn('subtle')} title={isRu ? 'Сгенерировать' : 'Generatsiya'}>
                        <ArrowSyncRegular fontSize={13} />
                      </button>
                    )}
                  </div>
                </Field>
                <Field label={isRu ? 'Тип' : 'Tip'}>
                  <select value={form.employee_type} onChange={setField('employee_type')} style={inpStyle}>
                    {EMPLOYEE_TYPES.map(t => <option key={t.value} value={t.value}>{isRu ? t.label_ru : t.label_uz}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            {/* 2. Ish joyi */}
            <Section
              kicker={isRu ? 'Рабочее место' : 'Ish joyi'}
              title={isRu ? 'Организация, отдел, должность' : "Tashkilot, bo'lim, lavozim"}
            >
              <div style={grid2}>
                <Field label={isRu ? 'Организация' : 'Tashkilot'}>
                  <select value={form.organization_id} onChange={setField('organization_id')} style={inpStyle}>
                    <option value="">— {isRu ? 'Без организации' : 'Tashkilotsiz'} —</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
                <Field label={isStudentMode
                  ? (isRu ? 'Класс / группа' : 'Sinf / guruh')
                  : (isRu ? 'Отдел' : "Bo'lim")}>
                  <input value={form.department} onChange={setField('department')} style={inpStyle} />
                </Field>
                <Field label={isStudentMode
                  ? (isRu ? 'Параллель' : 'Parallel')
                  : (isRu ? 'Должность' : 'Lavozim')}>
                  <input value={form.position} onChange={setField('position')} style={inpStyle} />
                </Field>
              </div>
            </Section>

            {/* 3. Ish vaqti */}
            <Section
              kicker={isRu ? 'График' : 'Smena'}
              title={isRu ? 'Индивидуальное время' : 'Individual ish vaqti'}
              hint={isRu ? 'Если оставите пустым — будет использован график организации' : "Bo'sh qoldirsangiz tashkilot smenasi ishlatiladi"}
            >
              <div style={grid2}>
                <Field label={isRu ? 'Начало' : 'Boshlanish'}>
                  <input type="time" value={form.start_time || ''} onChange={setField('start_time')} style={inpStyle} />
                </Field>
                <Field label={isRu ? 'Конец' : 'Tugash'}>
                  <input type="time" value={form.end_time || ''} onChange={setField('end_time')} style={inpStyle} />
                </Field>
              </div>
            </Section>

            {/* 4. Kameralar */}
            <Section
              kicker={isRu ? 'Камеры' : 'Kameralar'}
              title={isRu ? 'Доступ к камерам' : 'Kameralarga ruxsat'}
              hint={isRu
                ? 'Сотрудник будет добавлен в выбранные камеры после сохранения.'
                : "Saqlangach xodim tanlangan kameralarga qo'shiladi."}
            >
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-3)' }}>
                {cameraSelected} / {camerasOfOrg.length} {isRu ? 'выбрано' : 'tanlangan'}
              </div>
              {camerasOfOrg.length === 0 ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>
                  {form.organization_id
                    ? (isRu ? 'У выбранной организации нет камер' : "Tanlangan tashkilotda kamera yo'q")
                    : (isRu ? 'Сначала выберите организацию' : "Avval tashkilotni tanlang")}
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8, maxHeight: 240, overflowY: 'auto',
                  padding: 8, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  {camerasOfOrg.map(c => {
                    const checked = form.camera_ids.includes(Number(c.id))
                    return (
                      <label key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 7,
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                        cursor: 'pointer', fontSize: 13,
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCamera(Number(c.id))} style={{ accentColor: 'var(--accent)' }} />
                        <CameraRegular fontSize={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* SIDE COLUMN — Avatar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section kicker="Avatar" title={isRu ? 'Фотография' : 'Rasm'}>
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
                  <input type="file" ref={fileRef} accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
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
                    {isRu ? 'Удалить' : "O'chirish"}
                  </button>
                )}
              </div>
            </Section>
          </aside>
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button type="button" onClick={() => navigate(backPath)} disabled={saving} style={btnStyle('subtle')}>
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
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function Section({ kicker, title, hint, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{kicker}</div>
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
  height: 36,
}
const heroBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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

function smallBtn(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 12px', borderRadius: 7,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    minWidth: 36, height: 36, flexShrink: 0,
  }
}
