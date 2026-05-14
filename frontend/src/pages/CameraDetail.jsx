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

function CmdBtn({ label: lbl, icon, color, onClick, loading }) {
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
  const { t } = useTranslation()
  const abortRef = useRef(null)
  const confirm  = useConfirm()

  const [cam, setCam]         = useState(null)
  const [orgs, setOrgs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [spin, setSpin]       = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [cmdLoading, setCmdLoading] = useState({})

  const [f, setF] = useState({
    name: '', location: '', model: '', mac_address: '', serial_number: '',
    isup_device_id: '', username: 'admin', isup_password: '', password: '',
    max_memory: '', organization_id: '',
  })

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const [camRes, orgsRes] = await Promise.all([
        fetch(`/api/cameras/${id}`, { signal: abortRef.current.signal }),
        fetch('/api/organizations',  { signal: abortRef.current.signal }),
        new Promise(resolve => setTimeout(resolve, 800)) // Skeleton animatsiyasi chiroyli ishlashi uchun minimal vaqt
      ])
      if (camRes.status === 401) { navigate('/login'); return }
      if (camRes.status === 404) throw new Error('Kamera topilmadi')
      if (!camRes.ok) throw new Error('Kamera yuklanmadi')
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
      })
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || t('devices.errLoad'))
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    }
  }, [id, navigate, t])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  const update = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    if (!f.name.trim()) { setError("Kamera nomi majburiy"); return }
    setSaving(true); setError(''); setSuccess('')
    const body = {
      name: f.name.trim(), location: f.location.trim() || null,
      model: f.model.trim() || null, mac_address: f.mac_address.trim() || null,
      serial_number: f.serial_number.trim() || null,
      isup_device_id: f.isup_device_id.trim() || null,
      username: f.username.trim() || null,
      isup_password: f.isup_password.trim() || null,
      max_memory: parseInt(f.max_memory) || null,
      organization_id: f.organization_id ? parseInt(f.organization_id) : null,
    }
    if (f.password.trim()) body.password = f.password.trim()
    try {
      const res = await fetch(`/api/cameras/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Xatolik')
      setSuccess(data.message || 'Muvaffaqiyatli saqlandi')
      load(true)
    } catch (e) { setError(e.message) }
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
      if (!res.ok) throw new Error(data.detail || 'Xatolik')
      setSuccess(data.message || `${cmd} bajarildi`)
    } catch (e) { setError(e.message) }
    finally { setCmdLoading(p => ({ ...p, [cmd]: false })) }
  }

  const deleteCamera = async () => {
    const ok = await confirm({
      title: `Kamerani o'chirish`,
      message: `"${cam?.name}" kamerasini tizimdan butunlay o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`,
      confirmText: `O'chirish`,
      danger: true,
    })
    if (!ok) return
    try {
      await fetch(`/api/cameras/${id}`, { method: 'DELETE' })
      navigate('/devices')
    } catch { setError("O'chirishda xatolik") }
  }

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={<div style={{ width: 120, height: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />}
        title={<div style={{ width: 250, height: 32, background: 'rgba(255,255,255,0.1)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />}
        sub={<div style={{ width: 300, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />}
        backPath="/devices"
      />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Chap: Formalar Skeleto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
              <div style={{ width: 140, height: 12, background: 'var(--border)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
              <div style={{ width: 220, height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 24, animation: 'pulse 1.5s infinite' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  )

  const online = !!cam?.is_online
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>

      <PageHero
        badge="✦ Kamerani Tahrirlash"
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {cam?.name || 'Kamera'}
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
        backPath="/devices"
        right={
          <button onClick={() => load(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 8, background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, cursor: 'pointer',
          }}>
            <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
            Yangilash
          </button>
        }
      />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* LEFT: Form */}
        <div>
          {/* Alerts */}
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 10, padding: '10px 16px', color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)', borderRadius: 10, padding: '10px 16px', color: 'var(--green)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              ✓ {success}
            </div>
          )}

          {/* Asosiy ma'lumotlar */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>Asosiy Ma'lumotlar</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>Kamera profili</div>
            </div>
            <div style={grid2}>
              <Field label="Kamera Nomi *" span={2}>
                <input style={inp} value={f.name} onChange={update('name')} placeholder="Masalan: Asosiy kirish" />
              </Field>
              <Field label="Joylashuv">
                <input style={inp} value={f.location} onChange={update('location')} placeholder="Qavat, Xona..." />
              </Field>
              <Field label="Model">
                <input style={inp} value={f.model} onChange={update('model')} placeholder="DS-K1T343" list="model-list" />
                <datalist id="model-list">{MODELS.map(m => <option key={m} value={m} />)}</datalist>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {MODELS.slice(0,2).map(m => (
                    <button key={m} type="button" onClick={() => setF(p => ({ ...p, model: m }))} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer' }}>{m}</button>
                  ))}
                </div>
              </Field>
              <Field label="MAC Manzil">
                <input style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} value={f.mac_address} onChange={update('mac_address')} placeholder="AA:BB:CC:11:22:33" />
              </Field>
              <Field label="Seriya Raqami">
                <input style={{ ...inp, fontFamily: 'monospace' }} value={f.serial_number} onChange={update('serial_number')} placeholder="DS3B24123456" />
              </Field>
              <Field label="Tashkilot" span={2}>
                <CustomSelect
                  value={f.organization_id || ''}
                  onChange={val => setF(prev => ({ ...prev, organization_id: val }))}
                  options={[
                    { value: '', label: '— Tanlanmagan —' },
                    ...orgs.map(o => ({ value: o.id, label: o.name }))
                  ]}
                  placeholder="Tashkilotni tanlang..."
                />
              </Field>
            </div>
          </div>

          {/* ISUP va HTTP sozlamalari */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>ISUP va HTTP</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>Aloqa sozlamalari</div>
            </div>
            <div style={grid2}>
              <Field label="ISUP Device ID (Ixtiyoriy)">
                <input style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} value={f.isup_device_id} onChange={update('isup_device_id')} placeholder="CAM1111" />
              </Field>
              <Field label="ISUP Paroli *">
                <PwField value={f.isup_password} onChange={update('isup_password')} placeholder="facex2024" />
              </Field>
              <Field label="Kamera Logini">
                <input style={inp} value={f.username} onChange={update('username')} placeholder="admin" />
              </Field>
              <Field label="Yangi HTTP Parol">
                <PwField value={f.password} onChange={update('password')} placeholder="Bo'sh = o'zgarmaydi" />
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>Bo'sh qoldirilsa eski parol saqlanib qoladi.</div>
              </Field>
              <Field label="Maksimal xotira limiti (yuzlar soni)" span={2}>
                <input style={inp} type="number" min="0" max="50000" value={f.max_memory} onChange={update('max_memory')} placeholder="1500" />
              </Field>
            </div>
          </div>

          {/* Read-only Metadata */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 4 }}>Avtomatik Metadata</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>Sync orqali yangilanadigan ma'lumotlar</div>
            </div>
            <div style={grid3}>
              <Field label="Firmware">
                <input style={inpRO} readOnly value={cam?.firmware_version || ''} />
              </Field>
              <Field label="Tashqi IP">
                <input style={inpRO} readOnly value={cam?.external_ip || ''} />
              </Field>
              <Field label="Protokol">
                <input style={inpRO} readOnly value={cam?.protocol_version || ''} />
              </Field>
              <Field label="Webhook URL" span={3}>
                <input style={inpRO} readOnly value={cam?.webhook_target_url || ''} />
              </Field>
              <Field label="Webhook Holati" span={2}>
                <input style={inpRO} readOnly value={cam?.webhook_enabled ? 'Yoqilgan' : "O'chiq"} />
              </Field>
              <Field label="Rasm Yuborish">
                <input style={inpRO} readOnly value={cam?.webhook_picture_sending ? 'Ruxsat berilgan' : "O'chirilgan"} />
              </Field>
            </div>
          </div>

          {/* Save / Cancel buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/devices')} style={{ padding: '10px 20px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Bekor qilish
            </button>
            <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 9, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? <Spinner size="tiny" /> : <SaveRegular fontSize={16} />}
              Saqlash
            </button>
          </div>
        </div>

        {/* RIGHT: Commands & Danger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Kamera xotirasi */}
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 14 }}>Kamera xotirasi</div>
            {[
              { lbl: 'Yuzlar', used: cam?.used_faces || 0, max: cam?.max_memory || 0 },
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
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{pct}% ishlatilgan</div>
                </div>
              )
            })}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { lbl: 'Bugungi', val: cam?.events_today || 0, color: 'var(--accent)' },
                { lbl: 'Online holati', val: online ? 'Online' : 'Offline', color: online ? 'var(--green)' : 'var(--red)' },
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 14 }}>Tezkor Buyruqlar</div>
            <CmdBtn lbl="Eshikni ochish" icon={<LockOpenRegular fontSize={18} />} color="var(--accent)" onClick={() => sendCmd('open_door')} loading={cmdLoading.open_door} />
            <CmdBtn lbl="Metadata sinxronlash" icon={<ShareScreenStartRegular fontSize={18} />} onClick={() => sendCmd('get_device_snapshot')} loading={cmdLoading.get_device_snapshot} />
            <CmdBtn lbl="Yuzlarni sinxronlash" icon={<ArrowSyncRegular fontSize={18} />} onClick={() => sendCmd('sync_faces')} loading={cmdLoading.sync_faces} />
            <CmdBtn lbl="Qayta yuklash (Reboot)" icon={<PhoneUpdateRegular fontSize={18} />} onClick={() => sendCmd('reboot')} loading={cmdLoading.reboot} />
          </div>

          {/* Eslatma */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', marginBottom: 10 }}>Eslatma</div>
            {[
              { icon: '🔗', title: 'Device ID', desc: "Kameradagi Device ID bilan bir xil ekanligini tekshiring." },
              { icon: '🔑', title: 'Parol', desc: "Bo'sh qoldirilsa eski HTTP parol saqlanib qoladi." },
              { icon: '🔄', title: 'Metadata', desc: "Kulrang maydonlar sync orqali avtomatik yangilanadi." },
            ].map((n, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 9, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{n.icon} {n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>{n.desc}</div>
              </div>
            ))}
          </div>

          {/* Xavfli hudud */}
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>Xavfli hudud</div>
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 14, lineHeight: 1.5 }}>Kamerani tizimdan butunlay o'chirish. Bu amalni ortga qaytarib bo'lmaydi.</p>
            <button onClick={deleteCamera} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: 'var(--red)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <DeleteRegular fontSize={16} /> Kamerani o'chirish
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
