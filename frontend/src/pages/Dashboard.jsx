import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  BuildingRegular, PeopleRegular, CameraRegular,
  CheckmarkCircleRegular, DismissCircleRegular, ClockRegular,
  ArrowSyncRegular, PersonRegular, ShieldRegular,
  ChartMultipleRegular, GlobeRegular, GridDotsRegular,
  DataBarVerticalRegular, DataTrendingRegular
} from '@fluentui/react-icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import PageHero from '../components/PageHero'

function safeRatio(num, den) { return den > 0 ? num / den : 0 }
function clampScore(value) { return Math.max(20, Math.min(95, Math.round(value))) }

function StatBox({ label, value, icon, color, bg, border, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
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

function OrgCard({ org, isRu, showCameras = true }) {
  const total = (org.present_today || 0) + (org.absent_today || 0)
  const rate = total > 0 ? Math.round((org.present_today / total) * 100) : 0
  const statusColors = { active: 'var(--green)', pending: 'var(--yellow)', expired: 'var(--red)' }
  const statusBgs = { active: 'var(--green-bg)', pending: 'var(--yellow-bg)', expired: 'var(--red-bg)' }
  const statusBds = { active: 'var(--green-bd)', pending: 'var(--yellow-bd)', expired: 'var(--red-bd)' }
  const statusLabels = { active: isRu ? 'Активна' : 'Faol', pending: isRu ? 'Ожидание' : 'Kutilmoqda', expired: isRu ? 'Истекла' : 'Tugagan' }
  const color = statusColors[org.subscription_status] || 'var(--gray)'
  const bg = statusBgs[org.subscription_status] || 'var(--gray-bg)'
  const border = statusBds[org.subscription_status] || 'var(--gray-bd)'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-bd)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{org.name}</div>
        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: bg, color, border: `1px solid ${border}`, fontWeight: 600, textTransform: 'uppercase' }}>
          {statusLabels[org.subscription_status] || org.subscription_status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: showCameras ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{org.employee_count}</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Сотр.' : 'Xodim'}</div>
        </div>
        {showCameras && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{org.camera_count}</div>
            <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Камер' : 'Kamera'}</div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: rate > 70 ? 'var(--green)' : rate > 40 ? 'var(--yellow)' : 'var(--red)' }}>{rate}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{isRu ? 'Явка' : 'Davomat'}</div>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${rate}%`, background: rate > 70 ? 'var(--green)' : rate > 40 ? 'var(--yellow)' : 'var(--red)', borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function EventRow({ event, isRu }) {
  const statusColor = event.status === 'aniqlandi' ? 'var(--green)' : 'var(--yellow)'
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

// ============================================================
// HEATMAP COMPONENT
// ============================================================
function LatenessHeatmap({ heatmapData, isRu, t }) {
  const WEEKDAYS = [
    t('analytics.weekdayMon'), t('analytics.weekdayTue'), t('analytics.weekdayWed'),
    t('analytics.weekdayThu'), t('analytics.weekdayFri'), t('analytics.weekdaySat'), t('analytics.weekdaySun')
  ]
  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  // Build lookup map
  const cellMap = useMemo(() => {
    const m = {}
    heatmapData.forEach(({ weekday, hour, count }) => {
      m[`${weekday}-${hour}`] = count
    })
    return m
  }, [heatmapData])

  const maxCount = useMemo(() => Math.max(1, ...heatmapData.map(d => d.count)), [heatmapData])

  const getColor = (count) => {
    if (!count) return 'transparent'
    const intensity = count / maxCount
    // Vibrant orange-red gradient using HSL
    const hue = 20 - intensity * 10  // 20° (orange) → 10° (red-orange)
    const sat = 70 + intensity * 25
    const light = 75 - intensity * 40
    return `hsl(${hue}, ${sat}%, ${light}%)`
  }

  const [tooltip, setTooltip] = useState(null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        {/* Hour axis */}
        <div style={{ display: 'flex', marginLeft: 40, marginBottom: 4 }}>
          {HOURS.map(h => (
            <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-4)', fontWeight: 600 }}>
              {h % 2 === 0 ? `${h}:00` : ''}
            </div>
          ))}
        </div>
        {/* Grid rows per weekday */}
        {WEEKDAYS.map((dayLabel, wd) => (
          <div key={wd} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ width: 34, flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', paddingRight: 8 }}>
              {dayLabel}
            </div>
            {HOURS.map(hr => {
              const count = cellMap[`${wd}-${hr}`] || 0
              const bg = getColor(count)
              return (
                <div
                  key={hr}
                  style={{
                    flex: 1,
                    height: 24,
                    background: bg,
                    border: count > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border)',
                    borderRadius: 3,
                    cursor: count > 0 ? 'pointer' : 'default',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative',
                    margin: '0 1px'
                  }}
                  onMouseEnter={e => {
                    if (count > 0) {
                      e.currentTarget.style.transform = 'scale(1.35)'
                      e.currentTarget.style.zIndex = '10'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
                      setTooltip({ wd, hr, count })
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.zIndex = ''
                    e.currentTarget.style.boxShadow = ''
                    setTooltip(null)
                  }}
                />
              )
            })}
          </div>
        ))}
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12, fontSize: 10, color: 'var(--text-4)' }}>
          <span>{isRu ? 'Меньше' : 'Kam'}</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: v === 0 ? 'var(--border)' : getColor(Math.round(v * maxCount)), border: '1px solid var(--border)' }} />
          ))}
          <span>{isRu ? 'Больше' : 'Ko\'p'}</span>
        </div>
        {/* Tooltip */}
        {tooltip && (
          <div style={{ marginTop: 12, padding: '8px 16px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>
            <strong>{WEEKDAYS[tooltip.wd]}</strong> — {tooltip.hr}:00–{tooltip.hr + 1}:00: {' '}
            <strong style={{ color: 'var(--red)' }}>{tooltip.count}</strong> {isRu ? 'опозданий' : 'ta kechikish'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()

  // Analytics tab state
  const [activeTab, setActiveTab] = useState('summary')  // 'summary' | 'analytics'
  const [heatmapData, setHeatmapData] = useState([])
  const [anomalyData, setAnomalyData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')

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

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError('')
    try {
      const [hmRes, anRes] = await Promise.all([
        fetch('/api/dashboard/analytics/heatmap'),
        fetch('/api/dashboard/analytics/anomaly-ranking')
      ])
      if (hmRes.ok) {
        const hmJson = await hmRes.json()
        setHeatmapData(hmJson.heatmap || [])
      }
      if (anRes.ok) {
        const anJson = await anRes.json()
        setAnomalyData(anJson.ranking || null)
      }
    } catch (e) {
      setAnalyticsError(t('analytics.errLoad') || 'Analitika yuklanmadi')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [t])

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

  // Load analytics when tab is switched to analytics
  useEffect(() => {
    if (activeTab === 'analytics' && !anomalyData && !analyticsLoading) {
      fetchAnalytics()
    }
  }, [activeTab, anomalyData, analyticsLoading, fetchAnalytics])

  const summary = data?.summary || {}
  const orgs = data?.org_cards || []
  const charts = data?.charts || {}
  const showCameras = data?.show_cameras !== false
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
  const systemPulse = showCameras
    ? (attendanceRate + cameraHealth + subRate) / 3
    : (attendanceRate + subRate) / 2

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
    const colors = ['var(--green)', 'var(--gray)', 'var(--yellow)']
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
          <div className="dash-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Tab Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 3, gap: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                id="dash-tab-summary"
                onClick={() => setActiveTab('summary')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: activeTab === 'summary' ? 'rgba(255,255,255,0.9)' : 'transparent',
                  color: activeTab === 'summary' ? '#111' : 'rgba(255,255,255,0.75)',
                  transition: 'all 0.2s'
                }}
              >
                <GridDotsRegular fontSize={13} />
                {t('analytics.tabSummary')}
              </button>
              <button
                id="dash-tab-analytics"
                onClick={() => setActiveTab('analytics')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: activeTab === 'analytics' ? 'rgba(255,255,255,0.9)' : 'transparent',
                  color: activeTab === 'analytics' ? '#111' : 'rgba(255,255,255,0.75)',
                  transition: 'all 0.2s'
                }}
              >
                <DataTrendingRegular fontSize={13} />
                {t('analytics.tabAnalytics')}
              </button>
            </div>
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
            <button onClick={() => { load(true); if (activeTab === 'analytics') fetchAnalytics() }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
              <ArrowSyncRegular fontSize={14} className={spin ? 'spin' : ''} />
              {isRu ? 'Обновить' : 'Yangilash'}
            </button>
          </div>
        }
      />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .db-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .db-grid-row1 {
          display: grid;
          grid-template-columns: 320px 1fr;
        }
        .db-grid-today {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
        }
        .db-grid-row3 {
          display: grid;
          grid-template-columns: 2fr 1fr;
        }
        .db-grid-row5 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
        }
        .db-grid-row6 {
          display: grid;
          grid-template-columns: 3fr 2fr;
        }
        .db-grid-row6.single {
          grid-template-columns: 1fr;
        }
        @media (max-width: 600px) {
          .dash-hero-actions {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .dash-hero-actions > div {
            width: 100% !important;
            justify-content: center !important;
          }
          .dash-hero-actions button {
            flex: 1 1 auto !important;
            justify-content: center !important;
          }
        }
        @media (max-width: 1024px) {
          .db-grid-row5 {
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          }
        }
        @media (max-width: 900px) {
          .db-container {
            padding: 16px 16px 60px !important;
          }
          .db-grid-row1, .db-grid-row3, .db-grid-row5, .db-grid-row6 {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .db-grid-today {
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          }
        }
      `}</style>

      <div className="db-container">
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '14px 20px', color: 'var(--red)', fontSize: 13, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* ============= ANALYTICS TAB ============= */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {analyticsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                <Spinner size="medium" />
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{t('analytics.loading')}</span>
              </div>
            )}
            {analyticsError && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '14px 20px', color: 'var(--red)', fontSize: 13 }}>
                {analyticsError}
              </div>
            )}

            {!analyticsLoading && (
              <>
                {/* === HEATMAP === */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #ff6b35, #f7c59f)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DataBarVerticalRegular fontSize={18} style={{ color: '#fff' }} />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{t('analytics.heatmapTitle')}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)', maxWidth: 480 }}>{t('analytics.heatmapSub')}</div>
                    </div>
                    <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-bd)', fontWeight: 600 }}>
                      {isRu ? 'Последние 30 дней' : 'So\'nggi 30 kun'}
                    </div>
                  </div>
                  {heatmapData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-4)', fontSize: 14 }}>
                      {t('analytics.noData')}
                    </div>
                  ) : (
                    <LatenessHeatmap heatmapData={heatmapData} isRu={isRu} t={t} />
                  )}
                </div>

                {/* === DEPT RATES + LATECOMERS + EARLY LEAVERS === */}
                {anomalyData && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }} className="db-grid-row5">
                    {/* Department rates */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <BuildingRegular fontSize={16} style={{ color: 'var(--accent)' }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{t('analytics.deptRatesTitle')}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 20 }}>{t('analytics.deptRatesSub')}</div>
                      {anomalyData.departments.length === 0 ? (
                        <div style={{ color: 'var(--text-4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>{t('analytics.noData')}</div>
                      ) : (
                        anomalyData.departments.map(dept => {
                          const color = dept.rate >= 75 ? 'var(--green)' : dept.rate >= 50 ? 'var(--yellow)' : 'var(--red)'
                          return (
                            <div key={dept.id} style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6, fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%' }}>{dept.name}</span>
                                <span style={{ color }}>{dept.rate}%</span>
                              </div>
                              <div style={{ height: 7, background: 'var(--border)', borderRadius: 99 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, dept.rate)}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }} />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Latecomers */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ClockRegular fontSize={16} style={{ color: '#f59e0b' }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{t('analytics.latecomerTitle')}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 20 }}>{t('analytics.latecomerSub')}</div>
                      {anomalyData.latecomers.length === 0 ? (
                        <div style={{ color: 'var(--text-4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>{t('analytics.noData')}</div>
                      ) : (
                        anomalyData.latecomers.map((emp, idx) => (
                          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx < 3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: idx < 3 ? '#fff' : 'var(--text-3)', flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{emp.department || '—'}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{emp.late_days} {t('analytics.lateDays')}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)' }}>∅ {emp.avg_late_minutes} {isRu ? 'мин.' : 'min'}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Early leavers */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <DismissCircleRegular fontSize={16} style={{ color: '#8b5cf6' }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{t('analytics.earlyTitle')}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 20 }}>{t('analytics.earlySub')}</div>
                      {anomalyData.early_leavers.length === 0 ? (
                        <div style={{ color: 'var(--text-4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>{t('analytics.noData')}</div>
                      ) : (
                        anomalyData.early_leavers.map((emp, idx) => (
                          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx < 3 ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: idx < 3 ? '#fff' : 'var(--text-3)', flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{emp.department || '—'}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>{emp.early_days} {t('analytics.earlyDays')}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)' }}>∅ {emp.avg_early_minutes} {isRu ? 'мин.' : 'min'}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'summary' && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* === ROW 1: System Pulse + Today Summary === */}
            <div className="db-grid-row1" style={{ gap: 16 }}>
              {/* System Pulse */}
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 10, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <ShieldRegular fontSize={15} />
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
                    <ChartMultipleRegular fontSize={28} />
                  </div>
                </div>
              </div>

              {/* Today Summary */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GridDotsRegular fontSize={16} color="var(--accent)" />
                  {isRu ? 'Сводка на сегодня' : 'Bugungi xulosa'}
                </div>
                <div className="db-grid-today" style={{ gap: 12, gridTemplateColumns: showCameras ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Организации' : 'Tashkilotlar'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.organizations}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Сотрудники' : 'Xodimlar'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.employees}</div>
                  </div>
                  {showCameras && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Камеры' : 'Kameralar'}</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.active_cameras}<span style={{ fontSize: 13, color: 'var(--text-4)' }}>/{summary.cameras}</span></div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Явка' : 'Davomat'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: attendanceRate > 70 ? 'var(--green)' : 'var(--yellow)' }}>{Math.round(attendanceRate)}%</div>
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
              <StatBox label={isRu ? 'Присутствуют' : 'Kelganlar'} value={summary.present_today} icon={<CheckmarkCircleRegular fontSize={22} />} color="var(--green)" bg="var(--green-bg)" border="var(--green-bd)" sub={`${Math.round(attendanceRate)}% ${isRu ? 'от общего' : 'umumiydan'}`} />
              <StatBox label={isRu ? 'Отсутствуют' : 'Kelmaganlar'} value={summary.absent_today} icon={<DismissCircleRegular fontSize={22} />} color="var(--gray)" bg="var(--gray-bg)" border="var(--gray-bd)" />
              <StatBox label={isRu ? 'Опоздали' : 'Kechikkanlar'} value={summary.late_today} icon={<ClockRegular fontSize={22} />} color="var(--yellow)" bg="var(--yellow-bg)" border="var(--yellow-bd)" sub={`${Math.round(lateRate)}% ${isRu ? 'от пришедших' : 'kelganlardan'}`} />
              <StatBox label={isRu ? 'Пользователи' : 'Foydalanuvchilar'} value={summary.users} icon={<PersonRegular fontSize={22} />} color="var(--accent)" bg="var(--accent-bg)" border="var(--accent-bd)" />
              {showCameras && (
                <StatBox label={isRu ? 'Камеры онлайн' : 'Online kameralar'} value={summary.active_cameras} icon={<CameraRegular fontSize={22} />} color="var(--purple)" bg="var(--purple-bg)" border="var(--purple-bd)" sub={`${Math.round(cameraHealth)}% ${isRu ? 'активны' : 'faol'}`} />
              )}
            </div>

            {/* === ROW 3: Weekly Trend + Recent Events === */}
            <div className="db-grid-row3" style={{ gap: 20 }}>
              {/* Weekly Attendance Trend */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowSyncRegular fontSize={16} color="var(--accent)" />
                  {isRu ? 'Посещаемость за неделю' : 'Haftalik davomat'}
                </div>
                {weeklyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--red)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="present" name={isRu ? 'Пришли' : 'Kelgan'} stroke="var(--green)" strokeWidth={2} fill="url(#colorPresent)" />
                      <Area type="monotone" dataKey="absent" name={isRu ? 'Отсутствуют' : 'Kelmagan'} stroke="var(--red)" strokeWidth={2} fill="url(#colorAbsent)" />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    {isRu ? 'Нет данных за неделю' : "Haftalik ma'lumot yo'q"}
                  </div>
                )}
              </div>

              {/* Recent Events */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', maxHeight: 360, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClockRegular fontSize={16} color="var(--yellow)" />
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
                  <BuildingRegular fontSize={16} color="var(--purple)" />
                  {isRu ? 'Организации' : 'Tashkilotlar'}
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 400 }}>({orgs.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {orgs.map(org => <OrgCard key={org.id} org={org} isRu={isRu} showCameras={showCameras} />)}
                </div>
              </div>
            )}

            {/* === ROW 5: Charts Section === */}
            <div className="db-grid-row5" style={{ gap: 20 }}>
              
              {/* Attendance Pie */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{isRu ? 'Срез посещаемости' : 'Davomat kesimi'}</div>
                {attendanceData.length > 0 && attendanceData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200} minWidth={0}>
                    <PieChart>
                      <Pie data={attendanceData} innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                        {attendanceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                    {isRu ? 'Нет данных' : "Ma'lumot yo'q"}
                  </div>
                )}
              </div>

              {/* Coefficients */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GlobeRegular fontSize={16} color="var(--accent)" />
                  {isRu ? 'Коэффициенты' : 'Koeffitsiyentlar'}
                </div>
                <ProgressBar label={isRu ? 'Охват посещаемости' : 'Davomat qamrovi'} percent={attendanceRate} color="var(--green)" />
                {showCameras && (
                  <ProgressBar label={isRu ? 'Стабильность камер' : 'Kamera barqarorligi'} percent={cameraHealth} color="var(--accent)" />
                )}
                <ProgressBar label={isRu ? 'Активные подписки' : 'Faol obunalar'} percent={subRate} color="var(--yellow)" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20, textAlign: 'center' }}>
                  <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--green)', fontWeight: 600 }}>{isRu ? 'Активные' : 'Faol'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>{activeSub}</div>
                  </div>
                  <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>{isRu ? 'Ожидание' : 'Kutilmoqda'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{pendingSub}</div>
                  </div>
                  <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--red)', fontWeight: 600 }}>{isRu ? 'Истекли' : 'Tugagan'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)', marginTop: 2 }}>{expiredSub}</div>
                  </div>
                </div>
              </div>

              {/* AI Radar */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{isRu ? 'Поведенческий профиль' : 'Xulqiy profil'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 12 }}>
                  {isRu ? 'На основе дисциплины and покрытия' : 'Intizom va qamrovga asoslangan'}
                </div>
                <ResponsiveContainer width="100%" height={220} minWidth={0} style={{ marginLeft: -16, marginRight: -16 }}>
                  <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                    <PolarGrid stroke="var(--border-3)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="AI" dataKey="A" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* === ROW 6: Org Comparison + Camera Load === */}
            <div className={orgs.length > 1 ? "db-grid-row6" : "db-grid-row6 single"} style={{ gap: 20 }}>
              {/* Org Comparison Bar Chart */}
              {orgs.length > 1 && orgOverviewData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>{isRu ? 'Сравнение организаций' : 'Tashkilotlar taqqoslamasi'}</div>
                  <ResponsiveContainer width="100%" height={260} minWidth={0}>
                    <BarChart data={orgOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey="employees" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="var(--dir-in)" radius={[4,4,0,0]} />
                      {showCameras && <Bar dataKey="cameras" name={isRu ? 'Камеры' : 'Kameralar'} fill="var(--yellow)" radius={[4,4,0,0]} />}
                      <Bar dataKey="users" name={isRu ? 'Пользователи' : 'Users'} fill="var(--purple)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Camera Load */}
              {showCameras && cameraLoadData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CameraRegular fontSize={16} color="var(--purple)" />
                    {isRu ? 'Нагрузка камер' : 'Kamera yuklamasi'}
                  </div>
                  <ResponsiveContainer width="100%" height={260} minWidth={0}>
                    <BarChart data={cameraLoadData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={90} stroke="var(--text-4)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="var(--purple)" radius={[0,4,4,0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
