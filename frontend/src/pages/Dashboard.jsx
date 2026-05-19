import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  BuildingRegular, PeopleRegular, CameraRegular,
  CheckmarkCircleRegular, DismissCircleRegular, ClockRegular,
  ArrowSyncRegular, PersonRegular, HeartPulseRegular,
  PulseSquareRegular, TargetRegular, GridRegular
} from '@fluentui/react-icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import PageHero from '../components/PageHero'

function safeRatio(num, den) { return den > 0 ? num / den : 0 }
function clampScore(value) { return Math.max(20, Math.min(95, Math.round(value))) }

function StatBox({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color + '55'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: color + '15', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
    </div>
  )
}

function ProgressBar({ label, percent, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6, fontWeight: 600, color: 'var(--text-2)' }}>
        <span>{label}</span>
        <span style={{ color }}>{Math.round(percent)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, percent))}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function OrgCard({ org, isRu }) {
  const total = (org.present_today || 0) + (org.absent_today || 0)
  const rate = total > 0 ? Math.round((org.present_today / total) * 100) : 0
  const statusColors = { active: '#10b981', pending: '#f59e0b', expired: '#ef4444' }
  const statusLabels = { active: isRu ? 'Активна' : 'Faol', pending: isRu ? 'Ожидание' : 'Kutilmoqda', expired: isRu ? 'Истекла' : 'Tugagan' }
  const color = statusColors[org.subscription_status] || '#64748b'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-bd)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{org.name}</div>
        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: color + '18', color, fontWeight: 600, textTransform: 'uppercase' }}>
          {statusLabels[org.subscription_status] || org.subscription_status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{org.employee_count}</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Сотр.' : 'Xodim'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{org.camera_count}</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Камер' : 'Kamera'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: rate > 70 ? '#10b981' : rate > 40 ? '#f59e0b' : '#ef4444' }}>{rate}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Явка' : 'Davomat'}</div>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${rate}%`, background: rate > 70 ? '#10b981' : rate > 40 ? '#f59e0b' : '#ef4444', borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function EventRow({ event, isRu }) {
  const statusColor = event.status === 'aniqlandi' ? '#10b981' : '#f59e0b'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.employee_name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{event.device_name || ''}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{event.timestamp}</div>
        <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{event.date}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  
  // Cache helpers — read with TTL check
  const readCache = (key, ttlMs) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !parsed.ts || !parsed.data) return null
      if (Date.now() - parsed.ts > ttlMs) return { data: parsed.data, stale: true, ts: parsed.ts }
      return { data: parsed.data, stale: false, ts: parsed.ts }
    } catch { return null }
  }
  const writeCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch {}
  }

  // TTL config: how long before we consider cache stale and refetch
  const TTL_METRICS = 5 * 60 * 1000   // 5 minutes — orgs/employees/cameras barely change
  const TTL_TREND   = 10 * 60 * 1000  // 10 minutes — weekly trend is mostly historical
  const TTL_EVENTS  = 30 * 1000       // 30 seconds — only events are truly live

  // Load cached data immediately for instant render
  const [data, setData] = useState(() => readCache('bf_dashboard_metrics', TTL_METRICS)?.data || null)
  const [weeklyTrend, setWeeklyTrend] = useState(() => readCache('bf_dashboard_trend', TTL_TREND)?.data || [])
  const [recentEvents, setRecentEvents] = useState(() => readCache('bf_dashboard_events', TTL_EVENTS)?.data || [])
  const [lastUpdated, setLastUpdated] = useState(() => {
    const c = readCache('bf_dashboard_metrics', Infinity)
    return c?.ts || null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [spin, setSpin] = useState(false)
  const navigate = useNavigate()
  const abortRef = useRef(null)

  // Independent fetchers — each updates UI as soon as it's ready
  const fetchMetrics = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/dashboard/metrics', { signal })
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const payload = json.dashboard || json
      setData(payload)
      setLastUpdated(Date.now())
      writeCache('bf_dashboard_metrics', payload)
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('metrics fetch failed', e)
    }
  }, [navigate])

  const fetchTrend = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/dashboard/weekly-trend', { signal })
      if (!res.ok) return
      const json = await res.json()
      const days = json.days || []
      setWeeklyTrend(days)
      writeCache('bf_dashboard_trend', days)
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('trend fetch failed', e)
    }
  }, [])

  const fetchEvents = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/dashboard/recent-events', { signal })
      if (!res.ok) return
      const json = await res.json()
      const events = json.events || []
      setRecentEvents(events)
      writeCache('bf_dashboard_events', events)
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('events fetch failed', e)
    }
  }, [])

  // Smart load: only fetch endpoints whose cache is stale (or all if forced)
  const load = useCallback(async (force = false) => {
    if (force) setSpin(true)
    setError('')
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    const metricsCache = readCache('bf_dashboard_metrics', TTL_METRICS)
    const trendCache   = readCache('bf_dashboard_trend', TTL_TREND)
    const eventsCache  = readCache('bf_dashboard_events', TTL_EVENTS)

    const tasks = []
    if (force || !metricsCache || metricsCache.stale) tasks.push(fetchMetrics(signal))
    if (force || !trendCache   || trendCache.stale)   tasks.push(fetchTrend(signal))
    if (force || !eventsCache  || eventsCache.stale)  tasks.push(fetchEvents(signal))

    if (tasks.length === 0) {
      // All caches fresh — nothing to do
      if (force) setTimeout(() => setSpin(false), 300)
      return
    }

    try {
      await Promise.allSettled(tasks)
    } catch (e) {
      setError(t('dashboard.errLoad') || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
      if (force) setTimeout(() => setSpin(false), 400)
    }
  }, [fetchMetrics, fetchTrend, fetchEvents, t])

  useEffect(() => {
    load(false)
    // Refresh only the live data (events) every 30s, full refresh every 5 min
    const eventsInterval = setInterval(() => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()
      fetchEvents(abortRef.current.signal)
    }, 30000)
    const fullInterval = setInterval(() => load(false), 5 * 60 * 1000)
    return () => {
      clearInterval(eventsInterval)
      clearInterval(fullInterval)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load, fetchEvents])

  const summary = data?.summary || {}
  const orgs = data?.org_cards || []
  const charts = data?.charts || {}
  const isRu = i18n.language === 'ru'
  const now = new Date()
  const locale = isRu ? 'ru-RU' : 'uz-UZ'
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  const attendanceTotal = (summary.present_today || 0) + (summary.absent_today || 0)
  const attendanceRate = attendanceTotal ? (summary.present_today * 100 / attendanceTotal) : 0
  const cameraHealth = summary.cameras ? (summary.active_cameras * 100 / summary.cameras) : 0
  const lateRate = summary.present_today ? (summary.late_today * 100 / summary.present_today) : 0

  let activeSub = 0, pendingSub = 0, expiredSub = 0
  orgs.forEach(o => {
    if (o.subscription_status === 'active') activeSub++
    else if (o.subscription_status === 'expired') expiredSub++
    else pendingSub++
  })
  const subRate = summary.organizations ? (activeSub * 100 / summary.organizations) : 0
  const systemPulse = (attendanceRate + cameraHealth + subRate) / 3

  const radarData = useMemo(() => {
    const presentRate = safeRatio(summary.present_today || 0, attendanceTotal)
    const lr = safeRatio(summary.late_today || 0, Math.max(summary.present_today || 0, 1))
    const cr = safeRatio(summary.active_cameras || 0, Math.max(summary.cameras || 0, 1))
    const wc = safeRatio(summary.users || 0, Math.max(summary.employees || 0, 1))
    return [
      { subject: isRu ? 'Открытость' : 'Ochiqlik', A: clampScore(48 + cr * 34) },
      { subject: isRu ? 'Добросовестность' : "Mas'uliyat", A: clampScore(34 + presentRate * 56 - lr * 22) },
      { subject: isRu ? 'Экстраверсия' : 'Ekstraversiya', A: clampScore(42 + wc * 32) },
      { subject: isRu ? 'Сотрудничество' : 'Hamkorlik', A: clampScore(38 + presentRate * 48) },
      { subject: isRu ? 'Стабильность' : 'Barqarorlik', A: clampScore(36 + (1 - lr) * 34 + (1 - safeRatio(summary.absent_today || 0, Math.max(attendanceTotal, 1))) * 22) },
    ]
  }, [summary, attendanceTotal, isRu])

  const attendanceData = useMemo(() => {
    const colors = ['#10b981', '#64748b', '#f59e0b']
    const lblMap = { present: isRu ? 'Пришли' : 'Kelgan', absent: isRu ? 'Отсутствуют' : 'Kelmadi', late: isRu ? 'Опоздали' : 'Kechikkan' }
    if (!charts.attendance_today) return []
    return charts.attendance_today.labels.map((lbl, i) => ({
      name: lblMap[lbl] || lbl, value: charts.attendance_today.values[i], color: colors[i % colors.length]
    }))
  }, [charts, isRu])

  const cameraLoadData = useMemo(() => {
    if (!charts.camera_load) return []
    return charts.camera_load.labels.map((lbl, i) => ({ name: lbl, value: charts.camera_load.values[i] }))
  }, [charts])

  const orgOverviewData = useMemo(() => {
    if (!charts.org_overview) return []
    return charts.org_overview.labels.map((lbl, i) => ({
      name: lbl, users: charts.org_overview.users[i], employees: charts.org_overview.employees[i], cameras: charts.org_overview.cameras[i]
    }))
  }, [charts])

  if (loading && !data) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${t('dashboard.title')}`}
        title={t('dashboard.subtitle')}
        sub={dateStr}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>
                {isRu ? 'Обновлено' : 'Yangilandi'}: {(() => {
                  const diff = Math.floor((Date.now() - lastUpdated) / 1000)
                  if (diff < 60) return isRu ? `${diff} сек назад` : `${diff} soniya oldin`
                  if (diff < 3600) return isRu ? `${Math.floor(diff/60)} мин назад` : `${Math.floor(diff/60)} daqiqa oldin`
                  return isRu ? `${Math.floor(diff/3600)} ч назад` : `${Math.floor(diff/3600)} soat oldin`
                })()}
              </div>
            )}
            <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
              {t('dashboard.refresh')}
            </button>
          </div>
        }
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '14px 20px', color: 'var(--red)', fontSize: 13, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* === ROW 1: System Pulse + Today Summary === */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
              {/* System Pulse */}
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 10, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <HeartPulseRegular fontSize={15} />
                    {isRu ? 'Индекс системы' : 'Tizim indeksi'}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
                    {Math.round(systemPulse)}<span style={{ fontSize: 16, color: 'var(--text-4)', fontWeight: 400 }}>/100</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                    {systemPulse > 70 ? (isRu ? 'Система стабильна' : 'Tizim barqaror') : systemPulse > 40 ? (isRu ? 'Требует внимания' : "E'tibor kerak") : (isRu ? 'Критическое состояние' : 'Kritik holat')}
                  </div>
                </div>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: `conic-gradient(var(--accent) ${systemPulse * 3.6}deg, var(--border) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <PulseSquareRegular fontSize={28} />
                  </div>
                </div>
              </div>

              {/* Today Summary */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GridRegular fontSize={16} color="var(--accent)" />
                  {isRu ? 'Сводка на сегодня' : 'Bugungi xulosa'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Организации' : 'Tashkilotlar'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.organizations}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Сотрудники' : 'Xodimlar'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.employees}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Камеры' : 'Kameralar'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.active_cameras}<span style={{ fontSize: 13, color: 'var(--text-4)' }}>/{summary.cameras}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Явка' : 'Davomat'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: attendanceRate > 70 ? '#10b981' : '#f59e0b' }}>{Math.round(attendanceRate)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Опоздания' : 'Kechikish'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{summary.late_today}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* === ROW 2: Stat Cards === */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <StatBox label={isRu ? 'Присутствуют' : 'Kelganlar'} value={summary.present_today} icon={<CheckmarkCircleRegular fontSize={22} />} color="#10b981" sub={`${Math.round(attendanceRate)}% ${isRu ? 'от общего' : 'umumiydan'}`} />
              <StatBox label={isRu ? 'Отсутствуют' : 'Kelmaganlar'} value={summary.absent_today} icon={<DismissCircleRegular fontSize={22} />} color="#64748b" />
              <StatBox label={isRu ? 'Опоздали' : 'Kechikkanlar'} value={summary.late_today} icon={<ClockRegular fontSize={22} />} color="#f59e0b" sub={`${Math.round(lateRate)}% ${isRu ? 'от пришедших' : 'kelganlardan'}`} />
              <StatBox label={isRu ? 'Пользователи' : 'Foydalanuvchilar'} value={summary.users} icon={<PersonRegular fontSize={22} />} color="#0ea5e9" />
              <StatBox label={isRu ? 'Камеры онлайн' : 'Online kameralar'} value={summary.active_cameras} icon={<CameraRegular fontSize={22} />} color="#8b5cf6" sub={`${Math.round(cameraHealth)}% ${isRu ? 'активны' : 'faol'}`} />
            </div>

            {/* === ROW 3: Weekly Trend + Recent Events === */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              {/* Weekly Attendance Trend */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowSyncRegular fontSize={16} color="#3b82f6" />
                  {isRu ? 'Посещаемость за неделю' : 'Haftalik davomat'}
                </div>
                {weeklyTrend.length > 0 ? (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="date" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="present" name={isRu ? 'Пришли' : 'Kelgan'} stroke="#10b981" strokeWidth={2} fill="url(#colorPresent)" />
                        <Area type="monotone" dataKey="absent" name={isRu ? 'Отсутствуют' : 'Kelmagan'} stroke="#ef4444" strokeWidth={2} fill="url(#colorAbsent)" />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    {isRu ? 'Нет данных за неделю' : "Haftalik ma'lumot yo'q"}
                  </div>
                )}
              </div>

              {/* Recent Events */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', maxHeight: 360, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClockRegular fontSize={16} color="#f59e0b" />
                  {isRu ? 'Последние события' : 'Oxirgi hodisalar'}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {recentEvents.length > 0 ? (
                    recentEvents.slice(0, 10).map((ev, i) => <EventRow key={ev.id || i} event={ev} isRu={isRu} />)
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-4)', fontSize: 13 }}>
                      {isRu ? 'Нет событий' : "Hodisalar yo'q"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* === ROW 4: Organizations Cards === */}
            {orgs.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BuildingRegular fontSize={16} color="#6366f1" />
                  {isRu ? 'Организации' : 'Tashkilotlar'}
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 400 }}>({orgs.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {orgs.map(org => <OrgCard key={org.id} org={org} isRu={isRu} />)}
                </div>
              </div>
            )}

            {/* === ROW 5: Charts Section === */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              
              {/* Attendance Pie */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{isRu ? 'Срез посещаемости' : 'Davomat kesimi'}</div>
                {attendanceData.length > 0 && attendanceData.some(d => d.value > 0) ? (
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={attendanceData} innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                          {attendanceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    {isRu ? 'Нет данных' : "Ma'lumot yo'q"}
                  </div>
                )}
              </div>

              {/* Coefficients */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TargetRegular fontSize={16} color="var(--accent)" />
                  {isRu ? 'Коэффициенты' : 'Koeffitsiyentlar'}
                </div>
                <ProgressBar label={isRu ? 'Охват посещаемости' : 'Davomat qamrovi'} percent={attendanceRate} color="#10b981" />
                <ProgressBar label={isRu ? 'Стабильность камер' : 'Kamera barqarorligi'} percent={cameraHealth} color="#3b82f6" />
                <ProgressBar label={isRu ? 'Активные подписки' : 'Faol obunalar'} percent={subRate} color="#f59e0b" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20, textAlign: 'center' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#10b981', fontWeight: 600 }}>{isRu ? 'Активные' : 'Faol'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 2 }}>{activeSub}</div>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#3b82f6', fontWeight: 600 }}>{isRu ? 'Ожидание' : 'Kutilmoqda'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6', marginTop: 2 }}>{pendingSub}</div>
                  </div>
                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#f43f5e', fontWeight: 600 }}>{isRu ? 'Истекли' : 'Tugagan'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f43f5e', marginTop: 2 }}>{expiredSub}</div>
                  </div>
                </div>
              </div>

              {/* AI Radar */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{isRu ? 'Поведенческий профиль' : 'Xulqiy profil'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 12 }}>
                  {isRu ? 'На основе дисциплины и покрытия' : 'Intizom va qamrovga asoslangan'}
                </div>
                <div style={{ height: 220, marginLeft: -16, marginRight: -16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                      <PolarGrid stroke="var(--border-3)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="AI" dataKey="A" stroke="#0ea5e9" strokeWidth={2} fill="#0ea5e9" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* === ROW 6: Org Comparison + Camera Load === */}
            <div style={{ display: 'grid', gridTemplateColumns: orgs.length > 1 ? '3fr 2fr' : '1fr', gap: 20 }}>
              {/* Org Comparison Bar Chart */}
              {orgs.length > 1 && orgOverviewData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{isRu ? 'Сравнение организаций' : 'Tashkilotlar taqqoslamasi'}</div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={orgOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="employees" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="#0284c7" radius={[4,4,0,0]} />
                        <Bar dataKey="cameras" name={isRu ? 'Камеры' : 'Kameralar'} fill="#f59e0b" radius={[4,4,0,0]} />
                        <Bar dataKey="users" name={isRu ? 'Пользователи' : 'Users'} fill="#8b5cf6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Camera Load */}
              {cameraLoadData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CameraRegular fontSize={16} color="#8b5cf6" />
                    {isRu ? 'Нагрузка камер' : 'Kamera yuklamasi'}
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cameraLoadData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={90} stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="value" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="#8b5cf6" radius={[0,4,4,0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
