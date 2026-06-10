import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  SaveRegular, ArrowSyncRegular,
  LockOpenRegular, PhoneUpdateRegular, ShareScreenStartRegular,
  DeleteRegular, EyeRegular, EyeOffRegular, ChevronDownRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useConfirm } from '../components/ConfirmDialog'
import CustomSelect from '../components/CustomSelect'
import { useToast } from '../components/Toaster'

const MODELS = ['DS-K1T343MFWX','DS-K1T341CMF','DS-K1T342MFWX','DS-K1T671TM-3XF','DS-K1T320MFWX','DS-K1T607MF','DS-K1T321MFWX','DS-K1T680DFW']

const inp = {
  width: '100%', padding: '9px 12px',
  background: 'var(--bg)', border: '1px solid var(--border-3)',
  borderRadius: 9, color: 'var(--text-1)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
}
const inpRO = { ...inp, background: 'var(--surface-2)', color: 'var(--text-4)', cursor: 'default' }
const label = { display: 'block', fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, fontWeight: 600 }
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20 }
const eyeBtn = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 4 }

function Field({ label: lbl, children, span }) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : {}}>
      <label style={label}>{lbl}</label>
      {children}
    </div>
  )
}

function PwField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange}
        placeholder={placeholder} style={{ ...inp, paddingRight: 36 }} />
      <button type="button" style={eyeBtn} onClick={() => setShow(s => !s)}>
        {show ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
      </button>
    </div>
  )
}

function CmdBtn({ lbl, icon, color, onClick, loading }) {
  const isPrimary = !!color
  const base = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '13px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: loading ? 'wait' : 'pointer', marginBottom: 10,
    border: isPrimary ? 'none' : '1px solid var(--border)',
    background: isPrimary ? color : 'var(--surface-2)',
    color: isPrimary ? '#fff' : 'var(--text-1)',
    opacity: loading ? 0.7 : 1, transition: 'opacity .15s',
  }
  return (
    <button onClick={onClick} disabled={loading} style={base}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = loading ? '0.7' : '1'}
    >
      {loading ? <Spinner size="tiny" /> : icon}
      {lbl}
    </button>
  )
}

