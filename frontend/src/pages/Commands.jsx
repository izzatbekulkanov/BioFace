import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CodeRegular, BuildingRegular, CameraRegular, LockClosedRegular, FlashRegular,
  Wifi4Regular, PersonBoardRegular, CalendarLtrRegular, ArrowSyncRegular,
  LockOpenRegular, PowerRegular, AlertRegular, ClockRegular, SendRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'

function escapeHtml(value) {
  return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
}

export default function Commands() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isRu = i18n.language === 'ru'

  const [loading, setLoading] = useState(true)
  const [cameras, setCameras] = useState([])
  const [orgs, setOrgs] = useState([])
  const [error, setError] = useState('')
  const [spin, setSpin] = useState(false)

  const query = new URLSearchParams(location.search)
  const initialOrg = query.get('org') || ''
  const initialCam = query.get('cam') || ''

  const [selectedOrg, setSelectedOrg] = useState(initialOrg)
  const [selectedCamId, setSelectedCamId] = useState(initialCam)
  const [selectedCmd, setSelectedCmd] = useState('')
  const [terminalOut, setTerminalOut] = useState([])
  const [sending, setSending] = useState(false)
  const termEndRef = useRef(null)

  const abortRef = useRef(null)

  // Demo user permissions - fetch from /api/users/me if needed, assuming Full for now
  const CAMERA_COMMAND_ALLOWED = true 

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const isFirstLoad = cameras.length === 0 && !animate
      const fetchPromise = Promise.all([
        fetch('/api/cameras', { signal: abortRef.current.signal }),
        fetch('/api/organizations', { signal: abortRef.current.signal })
      ])
      
      const [camRes, orgRes] = isFirstLoad 
        ? await Promise.all([fetchPromise, new Promise(r => setTimeout(r, 800))]).then(arr => arr[0])
        : await fetchPromise

      if (camRes.status === 401 || orgRes.status === 401) { navigate('/login'); return }
      if (!camRes.ok) throw new Error('Kameralar yuklanmadi')
      
      const cdata = await camRes.json()
      const odata = orgRes.ok ? await orgRes.json() : []

      setCameras(Array.isArray(cdata) ? cdata : cdata.items || [])
      setOrgs(Array.isArray(odata) ? odata : odata.items || [])

      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || 'Xatolik yuz berdi')
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    }
  }, [navigate, cameras.length])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  useEffect(() => {
    if (termEndRef.current) {
      termEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalOut])

  const filteredCams = selectedOrg ? cameras.filter(c => String(c.organization_id) === selectedOrg) : cameras
  const selectedCam = cameras.find(c => String(c.id) === selectedCamId)

  const isCameraOnline = (cam) => {
    if (!cam) return false
    const val = cam.is_online
    if (typeof val === 'boolean') return val
    if (val === null || val === undefined) return false
    return ['1', 'true', 'yes', 'on', 'online', 'connected', 'active', 'registered'].includes(String(val).trim().toLowerCase())
  }

  const online = isCameraOnline(selectedCam)
  const canSend = CAMERA_COMMAND_ALLOWED && selectedCam && online && selectedCmd

  const logTerminal = (htmlStr) => {
    const time = new Date().toLocaleTimeString('uz-UZ', { hour12: false })
    setTerminalOut(prev => [...prev, { time, html: htmlStr }])
  }

  const sendCommand = async () => {
    if (!canSend) return
    setSending(true)
    const cmd = selectedCmd
    const camName = selectedCam.name

    logTerminal(`<span style="color: #60a5fa">$ API > ${camName} qutisiga '${cmd}' buyrug'i yuborilmoqda...</span>`)

    try {
      const res = await fetch(`/api/cameras/${selectedCam.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      })
      const data = await res.json()

      if (res.ok) {
        const rawTransport = String(data.transport || 'isup_redis').toLowerCase()
        const transport = rawTransport === 'database'
          ? '<span style="background: rgba(146,64,14,0.4); color: #fcd34d; padding: 2px 6px; border-radius: 4px; font-size: 11px">DB</span>'
          : '<span style="background: rgba(6,78,59,0.4); color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-size: 11px">ISUP</span>'
        
        logTerminal(`<span style="color: #34d399">✓ ${transport} ${data.message}</span>`)

        if (data.today_attendance) {
          const ta = data.today_attendance
          logTerminal(`
            <div style="margin-top: 8px; background: rgba(6,78,59,0.2); border: 1px solid rgba(5,150,105,0.3); padding: 12px; border-radius: 8px; font-size: 12px; color: #d1fae5">
              <div style="font-weight: 600; color: #6ee7b7; margin-bottom: 4px">Bugungi attendance hisoboti</div>
              <div>Sana: ${escapeHtml(ta.date || '-')}</div>
              <div>Jami: ${escapeHtml(ta.count ?? 0)} ta</div>
              <div>Known: ${escapeHtml(ta.known_count ?? 0)} ta</div>
              <div>Unknown: ${escapeHtml(ta.unknown_count ?? 0)} ta</div>
              <div>Oxirgi kirish: ${escapeHtml(ta.latest_timestamp || '-')}</div>
            </div>
          `)
        }
        if (data.response !== undefined) {
          const pretty = escapeHtml(JSON.stringify(data.response, null, 2))
          logTerminal(`<span style="color: #67e8f9">↳ Javob:</span><pre style="margin-top: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-size: 11px; color: #e2e8f0; white-space: pre-wrap">${pretty}</pre>`)
        }
      } else {
        logTerminal(`<span style="color: #f87171">✗ Xatolik: ${data.detail || "Noma'lum xato"}</span>`)
      }
    } catch (e) {
      logTerminal(`<span style="color: #f87171">! Tarmoq xatosi: ${e.message}</span>`)
    } finally {
      setSending(false)
    }
  }

  const commandsList = [
    { id: 'ping', icon: <Wifi4Regular fontSize={24} />, title: isRu ? 'Проверить соединение' : 'Ulanishni tekshirish', desc: isRu ? 'Ping запрос к устройству' : 'Ping orqali tezkor aloqani tekshiradi' },
    { id: 'get_face_count', icon: <PersonBoardRegular fontSize={24} />, title: isRu ? 'Проверить количество лиц' : 'Yuzlar sonini tekshirish', desc: isRu ? 'Количество зарегистрированных лиц' : 'Shaxslar sonini o\'qiydi' },
    { id: 'get_today_attendance_count', icon: <CalendarLtrRegular fontSize={24} />, title: isRu ? 'Количество посещений за сегодня' : 'Bugungi attendance soni', desc: isRu ? 'Показывает записи, полученные через HTTP push' : 'HTTP push orqali kelgan yozuvlarni ko\'rsatadi' },
    { id: 'sync_faces', icon: <ArrowSyncRegular fontSize={24} />, title: isRu ? 'Синхронизировать лица' : 'Yuzlarni sinxronlash', desc: isRu ? 'Загрузить новые лица из базы' : 'Yangi yuzlarni yuklaydi' },
    { id: 'open_door', icon: <LockOpenRegular fontSize={24} />, title: isRu ? 'Открыть дверь' : 'Eshikni ochish', desc: isRu ? 'Открыть турникет на 5 секунд' : '5 soniyaga qulfni ochadi' },
    { id: 'reboot', icon: <PowerRegular fontSize={24} />, title: isRu ? 'Перезагрузить камеру' : 'Qayta ishga tushirish', desc: isRu ? 'Полная перезагрузка' : 'To\'liq reboot' },
    { id: 'get_alarm_server', icon: <AlertRegular fontSize={24} />, title: isRu ? 'Настройки Webhook/Event' : 'Webhook/Event sozlamalari', desc: isRu ? 'Показать куда камера отправляет события' : 'Kamera hodisalarni qayerga yuborishini ko\'rish' },
    { id: 'set_tashkent_timezone', icon: <ClockRegular fontSize={24} />, title: isRu ? 'Синхронизировать время камеры' : 'Kamera vaqtini sinxronlash', desc: isRu ? 'Устанавливает Asia/Tashkent и текущее локальное время' : 'Asia/Tashkent va joriy mahalliy vaqtni o\'rnatadi' }
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${isRu ? 'Терминал' : 'Terminal'}`}
        title={isRu ? 'Удалённое управление' : 'Kameraga Buyruqlar'}
        sub={isRu ? 'Удалённое управление и диагностика камер из единой операторской панели.' : 'Kameralarni yagona operator panelidan masofadan boshqarish va diagnostika qilish.'}
        right={
          <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <ArrowSyncRegular fontSize={16} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
            {t('dashboard.refresh')}
          </button>
        }
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', display: 'flex', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface-2)', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: '60%', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ height: 24, width: '40%', background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, height: 400, padding: 24 }}>
                 <div style={{ width: 140, height: 16, background: 'var(--border-2)', borderRadius: 4, marginBottom: 24, animation: 'pulse 1.5s infinite' }} />
                 <div style={{ width: '100%', height: 40, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
                 <div style={{ width: '100%', height: 40, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 24, animation: 'pulse 1.5s infinite' }} />
                 <div style={{ width: '100%', height: 200, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, height: 400 }}></div>
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '16px 20px', color: 'var(--red)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 16, top: 16, color: 'var(--text-5)' }}><CameraRegular fontSize={32} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>Kameralar</div>
                <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{cameras.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>Buyruq uchun mavjud</div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 16, top: 16, color: 'var(--text-5)' }}><BuildingRegular fontSize={32} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>Tashkilotlar</div>
                <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{orgs.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>Filtrlash uchun mavjud</div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 16, top: 16, color: 'var(--text-5)' }}><LockClosedRegular fontSize={32} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>Ruxsat</div>
                <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{CAMERA_COMMAND_ALLOWED ? 'Full' : 'Read'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>{CAMERA_COMMAND_ALLOWED ? "Buyruqlar yoqilgan" : "Faqat ko'rish"}</div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 16, top: 16, color: 'var(--text-5)' }}><FlashRegular fontSize={32} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>Amallar</div>
                <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{commandsList.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>Standart operator buyruqlari</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' }}>
              
              {/* Left Column: Form & Commands */}
              <div style={{ flex: '1 1 400px', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                  
                  <div style={{ marginBottom: 20 }}>
                     <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>Tashkilot</label>
                     <select value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setSelectedCamId(''); }} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text-1)', padding: '10px 14px', borderRadius: 8, outline: 'none' }}>
                       <option value="">Barcha tashkilotlar</option>
                       {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                     </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                     <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>Kamera</label>
                     <select value={selectedCamId} onChange={e => setSelectedCamId(e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text-1)', padding: '10px 14px', borderRadius: 8, outline: 'none' }}>
                       <option value="">{selectedOrg ? 'Kamerani tanlang...' : 'Avval tashkilotni tanlang...'}</option>
                       {filteredCams.map(c => <option key={c.id} value={c.id}>{c.name} ({c.isup_device_id || c.mac_address || "ID yo'q"})</option>)}
                     </select>
                  </div>

                  {selectedCam && (
                    <div style={{ marginTop: 20, padding: '16px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontWeight: 600 }}>{selectedCam.name}</div>
                        {online 
                          ? <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Online</div>
                          : <div style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Offline</div>
                        }
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-4)', marginBottom: 6 }}>
                        <span>Device ID</span>
                        <span style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>{selectedCam.isup_device_id || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-4)', marginBottom: 6 }}>
                        <span>MAC / Seriya</span>
                        <span style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>{selectedCam.mac_address || '—'}</span>
                      </div>
                      {!online && (
                        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12, borderRadius: 6, border: '1px solid var(--red-bd)' }}>
                          Kamera offline. Buyruq yuborish bloklangan.
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 12 }}>Qurilma amallari</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                      {commandsList.map(cmd => {
                        const isSelected = selectedCmd === cmd.id
                        return (
                          <label key={cmd.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px',
                            background: isSelected ? 'var(--accent-bg)' : 'var(--bg)',
                            border: `1px solid ${isSelected ? 'var(--accent-bd)' : 'var(--border-2)'}`,
                            borderRadius: 8, cursor: selectedCamId && online ? 'pointer' : 'not-allowed',
                            opacity: selectedCamId && online ? 1 : 0.5,
                            transition: 'all 0.2s'
                          }}>
                            <input 
                              type="radio" name="cmd" value={cmd.id} 
                              checked={isSelected}
                              disabled={!selectedCamId || !online}
                              onChange={() => setSelectedCmd(cmd.id)}
                              style={{ marginTop: 4, accentColor: 'var(--accent)' }}
                            />
                            <div style={{ color: isSelected ? 'var(--accent)' : 'var(--text-4)' }}>{cmd.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-1)' }}>{cmd.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{cmd.desc}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <button 
                    onClick={sendCommand} 
                    disabled={!canSend || sending}
                    style={{ 
                      width: '100%', padding: '12px', borderRadius: 8, background: 'var(--accent)', color: '#fff', 
                      fontSize: 14, fontWeight: 600, border: 'none', marginTop: 24, cursor: canSend && !sending ? 'pointer' : 'not-allowed',
                      opacity: canSend && !sending ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    {sending ? <ArrowSyncRegular style={{ animation: 'spin 1s linear infinite' }} /> : <SendRegular />}
                    {sending ? 'Yuborilmoqda...' : 'Tasdiqlash va yuborish'}
                  </button>

                </div>
              </div>

              {/* Right Column: Terminal */}
              <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
                <div style={{ 
                  background: '#020617', border: '1px solid var(--border)', borderRadius: 8, 
                  display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ marginLeft: 16, fontSize: 12, fontFamily: 'monospace', color: '#94a3b8' }}>terminal@bioface-server:~</span>
                    </div>
                    <button onClick={() => setTerminalOut([])} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', outline: 'none' }}>Tozalash</button>
                  </div>
                  
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>
                    {terminalOut.length === 0 ? (
                      <div style={{ color: '#64748b' }}>Buyruq natijalari bu yerda ko'rinadi...</div>
                    ) : (
                      terminalOut.map((line, i) => (
                        <div key={i} style={{ marginBottom: 8, wordBreak: 'break-word' }}>
                          <span style={{ color: '#64748b', marginRight: 8 }}>[{line.time}]</span>
                          <span dangerouslySetInnerHTML={{ __html: line.html }} />
                        </div>
                      ))
                    )}
                    <div ref={termEndRef} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
