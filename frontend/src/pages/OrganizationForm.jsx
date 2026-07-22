import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  SearchRegular,
  DismissRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  AddRegular,
  DeleteRegular,
  EditRegular,
  BuildingRegular,
  CameraRegular,
  ArrowSyncRegular,
  OpenRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import CustomSelect from '../components/CustomSelect'
import { useToast } from '../components/Toaster'
import { REGIONS, getDistricts } from '../lib/uzLocations'
import { MapContainer, TileLayer, Circle, CircleMarker, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const REGION_CENTERS = {
  toshkent_shahar:      [41.311081, 69.240562],
  toshkent_viloyat:     [41.2268, 69.3408],
  andijon_viloyat:      [40.7821, 72.3442],
  fargona_viloyat:      [40.3864, 71.7864],
  namangan_viloyat:     [41.0011, 71.6683],
  jizzax_viloyat:       [40.1158, 67.8422],
  sirdaryo_viloyat:     [40.4897, 68.7846],
  samarqand_viloyat:    [39.6542, 66.9597],
  qashqadaryo_viloyat:  [38.8614, 65.7847],
  surxondaryo_viloyat:  [37.9404, 67.5708],
  buxoro_viloyat:       [39.7747, 64.4286],
  navoiy_viloyat:       [40.0844, 65.3792],
  xorazm_viloyat:       [41.5500, 60.6300],
  qoraqalpogiston:      [43.0000, 59.0000],
}

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

  const [currentUser, setCurrentUser] = useState(null)
  const isSuperAdmin = currentUser?.role?.toLowerCase() === 'superadmin'

  // Branches (filiallar)
  const [branches, setBranches] = useState([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchModal, setBranchModal] = useState(null) // null | 'new' | branch obj

  const fetchBranches = useCallback(async () => {
    if (!isEdit || !id) return
    setBranchLoading(true)
    try {
      const res = await fetch(`/api/organizations/${id}/branches`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setBranches(Array.isArray(data) ? data : [])
      }
    } catch {}
    finally { setBranchLoading(false) }
  }, [isEdit, id])

  // Cameras (kameralar)
  const [cameras, setCameras] = useState([])
  const [cameraLoading, setCameraLoading] = useState(false)

  const fetchCameras = useCallback(async () => {
    if (!isEdit || !id) return
    setCameraLoading(true)
    try {
      const res = await fetch(`/api/cameras/by-org/${id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCameras(Array.isArray(data) ? data : [])
      }
    } catch {}
    finally { setCameraLoading(false) }
  }, [isEdit, id])

  const { branchLinkedCameras, unlinkedCameras } = useMemo(() => {
    const linked = []
    const unlinked = []
    for (const cam of cameras) {
      if (cam.branch_id !== null && cam.branch_id !== undefined) {
        linked.push(cam)
      } else {
        unlinked.push(cam)
      }
    }
    return { branchLinkedCameras: linked, unlinkedCameras: unlinked }
  }, [cameras])


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
    latitude: '',
    longitude: '',
    radius: 100,
  })

  const abortRef = useRef(null)

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      const typesPromise = fetch(`/api/organizations/types?lang=${i18n.language}`, { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; })
      const orgPromise = isEdit ? fetch(`/api/organizations/${id}?lang=${i18n.language}`, { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; }) : Promise.resolve(null)
      const mePromise = fetch('/api/auth/me', { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; })

      const [typesRes, orgRes, meRes] = await Promise.all([
        typesPromise,
        orgPromise,
        mePromise,
      ])
      if (signal.aborted || !typesRes || (isEdit && !orgRes)) return

      const typesData = typesRes.ok ? await typesRes.json() : []
      setTypes(Array.isArray(typesData) ? typesData : [])

      if (meRes?.ok) {
        const meData = await meRes.json()
        // /api/auth/me returns { user: {...}, organizations: [...], ... }
        setCurrentUser(meData?.user || meData)
      }

      if (isEdit && orgRes?.ok) {
        const org = await orgRes.json()
        if (org.uuid && id !== org.uuid) {
          navigate(`/organizations/${org.uuid}/edit`, { replace: true })
          return
        }
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
          latitude: org.latitude !== null && org.latitude !== undefined ? org.latitude : '',
          longitude: org.longitude !== null && org.longitude !== undefined ? org.longitude : '',
          radius: org.radius !== null && org.radius !== undefined ? org.radius : 100,
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

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  useEffect(() => {
    fetchCameras()
  }, [fetchCameras])

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleRegionChange = (regionId) => {
    const coords = REGION_CENTERS[regionId]
    setForm(f => ({
      ...f,
      region: regionId,
      district: '',
      village: '',
      latitude: coords ? coords[0].toFixed(6) : '',
      longitude: coords ? coords[1].toFixed(6) : '',
      radius: 100
    }))
  }

  const handleDistrictChange = (districtId) =>
    setForm(f => ({ ...f, district: districtId, village: '' }))

  const districts = getDistricts(form.region)

  const regionOptions = useMemo(() => {
    return REGIONS.map(r => ({
      value: r.id,
      label: isRu ? r.ru : r.uz
    }))
  }, [isRu])

  const districtOptions = useMemo(() => {
    return districts.map(d => ({
      value: d.id,
      label: isRu ? d.ru : d.uz
    }))
  }, [districts, isRu])

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
        latitude: null,
        longitude: null,
        radius: null,
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
                <CustomSelect
                  value={form.organization_type}
                  onChange={val => setField('organization_type', val)}
                  options={types}
                  placeholder={isRu ? '— Выберите тип —' : '— Turni tanlang —'}
                />
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
                    onChange={e => {
                      let val = e.target.value;
                      if (!val) {
                        setField('phone', '');
                        return;
                      }
                      const clean = val.replace(/\D/g, '');
                      if (clean === '9' || clean === '99' || clean === '998') {
                        setField('phone', '+' + clean);
                        return;
                      }
                      let body = clean.startsWith('998') ? clean.slice(3) : clean;
                      body = body.slice(0, 9);
                      
                      let formatted = '+998';
                      if (body.length > 0) {
                        const part1 = body.slice(0, 2);
                        const part2 = body.slice(2, 5);
                        const part3 = body.slice(5, 7);
                        const part4 = body.slice(7, 9);
                        if (part1) formatted += ' ' + part1;
                        if (part2) formatted += ' ' + part2;
                        if (part3) formatted += ' ' + part3;
                        if (part4) formatted += ' ' + part4;
                      }
                      setField('phone', formatted);
                    }}
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
                <CustomSelect
                  value={form.region}
                  onChange={handleRegionChange}
                  options={regionOptions}
                  placeholder={isRu ? '— Viloyatni tanlang —' : '— Viloyatni tanlang —'}
                />
              </Field>

              {/* Tuman */}
              <Field label={isRu ? 'Tuman' : 'Tuman'}>
                <CustomSelect
                  value={form.district}
                  onChange={handleDistrictChange}
                  options={districtOptions}
                  placeholder={
                    !form.region
                      ? (isRu ? '— Avval viloyatni tanlang —' : '— Avval viloyatni tanlang —')
                      : (isRu ? '— Tumanni tanlang —' : '— Tumanni tanlang —')
                  }
                  disabled={!form.region}
                />
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

          {/* ═══ ROW 2: Ish vaqti va Obuna ═══ */}
          <div className="org-form-grid-1">
            {/* Card 3 — Ish vaqti va Obuna */}
            <Card
              icon={<ClockRegular fontSize={18} />}
              title={isEdit ? (isRu ? 'Рабочее время и Подписка' : 'Ish vaqti va Obuna') : (isRu ? 'Стандартное рабочее время' : 'Standart ish vaqti')}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label={isRu ? 'Время начала' : 'Boshlanish vaqti'} required>
                  <input
                    id="org-start-time"
                    type="time"
                    value={form.default_start_time}
                    onChange={e => setField('default_start_time', e.target.value)}
                    style={inp}
                    required
                  />
                </Field>
                <Field label={isRu ? 'Время окончания' : 'Tugash vaqti'} required>
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
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-4)', lineHeight: 1.5 }}>
                {isRu
                  ? 'Это время будет установлено по умолчанию для новых сотрудников.'
                  : "Bu vaqt yangi xodimlar uchun standart ish vaqti bo'ladi."}
              </p>

              {isEdit && (
                <div style={{ borderTop: '1.5px solid var(--border-2)', paddingTop: 16, marginTop: 4 }}>
                  <Field label={isRu ? 'Статус подписки' : 'Obuna holati'}>
                    <SubscriptionButtons
                      value={form.subscription_status}
                      onChange={val => setField('subscription_status', val)}
                      isRu={isRu}
                      disabled={!isSuperAdmin}
                    />
                  </Field>
                </div>
              )}
            </Card>
          </div>

          {/* ═══ ROW 4: Filiallar (faqat edit) ═══ */}
          {isEdit && (
            <div className="org-form-grid-1" style={{ marginTop: 20 }}>
              <Card
                icon={<BuildingRegular fontSize={18} />}
                title={isRu ? 'Filiallar (joylashuvlar)' : 'Filiallar (joylashuvlar)'}
              >
                {/* Add button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
                    {isRu
                      ? "Har bir filialning alohida geo-chegarasi bo'lishi mumkin."
                      : "Har bir filialning alohida geo-chegarasi bo'lishi mumkin."}
                  </span>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setBranchModal('new')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8,
                        background: 'var(--accent)', border: 'none',
                        color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <AddRegular fontSize={14} />
                      {isRu ? "Filial qo'shish" : "Filial qo'shish"}
                    </button>
                  )}
                </div>

                {branchLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    Yuklanmoqda...
                  </div>
                ) : branches.length === 0 ? (
                  <div style={{
                    padding: '24px 20px', textAlign: 'center',
                    border: '1.5px dashed var(--border-2)', borderRadius: 10,
                    color: 'var(--text-4)', fontSize: 13,
                  }}>
                    {isRu
                      ? "Филиалы отсутствуют. Нажмите кнопку выше, чтобы добавить филиал."
                      : "Filiallar mavjud emas. Filial qo'shish uchun yuqoridagi tugmani bosing."}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {branches.map(br => (
                      <div
                        key={br.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', borderRadius: 10,
                          background: 'var(--bg)', border: '1.5px solid var(--border-2)',
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: 'rgba(0,120,212,0.1)', border: '1.5px solid rgba(0,120,212,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent)',
                        }}>
                          <LocationRegular fontSize={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)', marginBottom: 2 }}>
                            {br.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-4)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {br.address && <span>{br.address}</span>}
                            {br.latitude && <span>📍 {Number(br.latitude).toFixed(4)}, {Number(br.longitude).toFixed(4)}</span>}
                            {br.radius && <span>⊙ {br.radius} m</span>}
                            <span style={{
                              padding: '1px 8px', borderRadius: 20,
                              background: 'rgba(0,120,212,0.08)', color: 'var(--accent)',
                              fontSize: 11, fontWeight: 600,
                            }}>
                              {br.devices_count || 0} kamera
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/organizations/${id}/branches/${br.uuid || br.id}`)}
                            style={{
                              padding: '6px 10px', borderRadius: 7,
                              background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                              color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                            }}
                          >
                            <BuildingRegular fontSize={13} /> {isRu ? 'Войти' : 'Kirish'}
                          </button>
                          {isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => setBranchModal(br)}
                                style={{
                                  padding: '6px 10px', borderRadius: 7,
                                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                                  color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                                }}
                              >
                                <EditRegular fontSize={13} /> {isRu ? 'Tahrir' : 'Tahrir'}
                              </button>
                              <BranchDeleteButton
                                orgId={id}
                                branchId={br.uuid || br.id}
                                branchName={br.name}
                                onDeleted={fetchBranches}
                                toast={toast}
                                isRu={isRu}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══ ROW 5: Kameralar (faqat edit) ═══ */}
          {isEdit && (
            <div className="org-form-grid-1" style={{ marginTop: 20 }}>
              <Card
                icon={<CameraRegular fontSize={18} />}
                title={isRu ? `Kameralar (${cameras.length})` : `Kameralar (${cameras.length})`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
                    {isRu
                      ? 'Ushbu tashkilotga biriktirilgan barcha kameralar'
                      : 'Ushbu tashkilotga biriktirilgan barcha kameralar'}
                  </span>
                  <button
                    type="button"
                    onClick={fetchCameras}
                    disabled={cameraLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 7,
                      background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                      color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <ArrowSyncRegular fontSize={13} style={{ animation: cameraLoading ? 'spin 1s linear infinite' : 'none' }} />
                    {isRu ? 'Yangilash' : 'Yangilash'}
                  </button>
                </div>

                {cameraLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    Yuklanmoqda...
                  </div>
                ) : cameras.length === 0 ? (
                  <div style={{
                    padding: '24px 20px', textAlign: 'center',
                    border: '1.5px dashed var(--border-2)', borderRadius: 10,
                    color: 'var(--text-4)', fontSize: 13,
                  }}>
                    {isRu
                      ? 'Bu tashkilotga biriktirilgan kameralar mavjud emas.'
                      : 'Bu tashkilotga biriktirilgan kameralar mavjud emas.'}
                  </div>
                ) : (
                  <div className="org-form-grid-2" style={{ marginBottom: 0 }}>
                    {/* Column 1: Filialga bog'langan kameralar */}
                    <div>
                      <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckmarkCircleRegular fontSize={15} style={{ color: '#10b981' }} />
                        {isRu ? `Привязанные к филиалу (${branchLinkedCameras.length})` : `Filialga bog'langan (${branchLinkedCameras.length})`}
                      </h4>
                      {branchLinkedCameras.length === 0 ? (
                        <div style={{
                          padding: '20px 16px', textAlign: 'center',
                          border: '1.5px dashed var(--border-2)', borderRadius: 10,
                          color: 'var(--text-4)', fontSize: 12.5,
                        }}>
                          {isRu ? 'Нет привязанных камер' : 'Bog\'langan kameralar yo\'q'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {branchLinkedCameras.map(cam => (
                            <div
                              key={cam.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px', borderRadius: 10,
                                background: 'var(--bg)', border: '1.5px solid var(--border-2)',
                              }}
                            >
                              {/* Status dot */}
                              <div style={{
                                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                background: cam.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,100,0.1)',
                                border: `1.5px solid ${cam.is_online ? 'rgba(16,185,129,0.3)' : 'var(--border-2)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: cam.is_online ? '#10b981' : 'var(--text-4)',
                              }}>
                                <CameraRegular fontSize={16} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span>{cam.name}</span>
                                  <span style={{
                                    padding: '1px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                                    background: cam.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,100,0.1)',
                                    color: cam.is_online ? '#10b981' : 'var(--text-4)',
                                  }}>
                                    {cam.is_online ? (isRu ? 'Online' : 'Online') : (isRu ? 'Offline' : 'Offline')}
                                  </span>
                                  {cam.branch_name && (
                                    <span style={{
                                      padding: '1px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                                      background: 'rgba(0,120,212,0.1)', color: 'var(--accent)',
                                      border: '1.5px solid rgba(0,120,212,0.2)'
                                    }}>
                                      {cam.branch_name}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-4)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {cam.mac_address && <span>MAC: {cam.mac_address}</span>}
                                  {cam.isup_device_id && <span>ID: {cam.isup_device_id}</span>}
                                  {cam.model && <span>{cam.model}</span>}
                                </div>
                              </div>

                              <a
                                href={`/devices/${cam.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '6px 10px', borderRadius: 7,
                                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                                  color: 'var(--text-2)', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                                  textDecoration: 'none', fontWeight: 600,
                                }}
                              >
                                <OpenRegular fontSize={13} />
                                {isRu ? 'Ochish' : 'Ochish'}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Filialga bog'lanmagan kameralar */}
                    <div>
                      <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DismissCircleRegular fontSize={15} style={{ color: 'var(--text-4)' }} />
                        {isRu ? `Не привязанные к филиалу (${unlinkedCameras.length})` : `Filialga bog'lanmagan (${unlinkedCameras.length})`}
                      </h4>
                      {unlinkedCameras.length === 0 ? (
                        <div style={{
                          padding: '20px 16px', textAlign: 'center',
                          border: '1.5px dashed var(--border-2)', borderRadius: 10,
                          color: 'var(--text-4)', fontSize: 12.5,
                        }}>
                          {isRu ? 'Все камеры привязаны' : 'Bog\'lanmagan kameralar yo\'q'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {unlinkedCameras.map(cam => (
                            <div
                              key={cam.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px', borderRadius: 10,
                                background: 'var(--bg)', border: '1.5px solid var(--border-2)',
                              }}
                            >
                              {/* Status dot */}
                              <div style={{
                                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                background: cam.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,100,0.1)',
                                border: `1.5px solid ${cam.is_online ? 'rgba(16,185,129,0.3)' : 'var(--border-2)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: cam.is_online ? '#10b981' : 'var(--text-4)',
                              }}>
                                <CameraRegular fontSize={16} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span>{cam.name}</span>
                                  <span style={{
                                    padding: '1px 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                                    background: cam.is_online ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,100,0.1)',
                                    color: cam.is_online ? '#10b981' : 'var(--text-4)',
                                  }}>
                                    {cam.is_online ? (isRu ? 'Online' : 'Online') : (isRu ? 'Offline' : 'Offline')}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-4)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {cam.mac_address && <span>MAC: {cam.mac_address}</span>}
                                  {cam.isup_device_id && <span>ID: {cam.isup_device_id}</span>}
                                  {cam.model && <span>{cam.model}</span>}
                                </div>
                              </div>

                              <a
                                href={`/devices/${cam.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '6px 10px', borderRadius: 7,
                                  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                                  color: 'var(--text-2)', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                                  textDecoration: 'none', fontWeight: 600,
                                }}
                              >
                                <OpenRegular fontSize={13} />
                                {isRu ? 'Ochish' : 'Ochish'}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

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

      {/* Branch modal */}
      {branchModal && isSuperAdmin && (
        <BranchModal
          orgId={id}
          branch={branchModal === 'new' ? null : branchModal}
          onClose={() => setBranchModal(null)}
          onSaved={() => { setBranchModal(null); fetchBranches() }}
          isRu={isRu}
          toast={toast}
        />
      )}

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
        borderTopLeftRadius: 12.5,
        borderTopRightRadius: 12.5,
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

// ─── Subscription buttons ────────────────────────────────────────────────────

const SUB_OPTIONS = [
  {
    value: 'active',
    labelUz: 'Faol',
    labelRu: 'Faol',
    activeColor: '#10b981',
    activeBg: 'rgba(16,185,129,0.12)',
    activeBorder: 'rgba(16,185,129,0.35)',
    dot: '#10b981',
  },
  {
    value: 'pending',
    labelUz: 'Kutilmoqda',
    labelRu: 'Kutilmoqda',
    activeColor: '#f59e0b',
    activeBg: 'rgba(245,158,11,0.12)',
    activeBorder: 'rgba(245,158,11,0.35)',
    dot: '#f59e0b',
  },
  {
    value: 'expired',
    labelUz: 'Muddati tugagan',
    labelRu: 'Muddati tugagan',
    activeColor: '#f43f5e',
    activeBg: 'rgba(244,63,94,0.12)',
    activeBorder: 'rgba(244,63,94,0.35)',
    dot: '#f43f5e',
  },
]

function SubscriptionButtons({ value, onChange, isRu, disabled }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10,
    }}>
      {SUB_OPTIONS.map(opt => {
        const isActive = value === opt.value
        const IconComponent = opt.value === 'active'
          ? CheckmarkCircleRegular
          : opt.value === 'pending'
            ? ClockRegular
            : DismissCircleRegular

        return (
          <button
            key={opt.value}
            type="button"
            id={`sub-btn-${opt.value}`}
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '14px 10px',
              borderRadius: 11,
              border: isActive
                ? `2px solid ${opt.activeBorder}`
                : '2px solid var(--border-2)',
              background: isActive ? opt.activeBg : 'var(--bg)',
              color: isActive ? opt.activeColor : 'var(--text-3)',
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 500,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled && !isActive ? 0.65 : 1,
              transition: 'all 0.18s ease',
              outline: 'none',
              boxShadow: isActive ? `0 0 0 3px ${opt.activeBorder}` : 'none',
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <IconComponent
              fontSize={18}
              style={{
                color: isActive ? opt.activeColor : 'var(--text-4)',
                transition: 'color 0.18s',
                flexShrink: 0,
              }}
            />
            {isRu ? opt.labelRu : opt.labelUz}
          </button>
        )
      })}
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)' }}>
      {/* Hero skeleton */}
      <div style={{
        height: 160,
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface) 100%)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 40px',
        gap: 14,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}>
        <div style={{ height: 14, width: 100, borderRadius: 6, background: 'var(--border-2)' }} />
        <div style={{ height: 26, width: 260, borderRadius: 8, background: 'var(--border-2)' }} />
        <div style={{ height: 13, width: 200, borderRadius: 6, background: 'var(--border-2)' }} />
      </div>

      {/* Form cards skeleton */}
      <div className="org-form-container">
        <div className="org-form-grid-2" style={{ marginBottom: 20 }}>
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
        <div className="org-form-grid-2">
          {[1, 2].map(i => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{ height: 64, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2].map(j => (
                  <div key={j} style={{ height: 42, borderRadius: 8, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
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

// ────────────────────────────────────────────────────────────────────────────
// Building Selector Map & Geolocation Helpers
// ────────────────────────────────────────────────────────────────────────────

function getHaversineDistance(coords1, coords2) {
  const R = 6371000 // Earth's radius in meters
  const lat1 = coords1.lat * Math.PI / 180
  const lat2 = coords2.lat * Math.PI / 180
  const deltaLat = (coords2.lat - coords1.lat) * Math.PI / 180
  const deltaLng = (coords2.lng - coords1.lng) * Math.PI / 180

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng/2) * Math.sin(deltaLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

const overpassToGeoJSON = (elements) => {
  const features = []
  elements.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      const pts = el.geometry.map(p => [p.lon, p.lat])
      if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
        pts.push(pts[0])
      }
      features.push({
        type: 'Feature',
        properties: {
          id: el.id,
          tags: el.tags || {},
          rawGeometry: el.geometry
        },
        geometry: {
          type: 'Polygon',
          coordinates: [pts]
        }
      })
    }
  })
  return features
}

function MapController({ lat, lng }) {
  const map = useMap()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (lat && lng) {
      const targetLatLng = [parseFloat(lat), parseFloat(lng)]
      const targetZoom = map.getZoom() < 17 ? 17 : map.getZoom()
      if (isFirstRender.current) {
        map.setView(targetLatLng, targetZoom)
        isFirstRender.current = false
      } else {
        map.flyTo(targetLatLng, targetZoom, { animate: true, duration: 1.5 })
      }
    }
  }, [lat, lng, map])
  return null
}

function BuildingSelectorMap({ form, setField, isRu }) {
  const [buildings, setBuildings] = useState([])
  const [selectedBuildingId, setSelectedBuildingId] = useState(null)
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [inputFocused, setInputFocused] = useState(false)
  const loadedBoundsRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const toast = useToast()

  const loadSearchHistory = () => {
    try {
      const historyJson = localStorage.getItem('geo_search_history')
      setSearchHistory(historyJson ? JSON.parse(historyJson) : [])
    } catch (err) {
      console.warn('Error loading search history:', err)
    }
  }

  const saveToHistory = (item) => {
    try {
      const historyJson = localStorage.getItem('geo_search_history')
      let history = historyJson ? JSON.parse(historyJson) : []
      history = history.filter(h => h.display_name !== item.display_name)
      history.unshift(item)
      history = history.slice(0, 5)
      localStorage.setItem('geo_search_history', JSON.stringify(history))
      setSearchHistory(history)
    } catch (err) {
      console.warn('Error saving search history:', err)
    }
  }

  const handleSelectHistory = (item) => {
    const lat = parseFloat(item.lat)
    const lon = parseFloat(item.lon)
    setField('latitude', lat.toFixed(6))
    setField('longitude', lon.toFixed(6))
    setField('radius', 100)
    setSearchQuery(item.display_name)
    setSuggestions([])
    setLoadingSuggestions(false)
    saveToHistory(item)
    toast.success(isRu ? 'Местоположение выбрано!' : 'Joylashuv tanlandi!')
  }

  useEffect(() => {
    loadSearchHistory()
  }, [])

  const defaultCenter = [41.311081, 69.240562] // Tashkent
  const initialCenter = form.latitude && form.longitude
    ? [parseFloat(form.latitude), parseFloat(form.longitude)]
    : defaultCenter
  const initialZoom = form.latitude && form.longitude ? 18 : 13

  // Query location permissions and show dialog on load if coords not present
  useEffect(() => {
    if (!form.latitude && !form.longitude) {
      const isLocallyGranted = localStorage.getItem('geolocation_permission_granted') === 'true'
      
      if (isLocallyGranted) {
        handleMyLocation(true)
      } else if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(result => {
            if (result.state === 'granted') {
              handleMyLocation(true)
            } else if (result.state === 'prompt') {
              setShowLocationPrompt(true)
            } else {
              // result.state === 'denied'. Don't prompt the user if explicitly blocked
              setShowLocationPrompt(false)
            }
          })
          .catch(() => {
            // Safari throws error on querying geolocation permission
            setShowLocationPrompt(true)
          })
      } else {
        setShowLocationPrompt(true)
      }
    }
  }, [])

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const handleMyLocation = (silent = false) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setField('latitude', latitude.toFixed(6))
          setField('longitude', longitude.toFixed(6))
          setField('radius', 100)
          localStorage.setItem('geolocation_permission_granted', 'true')
          setShowLocationPrompt(false)
          if (!silent) {
            toast.success(isRu ? 'Определено текущее положение' : 'Joriy joylashuv aniqlandi')
          }
        },
        (error) => {
          console.warn('Geolocation error:', error)
          if (error.code === error.PERMISSION_DENIED) {
            localStorage.removeItem('geolocation_permission_granted')
          }
          if (!silent) {
            toast.error(isRu ? 'Не удалось определить положение' : 'Joylashuvni aniqlash imkoni bo\'lmadi')
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else if (!silent) {
      toast.error(isRu ? 'Геолокация не поддерживается вашим браузером' : 'Sizning brauzeringiz geolokatsiyani qo\'llab-quvvatlamaydi')
    }
  }

  // Handle autocomplete input change with debounce
  const handleInputChange = (val) => {
    setSearchQuery(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (val.trim().length < 3) {
      setSuggestions([])
      setLoadingSuggestions(false)
      return
    }

    setLoadingSuggestions(true)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lang = isRu ? 'ru' : 'uz'
        const url = `/api/organizations/geo/search?q=${encodeURIComponent(val)}&limit=5&lang=${lang}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data || [])
        }
      } catch (err) {
        console.warn('Nominatim autocomplete error:', err)
      } finally {
        setLoadingSuggestions(false)
      }
    }, 400)
  }

  const handleSelectSuggestion = (sug) => {
    const lat = parseFloat(sug.lat)
    const lon = parseFloat(sug.lon)
    setField('latitude', lat.toFixed(6))
    setField('longitude', lon.toFixed(6))
    setField('radius', 100)
    setSearchQuery(sug.display_name)
    setSuggestions([])
    setLoadingSuggestions(false)
    saveToHistory({
      display_name: sug.display_name,
      lat: sug.lat,
      lon: sug.lon
    })
    toast.success(isRu ? 'Местоположение выбрано!' : 'Joylashuv tanlandi!')
  }

  // Text-based geocoding search submission (enter key)
  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    // If suggestions are already loaded, select the first one
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0])
      return
    }

    setSearching(true)
    try {
      const lang = isRu ? 'ru' : 'uz'
      const url = `/api/organizations/geo/search?q=${encodeURIComponent(searchQuery)}&limit=1&lang=${lang}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0]
        setField('latitude', parseFloat(lat).toFixed(6))
        setField('longitude', parseFloat(lon).toFixed(6))
        setField('radius', 100)
        setSuggestions([])
        saveToHistory({
          display_name,
          lat,
          lon
        })
        toast.success(isRu ? 'Адрес найден!' : 'Manzil topildi!')
      } else {
        toast.error(isRu ? 'Местоположение не найдено' : 'Manzil topilmadi')
      }
    } catch (err) {
      console.error('Nominatim error:', err)
      toast.error(isRu ? 'Ошибка поиска' : 'Qidiruvda xatolik yuz berdi')
    } finally {
      setSearching(false)
    }
  }

  const loadBuildingsInBounds = async (bounds, zoom) => {
    if (zoom < 16) {
      setBuildings([])
      loadedBoundsRef.current = null
      return
    }

    if (loadedBoundsRef.current && loadedBoundsRef.current.contains(bounds)) {
      return
    }

    setLoadingBuildings(true)
    try {
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      
      const latPad = (ne.lat - sw.lat) * 0.2
      const lngPad = (ne.lng - sw.lng) * 0.2
      const bbox = `${sw.lat - latPad},${sw.lng - lngPad},${ne.lat + latPad},${ne.lng + lngPad}`
      
      // Expanded query to fetch building structures AND organization boundaries (universities, schools, colleges, offices, hospitals)
      const query = `[out:json][timeout:15];(way["building"](${bbox});way["amenity"~"university|school|college|hospital|kindergarten|clinic|public_building|place_of_worship|government|townhall|courthouse|police|fire_station|community_centre"](${bbox});way["office"](${bbox});way["shop"](${bbox});way["craft"](${bbox}););out geom;`
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch buildings')
      const data = await res.json()
      
      const geojsonFeatures = overpassToGeoJSON(data.elements || [])
      setBuildings(geojsonFeatures)
      
      loadedBoundsRef.current = bounds.pad(0.3)
    } catch (err) {
      console.error('Overpass error:', err)
    } finally {
      setLoadingBuildings(false)
    }
  }

  const handleSelectBuilding = (b) => {
    const rawGeom = b.properties.rawGeometry
    const len = rawGeom.length
    let latSum = 0, lngSum = 0
    rawGeom.forEach(p => {
      latSum += p.lat
      lngSum += p.lon
    })
    const centroidLat = latSum / len
    const centroidLng = lngSum / len

    let maxDist = 0
    rawGeom.forEach(p => {
      const dist = getHaversineDistance(
        { lat: centroidLat, lng: centroidLng },
        { lat: p.lat, lng: p.lon }
      )
      if (dist > maxDist) maxDist = dist
    })

    const calculatedRadius = Math.min(500, Math.max(15, Math.ceil(maxDist + 5)))

    setField('latitude', centroidLat.toFixed(6))
    setField('longitude', centroidLng.toFixed(6))
    setField('radius', calculatedRadius)
    setSelectedBuildingId(b.properties.id)
    setSuggestions([])
  }

  const handleMapClick = (latlng) => {
    setField('latitude', latlng.lat.toFixed(6))
    setField('longitude', latlng.lng.toFixed(6))
    if (!form.radius) {
      setField('radius', 50)
    }
    setSelectedBuildingId(null)
    setSuggestions([])
  }

  function MapEventsHandler() {
    const map = useMapEvents({
      moveend() {
        loadBuildingsInBounds(map.getBounds(), map.getZoom())
      },
      click(e) {
        handleMapClick(e.latlng)
      }
    })
    return null
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
      {/* ── Custom Location Request Dialog ── */}
      {showLocationPrompt && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: 16,
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            maxWidth: 320,
            width: '100%',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent)' }}>
              <LocationRegular fontSize={22} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                {isRu ? 'Геолокация' : 'Geolokatsiya ruxsati'}
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {isRu
                ? 'Для автоматического позиционирования карты на ваше текущее местоположение требуется доступ к геолокации. Разрешить доступ?'
                : 'Xaritani joriy joylashuvingizga moslash va geo-chegarani avtomatik sozlash uchun tizimga geolokatsiya ruxsati kerak. Ruxsat berasizmi?'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowLocationPrompt(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border-2)',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isRu ? 'Отмена' : 'Keyinroq'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocationPrompt(false)
                  handleMyLocation(false)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isRu ? 'Разрешить' : 'Ruxsat berish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search overlay (Yandex Navigator Style) ── */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 50,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1.5px solid var(--border-2)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        width: 'calc(100% - 60px)',
        maxWidth: 300,
        height: 38,
        padding: '0 10px',
        boxSizing: 'border-box'
      }}>
        <SearchRegular fontSize={16} style={{ color: 'var(--text-4)', marginRight: 6, flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => {
            setInputFocused(true)
            loadSearchHistory()
          }}
          onBlur={() => setTimeout(() => setInputFocused(false), 200)}
          placeholder={isRu ? 'Поиск места...' : 'Joyni qidirish...'}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-1)',
            fontSize: 13,
            outline: 'none',
            padding: '4px 0',
            width: '100%'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch()
            }
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSuggestions([])
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: '50%',
              transition: 'background 0.15s',
              marginLeft: 4,
              flexShrink: 0
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <DismissRegular fontSize={14} />
          </button>
        )}
      </div>

      {/* ── Suggestions Dropdown (Autocomplete & History) ── */}
      {((suggestions.length > 0 || loadingSuggestions) || (inputFocused && searchQuery.trim().length < 3 && searchHistory.length > 0)) && (
        <div style={{
          position: 'absolute',
          top: 52,
          left: 50,
          zIndex: 1005,
          background: 'var(--surface)',
          border: '1.5px solid var(--border-2)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          width: 'calc(100% - 60px)',
          maxWidth: 300,
          maxHeight: 200,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          {loadingSuggestions ? (
            // Skeleton Loader Rows
            [1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '12px 14px',
                  borderBottom: item === 3 ? 'none' : '1px solid var(--border-2)',
                  background: 'transparent',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--border-3, var(--border-2))',
                    animation: 'pulse 1.4s ease-in-out infinite',
                    flexShrink: 0
                  }} />
                  <div style={{
                    height: 12,
                    width: '60%',
                    borderRadius: 4,
                    background: 'var(--border-3, var(--border-2))',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }} />
                </div>
                <div style={{
                  height: 9,
                  width: '85%',
                  borderRadius: 3,
                  marginLeft: 20,
                  background: 'var(--border-3, var(--border-2))',
                  animation: 'pulse 1.4s ease-in-out infinite'
                }} />
              </div>
            ))
          ) : suggestions.length > 0 ? (
            // Suggestions list
            suggestions.map((sug, i) => {
              const parts = sug.display_name.split(',')
              const primaryText = parts[0]?.trim()
              const secondaryText = parts.slice(1).join(',')?.trim()
              return (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectSuggestion(sug)
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid var(--border-2)',
                    background: 'transparent',
                    color: 'var(--text-2)',
                    fontSize: 12.5,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    width: '100%',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,120,212,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <LocationRegular fontSize={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {primaryText}
                    </span>
                  </div>
                  {secondaryText && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {secondaryText}
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            // History list
            <>
              <div style={{
                padding: '8px 14px 6px',
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                borderBottom: '1px solid var(--border-2)',
                background: 'var(--surface-2)',
                userSelect: 'none'
              }}>
                {isRu ? 'Недавние запросы' : 'Yaqinda qidirilganlar'}
              </div>
              {searchHistory.map((item, i) => {
                const parts = item.display_name.split(',')
                const primaryText = parts[0]?.trim()
                const secondaryText = parts.slice(1).join(',')?.trim()
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectHistory(item)
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '10px 14px',
                      border: 'none',
                      borderBottom: i === searchHistory.length - 1 ? 'none' : '1px solid var(--border-2)',
                      background: 'transparent',
                      color: 'var(--text-2)',
                      fontSize: 12.5,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      width: '100%',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,120,212,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <ClockRegular fontSize={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {primaryText}
                      </span>
                    </div>
                    {secondaryText && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {secondaryText}
                      </span>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── GPS target button ── */}
      <button
        type="button"
        onClick={() => handleMyLocation(false)}
        title={isRu ? 'Мое местоположение' : 'Mening joylashuvim'}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 10,
          zIndex: 1000,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: '1.5px solid var(--border-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-1)',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
        }}
      >
        <LocationRegular fontSize={18} />
      </button>

      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapEventsHandler />
        <MapController lat={form.latitude} lng={form.longitude} />

        {buildings.map(b => (
          <GeoJSON
            key={b.properties.id}
            data={b}
            style={() => ({
              color: selectedBuildingId === b.properties.id ? 'var(--accent)' : 'rgba(0,120,212,0.4)',
              weight: selectedBuildingId === b.properties.id ? 3 : 1.5,
              fillColor: selectedBuildingId === b.properties.id ? 'var(--accent)' : 'rgba(0,120,212,0.15)',
              fillOpacity: selectedBuildingId === b.properties.id ? 0.35 : 0.15,
            })}
            eventHandlers={{
              mouseover: (e) => {
                e.target.setStyle({
                  color: 'var(--accent)',
                  weight: 3,
                  fillColor: 'var(--accent)',
                  fillOpacity: 0.35,
                })
              },
              mouseout: (e) => {
                if (selectedBuildingId !== b.properties.id) {
                  e.target.setStyle({
                    color: 'rgba(0,120,212,0.4)',
                    weight: 1.5,
                    fillColor: 'rgba(0,120,212,0.15)',
                    fillOpacity: 0.15,
                  })
                }
              },
              click: (e) => {
                L.DomEvent.stopPropagation(e)
                handleSelectBuilding(b)
              }
            }}
          />
        ))}

        {form.latitude && form.longitude && (
          <>
            <CircleMarker
              center={[parseFloat(form.latitude), parseFloat(form.longitude)]}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#4f46e5',
                fillOpacity: 1,
                weight: 2
              }}
            />
            <Circle
              center={[parseFloat(form.latitude), parseFloat(form.longitude)]}
              radius={parseFloat(form.radius) || 100}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.15,
                weight: 1.5,
                dashArray: '5, 5'
              }}
            />
          </>
        )}

        {loadingBuildings && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 1000,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            {isRu ? 'Загрузка зданий...' : 'Binolar yuklanmoqda...'}
          </div>
        )}
      </MapContainer>
    </div>
  )
}


// ─── BranchDeleteButton ──────────────────────────────────────────────────────
function BranchDeleteButton({ orgId, branchId, branchName, onDeleted, toast, isRu }) {
  const [loading, setLoading] = useState(false)
  const handleDelete = async () => {
    if (!window.confirm(`"${branchName}" filialini o'chirmoqchimisiz?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/branches/${branchId}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail || `HTTP ${res.status}`)
      }
      toast.success(isRu ? "Filial o'chirildi" : "Filial o'chirildi")
      onDeleted()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      style={{
        padding: '6px 10px', borderRadius: 7,
        background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
        color: '#f43f5e', cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <DeleteRegular fontSize={13} />
      {isRu ? "O'chirish" : "O'chirish"}
    </button>
  )
}


function parseGoogleMapsCoords(url) {
  if (!url) return null
  try {
    const decoded = decodeURIComponent(url)
    const m3d4d = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    if (m3d4d) return { lat: parseFloat(m3d4d[1]), lng: parseFloat(m3d4d[2]) }

    const mAt = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (mAt) return { lat: parseFloat(mAt[1]), lng: parseFloat(mAt[2]) }

    const mQuery = decoded.match(/(?:q|ll|destination|query|center)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/)
    if (mQuery) return { lat: parseFloat(mQuery[1]), lng: parseFloat(mQuery[2]) }

    const mDms = decoded.match(/(\d+)°(\d+)'([\d.]+)"([NS])[\s+]+(\d+)°(\d+)'([\d.]+)"([EW])/)
    if (mDms) {
      let lat = parseFloat(mDms[1]) + parseFloat(mDms[2]) / 60 + parseFloat(mDms[3]) / 3600
      if (mDms[4] === 'S') lat = -lat
      let lng = parseFloat(mDms[5]) + parseFloat(mDms[6]) / 60 + parseFloat(mDms[7]) / 3600
      if (mDms[8] === 'W') lng = -lng
      return { lat, lng }
    }

    const mRaw = decoded.match(/(-?\d+\.\d{4,})[,\s]+(-?\d+\.\d{4,})/)
    if (mRaw) return { lat: parseFloat(mRaw[1]), lng: parseFloat(mRaw[2]) }
  } catch (e) {
    console.error("Parse gmaps error", e)
  }
  return null
}

// ─── BranchModal ─────────────────────────────────────────────────────────────
function BranchModal({ orgId, branch, onClose, onSaved, isRu, toast }) {
  const isNew = !branch
  const [form, setForm] = useState({
    name: branch?.name || '',
    address: branch?.address || '',
    latitude: branch?.latitude ?? '',
    longitude: branch?.longitude ?? '',
    radius: branch?.radius ?? 100,
  })
  const [gmapsUrl, setGmapsUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setF = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleGmapsUrlChange = (e) => {
    const url = e.target.value
    setGmapsUrl(url)
    const coords = parseGoogleMapsCoords(url)
    if (coords) {
      setForm(p => ({ ...p, latitude: coords.lat.toFixed(6), longitude: coords.lng.toFixed(6) }))
      if (toast && toast.success) {
        toast.success(isRu ? '📍 Joylashuv koordinatalari aniqlandi!' : '📍 Joylashuv koordinatalari aniqlandi!')
      }
    }
  }

  const inp = {
    width: '100%', padding: '10px 13px', borderRadius: 8,
    border: '1.5px solid var(--border-2)', background: 'var(--bg)',
    color: 'var(--text-1)', fontSize: 13.5, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError(isRu ? 'Nom majburiy' : 'Nom majburiy'); return }
    setSaving(true); setError('')
    try {
      const body = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
        radius: form.radius !== '' ? parseFloat(form.radius) : 100,
      }
      const url = isNew
        ? `/api/organizations/${orgId}/branches`
        : `/api/organizations/${orgId}/branches/${branch.uuid || branch.id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail || `HTTP ${res.status}`)
      }
      toast.success(isNew ? "Filial qo'shildi" : 'Filial yangilandi')
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 16, padding: 28, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {isNew ? '✦ Yangi filial' : '✦ Filialni tahrirlash'}
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>
              {isNew ? (isRu ? "Filial qo'shish" : "Filial qo'shish") : (isRu ? 'Filialni tahrirlash' : 'Filialni tahrirlash')}
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isRu ? 'Filial nomi' : 'Filial nomi'} <span style={{ color: '#f43f5e' }}>*</span>
            </span>
            <input value={form.name} onChange={setF('name')} style={inp}
              placeholder="Masalan: Andijon filiyal" autoFocus />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isRu ? 'Manzil' : 'Manzil'}
            </span>
            <input value={form.address} onChange={setF('address')} style={inp} placeholder="Ko'cha, bino, hudud..." />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
              📍 Google Maps Havolasi (Link orqali joylashuvni aniqlash)
            </span>
            <input
              value={gmapsUrl}
              onChange={handleGmapsUrlChange}
              style={{ ...inp, border: '1.5px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.05)' }}
              placeholder="https://www.google.com/maps/place/..."
            />
          </label>

          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border-2)', height: 340 }}>
            <BranchGeoMap form={form} setForm={setForm} isRu={isRu} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Latitude</span>
              <input type="number" step="any" value={form.latitude} onChange={setF('latitude')} style={inp} placeholder="41.311081" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Longitude</span>
              <input type="number" step="any" value={form.longitude} onChange={setF('longitude')} style={inp} placeholder="69.240562" />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isRu ? 'Radius (m)' : 'Radius (m)'}
              <span style={{ marginLeft: 10, color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>{form.radius} m</span>
            </span>
            <input type="range" min="15" max="500" value={form.radius || 100}
              onChange={e => setForm(p => ({ ...p, radius: parseInt(e.target.value) || 15 }))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </label>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.08)', color: '#f43f5e', borderRadius: 8, fontSize: 13, border: '1px solid rgba(244,63,94,0.25)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--surface-2)', border: '1.5px solid var(--border-2)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {isRu ? 'Bekor' : 'Bekor'}
          </button>
          <button type="submit" disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 8, background: saving ? '#0060aa' : 'var(--accent)', border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <CheckmarkRegular fontSize={16} />
            {saving ? 'Saqlanmoqda...' : (isNew ? (isRu ? "Qo'shish" : "Qo'shish") : (isRu ? 'Saqlash' : 'Saqlash'))}
          </button>
        </div>
      </form>
    </div>
  )
}


// ─── BranchGeoMap ────────────────────────────────────────────────────────────
// BuildingSelectorMap bilan bir xil funksiya, faqat setForm ishlatadi
function BranchGeoMap({ form, setForm, isRu }) {
  const setField = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const [buildings, setBuildings] = useState([])
  const [selectedBuildingId, setSelectedBuildingId] = useState(null)
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [inputFocused, setInputFocused] = useState(false)
  const loadedBoundsRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const toast = useToast()

  const performReverseGeocoding = async (lat, lng) => {
    try {
      const lang = isRu ? 'ru' : 'uz'
      const res = await fetch(
        `/api/organizations/geo/reverse?lat=${lat}&lon=${lng}&lang=${lang}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.display_name) {
          setField('address', data.display_name)
          setSearchQuery(data.display_name)
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err)
    }
  }

  const loadSearchHistory = () => {
    try {
      const h = localStorage.getItem('branch_geo_search_history')
      setSearchHistory(h ? JSON.parse(h) : [])
    } catch {}
  }

  const saveToHistory = (item) => {
    try {
      const h = localStorage.getItem('branch_geo_search_history')
      let hist = h ? JSON.parse(h) : []
      hist = hist.filter(x => x.display_name !== item.display_name)
      hist.unshift(item)
      hist = hist.slice(0, 5)
      localStorage.setItem('branch_geo_search_history', JSON.stringify(hist))
      setSearchHistory(hist)
    } catch {}
  }

  useEffect(() => { loadSearchHistory() }, [])

  useEffect(() => {
    if (!form.latitude && !form.longitude) {
      const granted = localStorage.getItem('geolocation_permission_granted') === 'true'
      if (granted) {
        handleMyLocation(true)
      } else if (navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(r => {
            if (r.state === 'granted') handleMyLocation(true)
            else if (r.state === 'prompt') setShowLocationPrompt(true)
          })
          .catch(() => setShowLocationPrompt(true))
      } else {
        setShowLocationPrompt(true)
      }
    }
  }, [])

  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }, [])

  const handleMyLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) toast.error(isRu ? 'Геолокация не поддерживается' : 'Geolokatsiya qo\'llab-quvvatlanmaydi')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latStr = coords.latitude.toFixed(6)
        const lngStr = coords.longitude.toFixed(6)
        setField('latitude', latStr)
        setField('longitude', lngStr)
        setField('radius', 100)
        localStorage.setItem('geolocation_permission_granted', 'true')
        setShowLocationPrompt(false)
        if (!silent) toast.success(isRu ? 'Определено текущее положение' : 'Joriy joylashuv aniqlandi')
        performReverseGeocoding(latStr, lngStr)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) localStorage.removeItem('geolocation_permission_granted')
        if (!silent) toast.error(isRu ? 'Не удалось определить положение' : 'Joylashuvni aniqlash imkoni bo\'lmadi')
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  const handleInputChange = (val) => {
    setSearchQuery(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (val.trim().length < 3) { setSuggestions([]); setLoadingSuggestions(false); return }
    setLoadingSuggestions(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lang = isRu ? 'ru' : 'uz'
        const res = await fetch(
          `/api/organizations/geo/search?q=${encodeURIComponent(val)}&limit=5&lang=${lang}`
        )
        if (res.ok) setSuggestions(await res.json() || [])
      } catch {} finally { setLoadingSuggestions(false) }
    }, 400)
  }

  const handleSelectSuggestion = (sug) => {
    setField('latitude', parseFloat(sug.lat).toFixed(6))
    setField('longitude', parseFloat(sug.lon).toFixed(6))
    setField('radius', 100)
    setSearchQuery(sug.display_name)
    setField('address', sug.display_name)
    setSuggestions([])
    setLoadingSuggestions(false)
    saveToHistory({ display_name: sug.display_name, lat: sug.lat, lon: sug.lon })
    toast.success(isRu ? 'Местоположение выбрано!' : 'Joylashuv tanlandi!')
  }

  const handleSelectHistory = (item) => {
    setField('latitude', parseFloat(item.lat).toFixed(6))
    setField('longitude', parseFloat(item.lon).toFixed(6))
    setField('radius', 100)
    setSearchQuery(item.display_name)
    setField('address', item.display_name)
    setSuggestions([])
    saveToHistory(item)
    toast.success(isRu ? 'Местоположение выбрано!' : 'Joylashuv tanlandi!')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    if (suggestions.length > 0) { handleSelectSuggestion(suggestions[0]); return }
    try {
      const lang = isRu ? 'ru' : 'uz'
      const res = await fetch(
        `/api/organizations/geo/search?q=${encodeURIComponent(searchQuery)}&limit=1&lang=${lang}`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data?.length > 0) {
        const { lat, lon, display_name } = data[0]
        setField('latitude', parseFloat(lat).toFixed(6))
        setField('longitude', parseFloat(lon).toFixed(6))
        setField('radius', 100)
        setField('address', display_name)
        setSuggestions([])
        saveToHistory({ display_name, lat, lon })
        toast.success(isRu ? 'Адрес найден!' : 'Manzil topildi!')
      } else {
        toast.error(isRu ? 'Местоположение не найдено' : 'Manzil topilmadi')
      }
    } catch {
      toast.error(isRu ? 'Ошибка поиска' : 'Qidiruvda xatolik')
    }
  }

  const loadBuildingsInBounds = async (bounds, zoom) => {
    if (zoom < 16) { setBuildings([]); loadedBoundsRef.current = null; return }
    if (loadedBoundsRef.current?.contains(bounds)) return
    setLoadingBuildings(true)
    try {
      const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
      const latPad = (ne.lat - sw.lat) * 0.2, lngPad = (ne.lng - sw.lng) * 0.2
      const bbox = `${sw.lat - latPad},${sw.lng - lngPad},${ne.lat + latPad},${ne.lng + lngPad}`
      const query = `[out:json][timeout:15];(way["building"](${bbox});way["amenity"~"university|school|college|hospital|kindergarten"](${bbox});way["office"](${bbox}););out geom;`
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBuildings(overpassToGeoJSON(data.elements || []))
      loadedBoundsRef.current = bounds.pad(0.3)
    } catch {} finally { setLoadingBuildings(false) }
  }

  const handleSelectBuilding = (b) => {
    const geom = b.properties.rawGeometry
    let latSum = 0, lngSum = 0
    geom.forEach(p => { latSum += p.lat; lngSum += p.lon })
    const cLat = latSum / geom.length, cLng = lngSum / geom.length
    let maxDist = 0
    geom.forEach(p => {
      const d = getHaversineDistance({ lat: cLat, lng: cLng }, { lat: p.lat, lng: p.lon })
      if (d > maxDist) maxDist = d
    })
    const latStr = cLat.toFixed(6)
    const lngStr = cLng.toFixed(6)
    setField('latitude', latStr)
    setField('longitude', lngStr)
    setField('radius', Math.min(500, Math.max(15, Math.ceil(maxDist + 5))))
    setSelectedBuildingId(b.properties.id)
    setSuggestions([])
    const bName = b.properties.name || b.properties.amenity || b.properties.office || b.properties.building
    if (bName) {
      setField('address', bName)
      setSearchQuery(bName)
    } else {
      performReverseGeocoding(latStr, lngStr)
    }
  }

  const defaultCenter = [41.311081, 69.240562]
  const initialCenter = form.latitude && form.longitude
    ? [parseFloat(form.latitude), parseFloat(form.longitude)] : defaultCenter
  const initialZoom = form.latitude && form.longitude ? 18 : 13

  function BranchMapEvents() {
    const map = useMapEvents({
      moveend() { loadBuildingsInBounds(map.getBounds(), map.getZoom()) },
      click(e) {
        const lat = e.latlng.lat.toFixed(6)
        const lng = e.latlng.lng.toFixed(6)
        setField('latitude', lat)
        setField('longitude', lng)
        if (!form.radius) setField('radius', 50)
        setSelectedBuildingId(null)
        setSuggestions([])
        performReverseGeocoding(lat, lng)
      }
    })
    return null
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>

      {/* Location permission dialog */}
      {showLocationPrompt && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001, padding: 16, boxSizing: 'border-box',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14,
            padding: 20, maxWidth: 300, width: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent)' }}>
              <LocationRegular fontSize={22} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                {isRu ? 'Геолокация' : 'Geolokatsiya ruxsati'}
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {isRu
                ? 'Для позиционирования карты на ваше местоположение требуется доступ. Разрешить?'
                : "Xaritani joriy joylashuvga moslash uchun ruxsat kerak. Ruxsat berasizmi?"}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowLocationPrompt(false)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {isRu ? 'Отмена' : 'Keyinroq'}
              </button>
              <button type="button" onClick={() => { setShowLocationPrompt(false); handleMyLocation(false) }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                {isRu ? 'Разрешить' : 'Ruxsat berish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 50, zIndex: 1000,
        display: 'flex', alignItems: 'center',
        background: 'var(--surface)', borderRadius: 10,
        border: '1.5px solid var(--border-2)', boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
        width: 'calc(100% - 60px)', maxWidth: 300, height: 38,
        padding: '0 10px', boxSizing: 'border-box',
      }}>
        <SearchRegular fontSize={16} style={{ color: 'var(--text-4)', marginRight: 6, flexShrink: 0 }} />
        <input
          type="text" value={searchQuery}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { setInputFocused(true); loadSearchHistory() }}
          onBlur={() => setTimeout(() => setInputFocused(false), 200)}
          placeholder={isRu ? 'Поиск места...' : 'Joyni qidirish...'}
          style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-1)', fontSize: 13, outline: 'none', padding: '4px 0', width: '100%' }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
        />
        {searchQuery && (
          <button type="button" onClick={() => { setSearchQuery(''); setSuggestions([]) }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: '50%', marginLeft: 4, flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <DismissRegular fontSize={14} />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {((suggestions.length > 0 || loadingSuggestions) || (inputFocused && searchQuery.trim().length < 3 && searchHistory.length > 0)) && (
        <div style={{
          position: 'absolute', top: 52, left: 50, zIndex: 1005,
          background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', width: 'calc(100% - 60px)', maxWidth: 300,
          maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        }}>
          {loadingSuggestions ? (
            [1, 2, 3].map(i => (
              <div key={i} style={{ padding: '12px 14px', borderBottom: i < 3 ? '1px solid var(--border-2)' : 'none' }}>
                <div style={{ height: 11, width: '65%', borderRadius: 4, background: 'var(--border-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
              </div>
            ))
          ) : suggestions.length > 0 ? (
            suggestions.map((sug, i) => {
              const parts = sug.display_name.split(',')
              return (
                <button key={i} type="button" onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(sug) }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-2)' : 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 12.5, textAlign: 'left', cursor: 'pointer', width: '100%', outline: 'none', boxSizing: 'border-box' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,120,212,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LocationRegular fontSize={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{parts[0]?.trim()}</span>
                  </div>
                  {parts.length > 1 && <span style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{parts.slice(1).join(',').trim()}</span>}
                </button>
              )
            })
          ) : (
            <>
              <div style={{ padding: '8px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                {isRu ? 'Недавние запросы' : 'Yaqinda qidirilganlar'}
              </div>
              {searchHistory.map((item, i) => (
                <button key={i} type="button" onMouseDown={e => { e.preventDefault(); handleSelectHistory(item) }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', border: 'none', borderBottom: i < searchHistory.length - 1 ? '1px solid var(--border-2)' : 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 12.5, textAlign: 'left', cursor: 'pointer', width: '100%', outline: 'none', boxSizing: 'border-box' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,120,212,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClockRegular fontSize={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.display_name.split(',')[0]?.trim()}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* GPS button */}
      <button type="button" onClick={() => handleMyLocation(false)}
        title={isRu ? 'Мое местоположение' : 'Mening joylashuvim'}
        style={{
          position: 'absolute', bottom: 20, right: 10, zIndex: 1000,
          width: 38, height: 38, borderRadius: '50%',
          background: 'var(--surface)', border: '1.5px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-1)', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
        }}>
        <LocationRegular fontSize={18} />
      </button>

      <MapContainer center={initialCenter} zoom={initialZoom} style={{ width: '100%', height: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <BranchMapEvents />
        <MapController lat={form.latitude} lng={form.longitude} />

        {buildings.map(b => (
          <GeoJSON key={b.properties.id} data={b}
            style={() => ({
              color: selectedBuildingId === b.properties.id ? 'var(--accent)' : 'rgba(0,120,212,0.4)',
              weight: selectedBuildingId === b.properties.id ? 3 : 1.5,
              fillColor: selectedBuildingId === b.properties.id ? 'var(--accent)' : 'rgba(0,120,212,0.15)',
              fillOpacity: selectedBuildingId === b.properties.id ? 0.35 : 0.15,
            })}
            eventHandlers={{
              mouseover: e => e.target.setStyle({ color: 'var(--accent)', weight: 3, fillColor: 'var(--accent)', fillOpacity: 0.35 }),
              mouseout: e => { if (selectedBuildingId !== b.properties.id) e.target.setStyle({ color: 'rgba(0,120,212,0.4)', weight: 1.5, fillColor: 'rgba(0,120,212,0.15)', fillOpacity: 0.15 }) },
              click: e => { L.DomEvent.stopPropagation(e); handleSelectBuilding(b) }
            }}
          />
        ))}

        {form.latitude && form.longitude && (
          <>
            <CircleMarker
              center={[parseFloat(form.latitude), parseFloat(form.longitude)]}
              radius={6}
              pathOptions={{ color: '#ffffff', fillColor: '#4f46e5', fillOpacity: 1, weight: 2 }}
            />
            <Circle
              center={[parseFloat(form.latitude), parseFloat(form.longitude)]}
              radius={parseFloat(form.radius) || 100}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1.5, dashArray: '5, 5' }}
            />
          </>
        )}

        {loadingBuildings && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10, background: 'var(--surface)',
            border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 6,
            fontSize: 12, fontWeight: 600, zIndex: 1000, boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            {isRu ? 'Загрузка зданий...' : 'Binolar yuklanmoqda...'}
          </div>
        )}
      </MapContainer>
    </div>
  )
}