export default function CameraDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const abortRef = useRef(null)
  const confirm  = useConfirm()
  const toast    = useToast()

  const [cam, setCam]         = useState(null)
  const [orgs, setOrgs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [spin, setSpin]       = useState(false)
  const [error, setError]     = useState('')
  const [cmdLoading, setCmdLoading] = useState({})

  const [alarmSummary, setAlarmSummary] = useState(null)
  const [alarmForm, setAlarmForm] = useState({
    ip_or_domain: '',
    port: '8080',
    url: '/api/v1/httppost/',
    protocol: 'HTTP'
  })
  const [loadingAlarm, setLoadingAlarm] = useState(false)
  const [savingAlarm, setSavingAlarm] = useState(false)

  const fetchAlarmSettings = async () => {
    setLoadingAlarm(true)
    setError('')
    try {
      const res = await fetch(`/api/cameras/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'get_alarm_server', params: {} }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || (isRu ? 'Ошибка при получении настроек' : 'Sozlamalarni olishda xatolik'))
      if (data.response && data.response.ok && data.response.summary) {
        const sum = data.response.summary
        setAlarmSummary(sum)
        setAlarmForm({
          ip_or_domain: sum.webhook_ip_or_domain || '',
          port: sum.webhook_port || '443',
          url: sum.webhook_path || '/api/v1/httppost/',
          protocol: sum.webhook_protocol || 'HTTP'
        })
        // Backend DB ga sinxronlangan ma'lumotlarni metadata bo'limiga ham aks ettirish
        if (data.camera_sync) {
          setF(prev => ({
            ...prev,
            webhook_target_url: data.camera_sync.webhook_target_url || prev.webhook_target_url,
            webhook_enabled: !!data.camera_sync.webhook_enabled,
            webhook_picture_sending: !!data.camera_sync.webhook_picture_sending,
          }))
        }
      } else {
        throw new Error(isRu ? 'Не удалось прочитать настройки из ответа' : 'Javobdan sozlamalarni o\'qib bo\'lmadi')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAlarm(false)
    }
  }


  const saveAlarmSettings = async () => {
    if (!alarmForm.ip_or_domain.trim()) {
      toast.error(isRu ? "IP или домен обязателен" : "IP yoki domen kiritilishi shart")
      return
    }
    setSavingAlarm(true)
    try {
      const res = await fetch(`/api/cameras/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'set_alarm_server',
          params: {
            ip_or_domain: alarmForm.ip_or_domain.trim(),
            port: parseInt(alarmForm.port) || 80,
            url: alarmForm.url.trim() || '/api/v1/httppost/',
            protocol: alarmForm.protocol
          }
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || (isRu ? 'Ошибка при записи настроек' : 'Sozlamalarni yozishda xatolik'))
      toast.success(isRu ? 'Настройки успешно записаны на камеру' : 'Sozlamalar kameraga muvaffaqiyatli yozildi')
      setTimeout(() => {
        fetchAlarmSettings()
      }, 1000)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingAlarm(false)
    }
  }

  const [f, setF] = useState({
    name: '', location: '', model: '', mac_address: '', serial_number: '',
    isup_device_id: '', username: 'admin', isup_password: '', password: '',
    max_memory: '', organization_id: '', direction: '',
  })

  const backPath = cam?.organization_id ? `/devices?org=${cam.organization_id}` : '/devices'

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      const camPromise = fetch(`/api/cameras/${id}`, { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; })
      const orgsPromise = fetch('/api/organizations', { signal }).catch(err => { if (err.name === 'AbortError') return null; throw err; })

      const [camRes, orgsRes] = await Promise.all([
        camPromise,
        orgsPromise,
        new Promise(resolve => setTimeout(resolve, 800)) // Skeleton animatsiyasi chiroyli ishlashi uchun minimal vaqt
      ])
      if (signal.aborted || !camRes || !orgsRes) return

      if (camRes.status === 401) { navigate('/login'); return }
      if (camRes.status === 404) throw new Error(isRu ? 'Камера не найдена' : 'Kamera topilmadi')
      if (!camRes.ok) throw new Error(isRu ? 'Камера не загружена' : 'Kamera yuklanmadi')
      const data = await camRes.json()
      const orgList = orgsRes.ok ? await orgsRes.json() : []
      setCam(data)
      setOrgs(Array.isArray(orgList) ? orgList : [])
      setF({
        name:           data.name || '',
        location:       data.location || '',
        model:          data.model || '',
        mac_address:    data.mac_address || '',
        serial_number:  data.serial_number || '',
        isup_device_id: data.isup_device_id || '',
        username:       data.username || 'admin',
        isup_password:  data.isup_password || '',
        password:       '',
        max_memory:     data.max_memory || '',
        organization_id: data.organization_id || '',
        direction:      data.direction || '',
        webhook_target_url: data.webhook_target_url || '',
        webhook_enabled: !!data.webhook_enabled,
        webhook_picture_sending: !!data.webhook_picture_sending,
      })
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || t('devices.errLoad'))
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    }
  }, [id, navigate, t, isRu])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  useEffect(() => {
    if (cam && cam.isup_device_id) {
      fetchAlarmSettings()
    }
  }, [cam?.isup_device_id])

  const update = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!f.name.trim()) { toast.error(isRu ? "Имя камеры обязательно" : "Kamera nomi majburiy"); return }
    setSaving(true)
    const body = {
      name: f.name.trim(), location: f.location.trim() || null,
      model: f.model.trim() || null, mac_address: f.mac_address.trim() || null,
      serial_number: f.serial_number.trim() || null,
      isup_device_id: f.isup_device_id.trim() || null,
      username: f.username.trim() || null,
      isup_password: f.isup_password.trim() || null,
      max_memory: parseInt(f.max_memory) || null,
      organization_id: f.organization_id ? parseInt(f.organization_id) : null,
      direction: f.direction || '',
      webhook_target_url: f.webhook_target_url.trim() || null,
      webhook_enabled: !!f.webhook_enabled,
      webhook_picture_sending: !!f.webhook_picture_sending,
    }
    if (f.password.trim()) body.password = f.password.trim()
    try {
      const res = await fetch(`/api/cameras/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || (isRu ? 'Ошибка' : 'Xatolik'))
      toast.success(data.message || (isRu ? 'Успешно сохранено' : 'Muvaffaqiyatli saqlandi'))
      load(true)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const sendCmd = async (cmd) => {
    setCmdLoading(p => ({ ...p, [cmd]: true }))
    try {
      const res = await fetch(`/api/cameras/${id}/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, params: {} }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || (isRu ? 'Ошибка' : 'Xatolik'))
      
      let cmdMsg = ''
      if (cmd === 'open_door') {
        cmdMsg = isRu ? 'Дверь успешно открыта' : 'Eshik muvaffaqiyatli ochildi'
      } else if (cmd === 'get_device_snapshot') {
        cmdMsg = isRu ? 'Метаданные успешно синхронизированы' : 'Metadata muvaffaqiyatli sinxronlandi'
      } else if (cmd === 'sync_faces') {
        cmdMsg = isRu ? 'Лица успешно синхронизированы' : 'Yuzlar muvaffaqiyatli sinxronlandi'
      } else if (cmd === 'reboot') {
        cmdMsg = isRu ? 'Устройство перезагружено' : 'Qurilma qayta yuklandi'
      } else {
        cmdMsg = isRu ? `Команда ${cmd} выполнена` : `${cmd} bajarildi`
      }
      
      toast.success(data.message || cmdMsg)
    } catch (e) { toast.error(e.message) }
    finally { setCmdLoading(p => ({ ...p, [cmd]: false })) }
  }

  const deleteCamera = async () => {
    const ok = await confirm({
      title: isRu ? "Удаление камеры" : "Kamerani o'chirish",
      message: isRu
        ? `Вы действительно хотите безвозвратно удалить камеру "${cam?.name}" из системы? Это действие нельзя отменить.`
        : `"${cam?.name}" kamerasini tizimdan butunlay o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`,
      confirmText: isRu ? "Удалить" : "O'chirish",
      danger: true,
    })
    if (!ok) return
    try {
      await fetch(`/api/cameras/${id}`, { method: 'DELETE' })
      navigate('/devices')
    } catch { toast.error(isRu ? "Ошибка при удалении" : "O'chirishda xatolik") }
  }

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .cam-main-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
        }
        .cam-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cam-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .cam-main-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .cam-grid-2, .cam-grid-3 {
            grid-template-columns: 1fr;
          }
          .cam-grid-2 > div, .cam-grid-3 > div {
            grid-column: span 1 !important;
          }
          .cam-main-layout {
            padding: 16px 16px 60px !important;
          }
        }
      `}</style>
      <PageHero
        badge={<div style={{ width: 120, height: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />}
        title={<div style={{ width: 250, height: 32, background: 'rgba(255,255,255,0.1)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />}
        sub={<div style={{ width: 300, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />}
        backPath={backPath}
      />

      <div className="cam-main-layout" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 80px' }}>
        {/* Chap: Formalar Skeleto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
              <div style={{ width: 140, height: 12, background: 'var(--border)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
              <div style={{ width: 220, height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 24, animation: 'pulse 1.5s infinite' }} />
              <div className="cam-grid-2">
                {[1, 2, 3, 4].map(j => (
                  <div key={j}>
                    <div style={{ width: 90, height: 12, background: 'var(--border-2)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ width: '100%', height: 38, background: 'var(--surface-2)', borderRadius: 9, animation: 'pulse 1.5s infinite' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* O'ng: Sidebar Skeleto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Harakatlar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
             <div style={{ width: 140, height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {[1, 2, 3].map(k => (
                 <div key={k} style={{ width: '100%', height: 42, background: 'var(--surface-2)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
               ))}
             </div>
          </div>
          {/* Xotira */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
             <div style={{ width: 140, height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               {[1, 2, 3].map(k => (
                 <div key={k}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                     <div style={{ width: 70, height: 12, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                     <div style={{ width: 50, height: 12, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                   </div>
                   <div style={{ width: '100%', height: 6, background: 'var(--surface-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  )

  const online = !!cam?.is_online

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .cam-main-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
        }
        .cam-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cam-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .cam-main-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .cam-grid-2, .cam-grid-3 {
            grid-template-columns: 1fr;
          }
          .cam-grid-2 > div, .cam-grid-3 > div {
            grid-column: span 1 !important;
          }
          .cam-main-layout {
            padding: 16px 16px 60px !important;
          }
        }
      `}</style>

      <PageHero
        badge={isRu ? "✦ Редактирование камеры" : "✦ Kamerani Tahrirlash"}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {cam?.name || (isRu ? 'Камера' : 'Kamera')}
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 100, fontWeight: 600,
              background: online ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
              color: online ? '#4ade80' : '#f87171',
              border: `1px solid ${online ? '#4ade8038' : '#f8717138'}`,
            }}>
              {online ? 'Online' : 'Offline'}
            </span>
          </span>
        }
        sub={`MAC: ${cam?.mac_address || '—'} · Model: ${cam?.model || '—'} · ID: ${id}`}
        backPath={backPath}
        right={
          <button onClick={() => load(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 8, background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, cursor: 'pointer',
          }}>
            <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <div className="cam-main-layout" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 80px' }}>

        {/* LEFT: Form */}
        <div>
          {/* Alerts */}
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 10, padding: '10px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠ {error}
            </div>
          )}
          {/* Asosiy ma'lumotlar */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>
                {isRu ? 'Основные данные' : "Asosiy Ma'lumotlar"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>
                {isRu ? 'Профиль камеры' : 'Kamera profili'}
              </div>
            </div>
            <div className="cam-grid-2">
              <Field label={isRu ? "Имя камеры *" : "Kamera Nomi *"} span={2}>
                <input style={inp} value={f.name} onChange={update('name')} placeholder={isRu ? "Например: Главный вход" : "Masalan: Asosiy kirish"} />
              </Field>
              <Field label={isRu ? "Местоположение" : "Joylashuv"}>
                <input style={inp} value={f.location} onChange={update('location')} placeholder={isRu ? "Этаж, комната..." : "Qavat, Xona..."} />
              </Field>
              <Field label={isRu ? "Модель" : "Model"}>
                <input style={inp} value={f.model} onChange={update('model')} placeholder="DS-K1T343" list="model-list" />
                <datalist id="model-list">{MODELS.map(m => <option key={m} value={m} />)}</datalist>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {MODELS.slice(0,2).map(m => (
                    <button key={m} type="button" onClick={() => setF(p => ({ ...p, model: m }))} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer' }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Field label={isRu ? "MAC-адрес" : "MAC Manzil"}>
                <input style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} value={f.mac_address} onChange={update('mac_address')} placeholder="AA:BB:CC:11:22:33" />
              </Field>
              <Field label={isRu ? "Серийный номер" : "Seriya Raqami"}>
                <input style={{ ...inp, fontFamily: 'monospace' }} value={f.serial_number} onChange={update('serial_number')} placeholder="DS3B24123456" />
              </Field>
              <Field label={isRu ? "Организация" : "Tashkilot"} span={2}>
                <CustomSelect
                  value={f.organization_id || ''}
                  onChange={val => setF(prev => ({ ...prev, organization_id: val }))}
                  options={[
                    { value: '', label: isRu ? '— Не выбрано —' : '— Tanlanmagan —' },
                    ...orgs.map(o => ({ value: o.id, label: o.name }))
                  ]}
                  placeholder={isRu ? "Выберите организацию..." : "Tashkilotni tanlang..."}
                />
              </Field>
              <Field label={isRu ? "Направление (Вход/Выход)" : "Yo'nalish (Kirish/Chiqish)"} span={2}>
                <CustomSelect
                  value={f.direction || ''}
                  onChange={val => setF(prev => ({ ...prev, direction: val }))}
                  options={[
                    { value: '', label: isRu ? '— Не выбрано —' : '— Tanlanmagan —' },
                    { value: 'in', label: isRu ? 'Вход (Kirish)' : 'Kirish (Вход)' },
                    { value: 'out', label: isRu ? 'Выход (Chiqish)' : 'Chiqish (Выход)' }
                  ]}
                  placeholder={isRu ? "Выберите направление..." : "Yo'nalishni tanlang..."}
                />
              </Field>
            </div>
          </div>

          {/* ISUP va HTTP sozlamalari */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>
                {isRu ? 'ISUP и HTTP' : 'ISUP va HTTP'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>
                {isRu ? 'Настройки связи' : 'Aloqa sozlamalari'}
              </div>
            </div>
            <div className="cam-grid-2">
              <Field label={isRu ? "ISUP Device ID (Необязательно)" : "ISUP Device ID (Ixtiyoriy)"}>
                <input style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} value={f.isup_device_id} onChange={update('isup_device_id')} placeholder="CAM1111" />
              </Field>
              <Field label={isRu ? "ISUP Пароль *" : "ISUP Paroli *"}>
                <PwField value={f.isup_password} onChange={update('isup_password')} placeholder="facex2024" />
              </Field>
              <Field label={isRu ? "Логин камеры" : "Kamera Logini"}>
                <input style={inp} value={f.username} onChange={update('username')} placeholder="admin" />
              </Field>
              <Field label={isRu ? "Новый HTTP пароль" : "Yangi HTTP Parol"}>
                <PwField value={f.password} onChange={update('password')} placeholder={isRu ? "Пусто = не меняется" : "Bo'sh = o'zgarmaydi"} />
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                  {isRu ? 'Если оставить пустым, сохранится старый пароль.' : "Bo'sh qoldirilsa eski parol saqlanib qoladi."}
                </div>
              </Field>
              <Field label={isRu ? "Максимальный лимит памяти (кол-во лиц)" : "Maksimal xotira limiti (yuzlar soni)"} span={2}>
                <input style={inp} type="number" min="0" max="50000" value={f.max_memory} onChange={update('max_memory')} placeholder="1500" />
              </Field>
            </div>
          </div>

          {/* Read-only Metadata */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>
                {isRu ? 'Автоматические метаданные' : 'Avtomatik Metadata'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>
                {isRu ? 'Данные, обновляемые через синхронизацию' : "Sync orqali yangilanadigan ma'lumotlar"}
              </div>
            </div>
            <div className="cam-grid-3">
              <Field label={isRu ? "Прошивка" : "Firmware"}>
                <input style={inpRO} readOnly value={cam?.firmware_version || ''} />
              </Field>
              <Field label={isRu ? "Внешний IP" : "Tashqi IP"}>
                <input style={inpRO} readOnly value={cam?.external_ip || ''} />
              </Field>
              <Field label={isRu ? "Протокол" : "Protokol"}>
                <input style={inpRO} readOnly value={cam?.protocol_version || ''} />
              </Field>
              <Field label="Webhook URL" span={3}>
                <input style={inp} value={f.webhook_target_url || ''} onChange={update('webhook_target_url')} placeholder="http://94.141.85.147:8000/api/v1/httppost/" />
              </Field>
              <Field label={isRu ? "Статус Webhook" : "Webhook Holati"} span={2}>
                <CustomSelect
                  value={f.webhook_enabled ? 'true' : 'false'}
                  onChange={val => setF(prev => ({ ...prev, webhook_enabled: val === 'true' }))}
                  options={[
                    { value: 'true', label: isRu ? 'Включено (Yoqilgan)' : 'Yoqilgan (Включено)' },
                    { value: 'false', label: isRu ? 'Отключено (O\'chirilgan)' : 'O\'chirilgan (Отключено)' }
                  ]}
                  placeholder={isRu ? "Выберите статус..." : "Statusni tanlang..."}
                />
              </Field>
              <Field label={isRu ? "Отправка изображений" : "Rasm Yuborish"}>
                <CustomSelect
                  value={f.webhook_picture_sending ? 'true' : 'false'}
                  onChange={val => setF(prev => ({ ...prev, webhook_picture_sending: val === 'true' }))}
                  options={[
                    { value: 'true', label: isRu ? 'Разрешено (Ruxsat berilgan)' : 'Ruxsat berilgan (Разрешено)' },
                    { value: 'false', label: isRu ? 'Отключено (O\'chirilgan)' : 'O\'chirilgan (Отключено)' }
                  ]}
                  placeholder={isRu ? "Выберите..." : "Tanlang..."}
                />
              </Field>
            </div>
          </div>

          {/* ISAPI / Alarm Server settings via ISUP */}
          {f.isup_device_id && (
            <div style={card}>
              <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>
                    {isRu ? 'Настройки ISAPI / Alarm Server (через ISUP)' : 'ISAPI / Alarm Server Sozlamalari (ISUP orqali)'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>
                    {isRu ? 'Параметры Alarm вебхука камеры' : 'Kamera alarm webhook parametrlari'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchAlarmSettings}
                  disabled={loadingAlarm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: loadingAlarm ? 'wait' : 'pointer'
                  }}
                >
                  {loadingAlarm ? <ArrowSyncRegular style={{ animation: 'spin 1s linear infinite' }} fontSize={14} /> : <ArrowSyncRegular fontSize={14} />}
                  {isRu ? 'Считать с камеры' : "Kameradan yuklash"}
                </button>
              </div>

              {/* Joriy holat (Current state on camera) */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 9, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: alarmSummary ? 'var(--green)' : 'var(--text-4)' }} />
                  {isRu ? 'Текущее состояние на камере:' : "Kameradagi joriy holat:"}
                </div>
                {alarmSummary ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Протокол: ' : 'Protokol: '}</span>
                      <strong style={{ color: 'var(--white)' }}>{alarmSummary.webhook_protocol || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>{isRu ? 'IP / Домен: ' : 'IP / Domen: '}</span>
                      <strong style={{ color: 'var(--white)' }}>{alarmSummary.webhook_ip_or_domain || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Порт: ' : 'Port: '}</span>
                      <strong style={{ color: 'var(--white)' }}>{alarmSummary.webhook_port || '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>{isRu ? 'Состояние: ' : 'Holati: '}</span>
                      <strong style={{ color: alarmSummary.webhook_enabled ? 'var(--green)' : 'var(--red)' }}>
                        {alarmSummary.webhook_enabled ? (isRu ? 'Включено' : 'Yoqilgan') : (isRu ? 'Отключено' : 'O\'chirilgan')}
                      </strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-4)' }}>URL Path: </span>
                      <code style={{ background: 'var(--surface-3)', padding: '2px 4px', borderRadius: 4, color: 'var(--accent)', fontFamily: 'monospace' }}>
                        {alarmSummary.webhook_path || '-'}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>
                    {isRu ? 'Данные не загружены. Нажмите "Считать с камеры" для опроса устройства.' : "Ma'lumotlar yuklanmagan. Qurilmani so'rash uchun 'Kameradan yuklash' tugmasini bosing."}
                  </div>
                )}
              </div>

              {/* Tahrirlash formasi (Edit form) */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 12 }}>
                {isRu ? 'Изменить настройки' : 'Sozlamalarni o\'zgartirish'}
              </div>
              <div className="cam-grid-2" style={{ marginBottom: 14 }}>
                <Field label={isRu ? "Протокол" : "Protokol"}>
                  <CustomSelect
                    value={alarmForm.protocol}
                    onChange={val => setAlarmForm(prev => ({ ...prev, protocol: val }))}
                    options={[
                      { value: 'HTTP', label: 'HTTP' },
                      { value: 'HTTPS', label: 'HTTPS' }
                    ]}
                  />
                </Field>
                <Field label={isRu ? "IP или Домен" : "IP yoki Domen"}>
                  <input
                    style={inp}
                    value={alarmForm.ip_or_domain}
                    onChange={e => setAlarmForm(prev => ({ ...prev, ip_or_domain: e.target.value }))}
                    placeholder="192.168.1.100 yoki bioface.uz"
                  />
                </Field>
                <Field label={isRu ? "Порт" : "Port"}>
                  <input
                    style={inp}
                    type="number"
                    value={alarmForm.port}
                    onChange={e => setAlarmForm(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="8080"
                  />
                </Field>
                <Field label="URL Path">
                  <input
                    style={inp}
                    value={alarmForm.url}
                    onChange={e => setAlarmForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="/api/v1/httppost/"
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={saveAlarmSettings}
                  disabled={savingAlarm || loadingAlarm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: (savingAlarm || loadingAlarm) ? 'wait' : 'pointer',
                    opacity: (savingAlarm || loadingAlarm) ? 0.7 : 1
                  }}
                >
                  {savingAlarm ? <Spinner size="tiny" /> : <SaveRegular fontSize={14} />}
                  {isRu ? 'Записать на камеру' : 'Kameraga yozish'}
                </button>
              </div>
            </div>
          )}

          {/* Save / Cancel buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate(backPath)} style={{ padding: '10px 20px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {isRu ? 'Отмена' : 'Bekor qilish'}
            </button>
            <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 9, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? <Spinner size="tiny" /> : <SaveRegular fontSize={16} />}
              {isRu ? 'Сохранить' : 'Saqlash'}
            </button>
          </div>
        </div>

        {/* RIGHT: Commands & Danger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Kamera xotirasi */}
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 14 }}>
              {isRu ? 'Память камеры' : 'Kamera xotirasi'}
            </div>
            {[
              { lbl: isRu ? 'Лица' : 'Yuzlar', used: cam?.used_faces || 0, max: cam?.max_memory || 0 },
            ].map((m, i) => {
              const pct = m.max > 0 ? Math.min(100, Math.round(m.used / m.max * 100)) : 0
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                    <span>{m.lbl}</span>
                    <span style={{ fontWeight: 700, color: 'var(--white)' }}>{m.used} / {m.max || '?'}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? 'var(--red)' : 'var(--accent)', transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                    {pct}% {isRu ? 'использовано' : 'ishlatilgan'}
                  </div>
                </div>
              )
            })}
            <div className="cam-grid-2" style={{ marginTop: 12, gap: 8 }}>
              {[
                { lbl: isRu ? 'Сегодня' : 'Bugungi', val: cam?.events_today || 0, color: 'var(--accent)' },
                { lbl: isRu ? 'Статус онлайн' : 'Online holati', val: online ? 'Online' : 'Offline', color: online ? 'var(--green)' : 'var(--red)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.lbl}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tezkor buyruqlar */}
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 14 }}>
              {isRu ? 'Быстрые команды' : 'Tezkor Buyruqlar'}
            </div>
            <CmdBtn lbl={isRu ? "Открыть дверь" : "Eshikni ochish"} icon={<LockOpenRegular fontSize={18} />} color="var(--accent)" onClick={() => sendCmd('open_door')} loading={cmdLoading.open_door} />
            <CmdBtn lbl={isRu ? "Синхронизировать метаданные" : "Metadata sinxronlash"} icon={<ShareScreenStartRegular fontSize={18} />} onClick={() => sendCmd('get_device_snapshot')} loading={cmdLoading.get_device_snapshot} />
            <CmdBtn lbl={isRu ? "Синхронизировать лица" : "Yuzlarni sinxronlash"} icon={<ArrowSyncRegular fontSize={18} />} onClick={() => sendCmd('sync_faces')} loading={cmdLoading.sync_faces} />
            <CmdBtn lbl={isRu ? "Перезагрузка (Reboot)" : "Qayta yuklash (Reboot)"} icon={<PhoneUpdateRegular fontSize={18} />} onClick={() => sendCmd('reboot')} loading={cmdLoading.reboot} />
          </div>

          {/* Eslatma */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 10 }}>
              {isRu ? 'Примечание' : 'Eslatma'}
            </div>
            {[
              { icon: '🔗', title: 'Device ID', desc: isRu ? "Убедитесь, что Device ID совпадает с ID на камере." : "Kameradagi Device ID bilan bir xil ekanligini tekshiring." },
              { icon: '🔑', title: isRu ? 'Пароль' : 'Parol', desc: isRu ? "Если оставить пустым, сохранится старый HTTP пароль." : "Bo'sh qoldirilsa eski HTTP parol saqlanib qoladi." },
              { icon: '🔄', title: isRu ? 'Метаданные' : 'Metadata', desc: isRu ? "Серые поля обновляются автоматически при синхронизации." : "Kulrang maydonlar sync orqali avtomatik yangilanadi." },
            ].map((n, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 9, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{n.icon} {n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>{n.desc}</div>
              </div>
            ))}
          </div>

          {/* Xavfli hudud */}
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
              {isRu ? 'Опасная зона' : 'Xavfli hudud'}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 14, lineHeight: 1.5 }}>
              {isRu ? 'Полное удаление камеры из системы. Это действие нельзя отменить.' : "Kamerani tizimdan butunlay o'chirish. Bu amalni ortga qaytarib bo'lmaydi."}
            </p>
            <button onClick={deleteCamera} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: 'var(--red)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <DeleteRegular fontSize={16} /> {isRu ? 'Удалить камеру' : "Kamerani o'chirish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
