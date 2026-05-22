import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ClipboardTaskListLtrRegular,
  ArrowSyncRegular,
  PersonRegular,
  CameraRegular,
  CalendarRegular,
  BuildingRegular,
  CheckmarkCircleRegular,
  QuestionCircleRegular,
  EyeRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

/**
 * Davomat sahifasi.
 *
 * Backend endpointlari:
 *   GET /api/attendance?limit=&organization_id=&camera_id=&today_only=&after_id=
 *   GET /api/attendance/filter-data  -> { organizations, cameras }
 *
 * Sahifa imkoniyatlari:
 *   • Tashkilot va kamera bo'yicha filter
 *   • "Faqat bugun" / barcha vaqtlar
 *   • Personal ID yoki ism bo'yicha qidiruv (frontda)
 *   • Snapshot preview lightbox
 *   • Avtomatik 5s polling (silent) — yangi yozuvlar yuqoriga qo'shiladi
 *   • Pastki "Yana yuklash" — eski yozuvlar
 */
export default function Attendance() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [items, setItems] = useState([])
  const [orgs, setOrgs] = useState([])
  const [cameras, setCameras] = useState([])

  const [orgFilter, setOrgFilter] = useState('all')
  const [camFilter, setCamFilter] = useState('all')
  const [todayOnly, setTodayOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)

  const aliveRef = useRef(true)
  const lastIdRef = useRef(0)         // eng yangi ID, polling uchun
  const oldestIdRef = useRef(null)    // eng eski ID, "yana yuklash" uchun
  const reachedEndRef = useRef(false)

  const loadFilters = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/filter-data', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (aliveRef.current) {
        setOrgs(Array.isArray(data?.organizations) ? data.organizations : [])
        setCameras(Array.isArray(data?.cameras) ? data.cameras : [])
      }
    } catch {
      // silent
    }
  }, [])

  // Asosiy / qayta yuklash (filtr o'zgarganda)
  const loadInitial = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (todayOnly) params.set('today_only', 'true')

      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) throw new Error(isRu ? 'Не авторизован' : 'Avtorizatsiya talab qilinadi')
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items : []
      if (aliveRef.current) {
        setItems(list)
        lastIdRef.current = Number(data?.last_id || (list[0]?.id || 0))
        oldestIdRef.current = list.length ? Number(list[list.length - 1].id) : null
        reachedEndRef.current = list.length < 100
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setInitialLoading(false)
        setRefreshing(false)
      }
    }
  }, [orgFilter, camFilter, todayOnly, isRu])

  // Polling — yangi yozuvlar
  const pollNew = useCallback(async () => {
    if (!lastIdRef.current) return
    try {
      const params = new URLSearchParams({ limit: '50', after_id: String(lastIdRef.current) })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (todayOnly) params.set('today_only', 'true')

      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const fresh = Array.isArray(data?.items) ? data.items : []
      if (!fresh.length) return

      // /api/attendance after_id rejimida ASC qaytaradi: tepaga qo'shish uchun reverse qilamiz
      const newIds = new Set(fresh.map(x => x.id))
      if (aliveRef.current) {
        setItems(prev => {
          const filtered = prev.filter(x => !newIds.has(x.id))
          return [...fresh.slice().reverse(), ...filtered]
        })
        const maxId = Number(data?.last_id || fresh[fresh.length - 1].id)
        if (maxId > lastIdRef.current) lastIdRef.current = maxId
      }
    } catch {
      // silent
    }
  }, [orgFilter, camFilter, todayOnly])

  // Eski yozuvlarni yuklash
  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEndRef.current || !oldestIdRef.current) return
    setLoadingMore(true)
    try {
      const before = oldestIdRef.current
      // /api/attendance da `before` filtri yo'q — limit'ni oshirib qaytadan olamiz va
      // hozirgi pastki ID dan kichigini ajratamiz
      const params = new URLSearchParams({ limit: String((items.length + 100)) })
      if (orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (camFilter !== 'all') params.set('camera_id', camFilter)
      if (todayOnly) params.set('today_only', 'true')
      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items : []
      const older = list.filter(x => Number(x.id) < before)
      if (aliveRef.current) {
        if (!older.length) {
          reachedEndRef.current = true
          toast.info(isRu ? 'Больше записей нет' : "Yana yozuvlar yo'q")
        } else {
          setItems(prev => [...prev, ...older])
          oldestIdRef.current = Number(older[older.length - 1].id)
        }
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      if (aliveRef.current) setLoadingMore(false)
    }
  }, [loadingMore, items.length, orgFilter, camFilter, todayOnly, toast, isRu])

  // Mount
  useEffect(() => {
    aliveRef.current = true
    loadFilters()
    return () => { aliveRef.current = false }
  }, [loadFilters])

  // Filtr o'zgarsa qaytadan
  useEffect(() => {
    setInitialLoading(true)
    setItems([])
    lastIdRef.current = 0
    oldestIdRef.current = null
    reachedEndRef.current = false
    loadInitial()
  }, [loadInitial])

  // Polling
  useEffect(() => {
    const id = setInterval(pollNew, 5000)
    return () => clearInterval(id)
  }, [pollNew])

  // Filtrlash
  const camerasByOrg = useMemo(() => {
    if (orgFilter === 'all') return cameras
    return cameras.filter(c => String(c.organization_id) === String(orgFilter))
  }, [cameras, orgFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(it => {
      const haystack = [
        it.employee_name, it.person_name, it.personal_id,
        it.camera_name, it.organization_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  // Statistika
  const stats = useMemo(() => {
    const known = items.filter(i => i.employee_id != null).length
    const unknown = items.length - known
    return { total: items.length, known, unknown }
  }, [items])

  const showSkeleton = initialLoading && items.length === 0

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Посещаемость' : '✦ Davomat'}
        title={isRu ? 'Журнал посещаемости' : 'Davomat jurnali'}
        sub={isRu ? 'Все события распознавания лиц' : "Yuz tanish hodisalari ro'yxati"}
        right={
          <button
            onClick={loadInitial}
            disabled={refreshing || initialLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: (refreshing || initialLoading) ? 'not-allowed' : 'pointer',
              opacity: (refreshing || initialLoading) ? 0.6 : 1,
            }}
          >
            <ArrowSyncRegular fontSize={16} style={{ animation: (refreshing || initialLoading) ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={errBannerStyle}>{error}</div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <StatCard icon={<ClipboardTaskListLtrRegular />} label={isRu ? 'Всего' : 'Jami'} value={stats.total} color="#3b82f6" />
          <StatCard icon={<CheckmarkCircleRegular />} label={isRu ? 'Распознано' : 'Aniqlandi'} value={stats.known} color="#10b981" />
          <StatCard icon={<QuestionCircleRegular />} label={isRu ? 'Неизвестные' : "Noma'lum"} value={stats.unknown} color="#f59e0b" />
        </div>

        {/* Toolbar */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <FieldLabel>{isRu ? 'Поиск' : 'Qidiruv'}</FieldLabel>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRu ? 'Имя, ID, камера...' : 'Ism, ID, kamera...'}
                style={inpStyle}
              />
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <FieldLabel>{isRu ? 'Организация' : 'Tashkilot'}</FieldLabel>
              <select value={orgFilter} onChange={e => { setOrgFilter(e.target.value); setCamFilter('all') }} style={inpStyle}>
                <option value="all">{isRu ? 'Все организации' : 'Hamma tashkilotlar'}</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <FieldLabel>{isRu ? 'Камера' : 'Kamera'}</FieldLabel>
              <select value={camFilter} onChange={e => setCamFilter(e.target.value)} style={inpStyle}>
                <option value="all">{isRu ? 'Все камеры' : 'Hamma kameralar'}</option>
                {camerasByOrg.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              background: todayOnly ? 'var(--accent-bg)' : 'var(--bg)',
              border: `1px solid ${todayOnly ? 'var(--accent-bd)' : 'var(--border-2)'}`,
              cursor: 'pointer', fontSize: 13, color: 'var(--text-1)', fontWeight: 600,
              height: 36, boxSizing: 'border-box',
            }}>
              <input
                type="checkbox"
                checked={todayOnly}
                onChange={e => setTodayOnly(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
              />
              <CalendarRegular fontSize={14} />
              {isRu ? 'Только сегодня' : 'Faqat bugun'}
            </label>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-4)' }}>
            {filtered.length} / {items.length} {isRu ? 'записей' : 'yozuv'}
          </div>
        </div>

        {/* Table */}
        <div style={cardStyle}>
          {showSkeleton ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>
              {items.length === 0
                ? (isRu ? 'Записей посещаемости пока нет.' : "Davomat yozuvlari hali yo'q.")
                : (isRu ? 'Ничего не найдено.' : "Hech narsa topilmadi.")}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        '№',
                        isRu ? 'Время' : 'Vaqt',
                        isRu ? 'Сотрудник' : 'Xodim',
                        isRu ? 'ID' : 'ID',
                        isRu ? 'Камера' : 'Kamera',
                        isRu ? 'Организация' : 'Tashkilot',
                        isRu ? 'Статус' : 'Holat',
                        isRu ? 'Снимок' : 'Snapshot',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it, idx) => (
                      <tr key={it.id}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, color: 'var(--text-4)' }}>{idx + 1}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{formatTime(it.timestamp)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDate(it.timestamp)}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={avatarFallback}><PersonRegular fontSize={16} /></div>
                            <div>
                              {it.employee_id ? (
                                <Link
                                  to={`/employees/${it.employee_id}`}
                                  state={{ from: '/attendance' }}
                                  style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  {it.employee_name || it.person_name || (isRu ? 'Сотрудник' : 'Xodim')}
                                </Link>
                              ) : (
                                <div style={{ fontWeight: 600 }}>
                                  {it.employee_name || it.person_name || (isRu ? 'Неизвестный' : "Noma'lum")}
                                </div>
                              )}
                              {it.person_name && it.person_name !== it.employee_name && (
                                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{it.person_name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <code style={{ fontSize: 12, color: 'var(--text-1)' }}>{it.personal_id || '—'}</code>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <CameraRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                            {it.camera_name || it.camera_isup_device_id || '—'}
                          </div>
                          {it.camera_mac && (
                            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, fontFamily: 'monospace' }}>{it.camera_mac}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {it.organization_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <BuildingRegular fontSize={13} style={{ color: 'var(--text-4)' }} />
                              {it.organization_name}
                            </div>
                          ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          <StatusPill status={it.status} hasEmployee={it.employee_id != null} isRu={isRu} />
                        </td>
                        <td style={tdStyle}>
                          {it.snapshot_url ? (
                            <button
                              onClick={() => setLightbox(it)}
                              title={isRu ? 'Открыть снимок' : 'Snapshot ochish'}
                              style={{
                                width: 44, height: 44, borderRadius: 6,
                                padding: 0, border: '1px solid var(--border-2)',
                                background: 'var(--bg)', cursor: 'pointer', overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <img
                                src={it.snapshot_url}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={e => { e.currentTarget.style.display = 'none' }}
                              />
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-4)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load more */}
              {!reachedEndRef.current && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 18px', borderRadius: 8,
                      background: 'var(--accent-bg)', color: 'var(--accent-tx)',
                      border: '1px solid var(--accent-bd)',
                      fontSize: 13, fontWeight: 600,
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loadingMore && <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    {isRu ? 'Загрузить ещё' : 'Yana yuklash'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && lightbox.snapshot_url && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, cursor: 'zoom-out',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }}>
            <img src={lightbox.snapshot_url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }} />
            <div style={{ marginTop: 12, color: '#fff', fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{lightbox.employee_name || lightbox.person_name || (isRu ? 'Неизвестный' : "Noma'lum")}</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {formatTime(lightbox.timestamp)} · {formatDate(lightbox.timestamp)}
                {lightbox.camera_name && <> · {lightbox.camera_name}</>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ padding: 14, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 9,
        background: color + '22', color, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function StatusPill({ status, hasEmployee, isRu }) {
  const isKnown = hasEmployee || (status && String(status).toLowerCase().includes('aniq'))
  const tone = isKnown
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <CheckmarkCircleRegular fontSize={12} />, text: isRu ? 'Распознан' : 'Aniqlandi' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', icon: <QuestionCircleRegular fontSize={12} />, text: isRu ? 'Неизвестный' : "Noma'lum" }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${tone.color}33`,
    }}>{tone.icon}{tone.text}</span>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const errBannerStyle = { marginBottom: 18, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }
const inpStyle = {
  width: '100%', padding: '8px 11px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  height: 36,
}
const tableStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 32, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }
const avatarFallback = { width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
