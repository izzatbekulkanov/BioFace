import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner, Tooltip } from '@fluentui/react-components'
import {
  CameraRegular, ArrowSyncRegular, AddRegular,
  Wifi4Regular, WifiOffRegular, DeleteRegular,
  SearchRegular, FilterRegular, BuildingRegular,
  ClockRegular, PersonRegular, MoreHorizontalRegular, CodeRegular
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useConfirm } from '../components/ConfirmDialog'

// Module-level cache: sahifadan chiqib qaytganda darhol ko'rinadi
let _camerasCache = []
let _cacheTime = 0
const CACHE_TTL = 30_000 // 30 soniya

function StatusDot({ online }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600,
      color: online ? 'var(--green)' : 'var(--red)',
      background: online ? 'var(--green-bg)' : 'var(--red-bg)',
      border: `1px solid ${online ? 'var(--green-bd)' : 'var(--red-bd)'}`,
      borderRadius: 100, padding: '2px 9px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--white)', letterSpacing: -0.5 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      </div>
    </div>
  )
}

export default function Devices() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const confirm  = useConfirm()
  // Cache bo'lsa darhol ko'rsatamiz (stale-while-revalidate pattern)
  const [cameras, setCameras]   = useState(_camerasCache)
  const [loading, setLoading]   = useState(_camerasCache.length === 0)
  const [error, setError]       = useState('')
  const [spin, setSpin]         = useState(false)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [deleting, setDeleting] = useState(null)
  const abortRef = useRef(null)

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    // Oldingi so'rovni bekor qilamiz
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const isFirstLoad = _camerasCache.length === 0 && !animate
      const fetchPromise = fetch('/api/cameras', { signal: abortRef.current.signal })
      
      const res = isFirstLoad 
        ? await Promise.all([fetchPromise, new Promise(r => setTimeout(r, 800))]).then(arr => arr[0])
        : await fetchPromise
        
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error()
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.items || []
      _camerasCache = list
      _cacheTime = Date.now()
      setCameras(list)
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    } catch (e) {
      if (e.name === 'AbortError') return // finally blockdan qutulish uchun pastdagi setLoading ni tepaga oldik
      setError(t('devices.errLoad'))
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    }
  }, [navigate, t])

  useEffect(() => {
    // Cache yangi bo'lsa darhol ko'rsatamiz, orqa fonda yangilaymiz
    const stale = Date.now() - _cacheTime > CACHE_TTL
    if (stale) load()
    else load() // har doim background refresh
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  const handleDelete = async (cam) => {
    const ok = await confirm({
      title: t('devices.deleteTitle', { name: cam.name }),
      message: t('devices.deleteMsg', { name: cam.name }),
      confirmText: t('devices.deleteCam'),
      danger: true,
    })
    if (!ok) return
    setDeleting(cam.id)
    try {
      const res = await fetch(`/api/cameras/${cam.id}`, { method: 'DELETE' })
      if (res.ok) setCameras(c => c.filter(x => x.id !== cam.id))
    } catch {}
    setDeleting(null)
  }

  const online  = cameras.filter(c => c.is_online).length
  const offline = cameras.filter(c => !c.is_online).length

  const filtered = cameras.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q) || c.mac_address?.toLowerCase().includes(q) || c.model?.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || (filter === 'online' && c.is_online) || (filter === 'offline' && !c.is_online)
    return matchSearch && matchFilter
  })

  const fmtDate = (iso) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${t('devices.title')}`}
        title={t('devices.heading')}
        sub={t('devices.sub')}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
              {t('devices.refresh')}
            </button>
            <button onClick={() => navigate('/devices/add')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <AddRegular fontSize={15} />
              {t('devices.add')}
            </button>
          </div>
        }
      />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 80px' }}>

        {/* ── LOADING STATE: Skeleton ── */}
        {loading && (
          <>
            {/* Skeleton stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', display: 'flex', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, width: '50%', background: 'var(--surface-2)', borderRadius: 5, marginBottom: 10, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ height: 22, width: '35%', background: 'var(--surface-2)', borderRadius: 5, animation: 'pulse 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Skeleton camera cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-2)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--surface-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 14, width: '60%', background: 'var(--surface-2)', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      <div style={{ height: 10, width: '30%', background: 'var(--surface-2)', borderRadius: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[70,50,80,55].map((w,j) => (
                      <div key={j} style={{ height: 10, width: `${w}%`, background: 'var(--surface-2)', borderRadius: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── LOADED STATE ── */}
        {!loading && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              <StatCard icon={<CameraRegular fontSize={18} />}  label={t('devices.total')}   value={cameras.length} color="#0078d4" />
              <StatCard icon={<Wifi4Regular fontSize={18} />}   label={t('devices.online')}  value={online}         color="#4ade80" />
              <StatCard icon={<WifiOffRegular fontSize={18} />} label={t('devices.offline')} value={offline}        color="#f87171" />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <SearchRegular fontSize={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('devices.search')}
                  style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 3, gap: 2 }}>
                {['all', 'online', 'offline'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: filter === f ? 'var(--accent)' : 'transparent', color: filter === f ? '#fff' : 'var(--text-3)', fontSize: 12.5, fontWeight: filter === f ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {t(`devices.filter_${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 10, padding: '14px 18px', color: 'var(--red)', fontSize: 13.5 }}>{error}</div>
            )}

            {/* Empty */}
            {!error && filtered.length === 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
                <CameraRegular fontSize={40} color="var(--text-5)" />
                <p style={{ color: 'var(--text-4)', marginTop: 12, fontSize: 14 }}>{t('devices.empty')}</p>
              </div>
            )}

            {/* Camera grid */}
            {!error && filtered.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {filtered.map(cam => (
                  <div key={cam.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-bd)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border-2)' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: cam.is_online ? 'var(--green-bg)' : 'var(--surface-2)', border: `1px solid ${cam.is_online ? 'var(--green-bd)' : 'var(--border-3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cam.is_online ? 'var(--green)' : 'var(--text-4)' }}>
                        <CameraRegular fontSize={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/devices/${cam.id}`)}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.name}</div>
                        <StatusDot online={cam.is_online} />
                      </div>
                      <Tooltip content={t('devices.details')} relationship="label">
                        <button onClick={() => navigate(`/devices/${cam.id}`)} style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border-3)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: -6 }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text-1)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-3)' }}
                        >
                          <MoreHorizontalRegular fontSize={14} />
                        </button>
                      </Tooltip>
                      <Tooltip content={t('nav.commands', 'Buyruq berish')} relationship="label">
                        <button onClick={() => navigate(`/commands?cam=${cam.id}&org=${cam.organization_id}`)} style={{ width: 30, height: 30, borderRadius: 7, background: 'transparent', border: '1px solid transparent', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: -6 }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent-bd)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          <CodeRegular fontSize={14} />
                        </button>
                      </Tooltip>
                      <Tooltip content={t('devices.delete')} relationship="label">
                        <button onClick={() => handleDelete(cam)} disabled={deleting === cam.id} style={{ width: 30, height: 30, borderRadius: 7, background: 'transparent', border: '1px solid transparent', color: 'var(--text-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.borderColor = 'var(--red-bd)'; e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
                        >
                          {deleting === cam.id ? <Spinner size="tiny" /> : <DeleteRegular fontSize={14} />}
                        </button>
                      </Tooltip>
                    </div>
                    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {[
                        { icon: <BuildingRegular fontSize={13} />, label: t('devices.location'), val: cam.location || '—' },
                        { icon: <MoreHorizontalRegular fontSize={13} />, label: t('devices.model'), val: cam.model || '—' },
                        { icon: <MoreHorizontalRegular fontSize={13} />, label: 'MAC', val: cam.mac_address || '—' },
                        { icon: <ClockRegular fontSize={13} />, label: t('devices.lastSeen'), val: fmtDate(cam.last_seen_at) },
                      ].map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-4)', fontSize: 12, flexShrink: 0 }}>{row.icon} {row.label}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontFamily: row.label === 'MAC' ? 'monospace' : 'inherit', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{row.val}</div>
                        </div>
                      ))}
                    </div>
                    {(cam.used_faces || cam.max_memory) && (
                      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{t('devices.faces')}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{cam.used_faces || 0} / {cam.max_memory || '?'}</span>
                        </div>
                        {cam.max_memory > 0 && (
                          <div style={{ height: 3, background: 'var(--border)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, Math.round(((cam.used_faces || 0) / cam.max_memory) * 100))}%`, background: 'var(--accent)', borderRadius: 99 }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  )
}

