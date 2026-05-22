import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { invalidate } from '../lib/dataCache'

// Module-level cache: sahifadan chiqib qaytganda darhol ko'rinadi
let _camerasCache = []
let _cacheTime = 0
const CACHE_TTL = 60_000 // 1 daqiqa

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
  const [searchParams, setSearchParams] = useSearchParams()
  const orgParam = searchParams.get('org') // null, "none" or string number

  // Cache bo'lsa darhol ko'rsatamiz (stale-while-revalidate pattern)
  const [cameras, setCameras]   = useState(_camerasCache)
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading]   = useState(_camerasCache.length === 0)
  const [error, setError]       = useState('')
  const [spin, setSpin]         = useState(false)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [deleting, setDeleting] = useState(null)
  const abortRef = useRef(null)

  const isRu = i18n.language === 'ru'

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    // Oldingi so'rovni bekor qilamiz
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const isFirstLoad = _camerasCache.length === 0 && !animate
      const camsPromise = fetch('/api/cameras', { signal: abortRef.current.signal })
      const orgsPromise = fetch('/api/organizations', { signal: abortRef.current.signal })
      
      const [camsRes, orgsRes] = isFirstLoad 
        ? await Promise.all([camsPromise, orgsPromise, new Promise(r => setTimeout(r, 800))]).then(arr => [arr[0], arr[1]])
        : await Promise.all([camsPromise, orgsPromise])
        
      if (camsRes.status === 401 || orgsRes.status === 401) { navigate('/login'); return }
      if (!camsRes.ok || !orgsRes.ok) throw new Error()
      
      const camsData = await camsRes.json()
      const orgsData = await orgsRes.json()
      
      const list = Array.isArray(camsData) ? camsData : camsData.items || []
      _camerasCache = list
      _cacheTime = Date.now()
      
      setCameras(list)
      setOrganizations(Array.isArray(orgsData) ? orgsData : [])
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(t('devices.errLoad'))
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 500)
    }
  }, [navigate, t])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  useEffect(() => {
    if (orgParam && orgParam !== 'none' && filter === 'unassigned') {
      setFilter('all')
    }
  }, [orgParam, filter])

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
      if (res.ok) {
        setCameras(c => c.filter(x => x.id !== cam.id))
        _camerasCache = _camerasCache.filter(x => x.id !== cam.id)
        invalidate('/api/cameras')
      }
    } catch {}
    setDeleting(null)
  }

  // Group calculations
  const selectedCams = orgParam 
    ? (orgParam === 'none' ? cameras.filter(c => !c.organization_id) : cameras.filter(c => String(c.organization_id) === orgParam))
    : cameras

  const online  = selectedCams.filter(c => c.is_online).length
  const offline = selectedCams.filter(c => !c.is_online).length
  const totalCount = selectedCams.length

  // Filtered cameras for list view (within selected organization if orgParam set)
  const filtered = selectedCams.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q) || c.mac_address?.toLowerCase().includes(q) || c.model?.toLowerCase().includes(q)
    const matchFilter = filter === 'all' 
      || (filter === 'online' && c.is_online) 
      || (filter === 'offline' && !c.is_online)
      || (filter === 'unassigned' && !c.organization_id)
    return matchSearch && matchFilter
  })

  // Organization groups for dashboard view
  const orgGroups = []
  
  organizations.forEach(org => {
    const orgCams = cameras.filter(c => c.organization_id === org.id)
    
    // Filter cameras inside organization by search and status filter
    const filteredOrgCams = orgCams.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q) || c.mac_address?.toLowerCase().includes(q) || c.model?.toLowerCase().includes(q)
      const matchFilter = filter === 'all' 
        || (filter === 'online' && c.is_online) 
        || (filter === 'offline' && !c.is_online)
        || (filter === 'unassigned' && !c.organization_id)
      return matchSearch && matchFilter
    })
    
    // Check if matching search criteria
    const qStr = search.toLowerCase()
    const matchesOrgName = !qStr || org.name.toLowerCase().includes(qStr)
    const matchesCameras = filteredOrgCams.length > 0 || (qStr && orgCams.some(c => c.name.toLowerCase().includes(qStr)))
    const matchesStatus = filter === 'all' || filteredOrgCams.length > 0
    
    if ((matchesOrgName || matchesCameras) && matchesStatus) {
      const onlineCount = orgCams.filter(c => c.is_online).length
      const offlineCount = orgCams.filter(c => !c.is_online).length
      orgGroups.push({
        id: org.id,
        name: org.name,
        cameras: orgCams,
        filteredCameras: filteredOrgCams,
        online: onlineCount,
        offline: offlineCount,
      })
    }
  })
  
  // Group cameras without organization
  const noOrgCams = cameras.filter(c => !c.organization_id)
  const filteredNoOrgCams = noOrgCams.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q) || c.mac_address?.toLowerCase().includes(q) || c.model?.toLowerCase().includes(q)
    const matchFilter = filter === 'all' 
      || (filter === 'online' && c.is_online) 
      || (filter === 'offline' && !c.is_online)
      || (filter === 'unassigned' && !c.organization_id)
    return matchSearch && matchFilter
  })
  
  const noOrgName = isRu ? 'Без организации' : 'Tashkilotsiz'
  const qStr = search.toLowerCase()
  const matchesNoOrgName = !qStr || noOrgName.toLowerCase().includes(qStr)
  const matchesNoOrgCams = filteredNoOrgCams.length > 0 || (qStr && noOrgCams.some(c => c.name.toLowerCase().includes(qStr)))
  const matchesNoOrgStatus = filter === 'all' || filteredNoOrgCams.length > 0
  
  if (noOrgCams.length > 0 && (matchesNoOrgName || matchesNoOrgCams) && matchesNoOrgStatus) {
    orgGroups.push({
      id: 'none',
      name: noOrgName,
      cameras: noOrgCams,
      filteredCameras: filteredNoOrgCams,
      online: noOrgCams.filter(c => c.is_online).length,
      offline: noOrgCams.filter(c => !c.is_online).length,
    })
  }

  // Get selected organization name for header
  const selectedOrg = organizations.find(o => String(o.id) === orgParam)
  const orgName = orgParam === 'none'
    ? noOrgName
    : (selectedOrg ? selectedOrg.name : '')

  const fmtDate = (iso) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${t('devices.title')}`}
        title={orgName ? `${t('devices.heading')} — ${orgName}` : t('devices.heading')}
        sub={orgName ? (isRu ? `Камеры организации: ${orgName}` : `Tashkilot kameralari: ${orgName}`) : t('devices.sub')}
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
              {[1,2,3,4].map(i => (
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
              <StatCard icon={<BuildingRegular fontSize={18} />} label={isRu ? 'Организации' : 'Tashkilotlar'} value={organizations.length} color="#a855f7" />
              <StatCard icon={<CameraRegular fontSize={18} />}  label={orgParam ? (isRu ? 'Всего камер в орг.' : 'Tashkilotda jami') : t('devices.total')}   value={totalCount} color="#0078d4" />
              <StatCard icon={<Wifi4Regular fontSize={18} />}   label={t('devices.online')}  value={online}         color="#4ade80" />
              <StatCard icon={<WifiOffRegular fontSize={18} />} label={t('devices.offline')} value={offline}        color="#f87171" />
            </div>

            {/* Back Button */}
            {orgParam && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setSearchParams({})}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
                >
                  ← {isRu ? 'Назад к организациям' : 'Tashkilotlar ro\'yxatiga qaytish'}
                </button>
              </div>
            )}
 
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <SearchRegular fontSize={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={orgParam ? (isRu ? 'Поиск камер...' : 'Kameralarni qidirish...') : (isRu ? 'Поиск организаций и камер...' : 'Tashkilot yoki kameralarni qidirish...')}
                  style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 3, gap: 2 }}>
                {(orgParam ? ['all', 'online', 'offline'] : ['all', 'online', 'offline', 'unassigned']).map(f => (
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
            {!error && (orgParam ? filtered.length === 0 : orgGroups.length === 0) && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
                {orgParam ? <CameraRegular fontSize={40} color="var(--text-5)" /> : <BuildingRegular fontSize={40} color="var(--text-5)" />}
                <p style={{ color: 'var(--text-4)', marginTop: 12, fontSize: 14 }}>
                  {orgParam ? t('devices.empty') : (isRu ? 'Организации не найдены' : 'Tashkilotlar topilmadi')}
                </p>
              </div>
            )}
 
            {/* Grid display */}
            {!error && (
              orgParam ? (
                /* CAMERA GRID */
                filtered.length > 0 && (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <StatusDot online={cam.is_online} />
                              {cam.direction && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700,
                                  color: cam.direction === 'in' ? '#38bdf8' : '#fb923c',
                                  background: cam.direction === 'in' ? 'rgba(56,189,248,0.12)' : 'rgba(251,146,60,0.12)',
                                  border: `1px solid ${cam.direction === 'in' ? '#38bdf830' : '#fb923c30'}`,
                                  borderRadius: 100, padding: '2px 8px', textTransform: 'uppercase'
                                }}>
                                  {cam.direction === 'in' ? (i18n.language === 'ru' ? 'Вход' : 'Kirish') : (i18n.language === 'ru' ? 'Выход' : 'Chiqish')}
                                </span>
                              )}
                            </div>
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
                            { 
                              icon: <ArrowSyncRegular fontSize={13} />, 
                              label: i18n.language === 'ru' ? 'Направление' : "Yo'nalish", 
                              val: cam.direction ? (
                                <span style={{ 
                                  color: cam.direction === 'in' ? '#38bdf8' : '#fb923c', 
                                  fontWeight: 700 
                                }}>
                                  {cam.direction === 'in' ? (i18n.language === 'ru' ? 'Вход' : 'Kirish') : (i18n.language === 'ru' ? 'Выход' : 'Chiqish')}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-4)' }}>
                                  {i18n.language === 'ru' ? 'Не указано' : 'Ko\'rsatilmagan'}
                                </span>
                              )
                            },
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
                )
              ) : (
                /* ORGANIZATIONS GRID */
                orgGroups.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {orgGroups.map(g => (
                      <div key={g.id} style={{
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                        padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16,
                        transition: 'border-color 0.2s, transform 0.2s', minHeight: 285
                      }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent-bd)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'rgba(0,120,212,0.1)', border: '1px solid rgba(0,120,212,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--accent)', flexShrink: 0
                          }}>
                            <BuildingRegular fontSize={22} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {g.name}
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
                              {isRu ? `Всего камер: ${g.cameras.length}` : `Jami kameralar: ${g.cameras.length}`}
                            </p>
                          </div>
                        </div>

                        {/* Stats summary */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                          background: 'var(--bg)', borderRadius: 10, padding: '12px 14px',
                          border: '1px solid var(--border-2)'
                        }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {isRu ? 'В сети' : 'Online'}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginTop: 2 }}>{g.online}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {isRu ? 'Вне сети' : 'Offline'}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)', marginTop: 2 }}>{g.offline}</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {g.cameras.length > 0 && (
                          <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: `${(g.online / g.cameras.length) * 100}%`, background: 'var(--green)' }} />
                            <div style={{ height: '100%', width: `${(g.offline / g.cameras.length) * 100}%`, background: 'var(--red)' }} />
                          </div>
                        )}

                        {/* Camera list preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                          {g.cameras.slice(0, 3).map(c => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                                {c.name}
                              </span>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: c.is_online ? 'var(--green)' : 'var(--red)',
                                boxShadow: c.is_online ? '0 0 6px var(--green)' : 'none'
                              }} />
                            </div>
                          ))}
                          {g.cameras.length > 3 && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic', textAlign: 'right', marginTop: 2 }}>
                              {isRu ? `+ еще ${g.cameras.length - 3}` : `+ yana ${g.cameras.length - 3} ta`}
                            </div>
                          )}
                          {g.cameras.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-4)', textAlign: 'center', padding: '10px 0' }}>
                              {isRu ? 'Нет камер' : 'Kameralar mavjud emas'}
                            </div>
                          )}
                        </div>

                        {/* Action button */}
                        <button
                          onClick={() => setSearchParams({ org: g.id })}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 9,
                            background: 'var(--surface-2)', border: '1px solid var(--border-3)',
                            color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'background 0.2s, color 0.2s', marginTop: 'auto'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--accent)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--surface-2)';
                            e.currentTarget.style.borderColor = 'var(--border-3)';
                            e.currentTarget.style.color = 'var(--text-1)';
                          }}
                        >
                          {isRu ? 'Посмотреть камеры' : 'Kameralarni ko\'rish'} →
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )
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
