import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  Text,
  Title3,
  Caption1,
  Subtitle2,
  Body1,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  CardHeader,
  Badge,
  Divider,
} from '@fluentui/react-components'
import {
  BuildingRegular, CameraRegular,
  CheckmarkCircleRegular, DismissCircleRegular, ClockRegular,
  ArrowSyncRegular, PersonRegular, HeartPulseRegular,
  PulseSquareRegular, TargetRegular,
  MapRegular, SettingsRegular, CalendarClockRegular, HistoryRegular,
  PeopleTeamRegular, ArrowTrendingRegular, Wifi4Regular,
} from '@fluentui/react-icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import PageHero from '../components/PageHero'

const dashGridStyle = `
@keyframes dash-spin { to { transform: rotate(360deg); } }
.dash-page { min-height: calc(100vh - 52px); background: var(--bg); color: var(--text-1); overflow-y: auto; }
.dash-inner { max-width: 1280px; margin: 0 auto; padding: 24px 24px 80px; }
@media (min-width: 900px) { .dash-inner { padding-left: 32px; padding-right: 32px; } }
.dash-layout { display: grid; gap: 20px; grid-template-columns: repeat(12, minmax(0, 1fr)); }
.dash-pulse { grid-column: 1 / -1; min-width: 0; }
.dash-brief { grid-column: 1 / -1; min-width: 0; }
@media (min-width: 1024px) {
  .dash-pulse { grid-column: span 4; }
  .dash-brief { grid-column: span 8; }
}
.dash-stats { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 16px; }
.dash-insights { grid-column: 1 / -1; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); align-items: stretch; }
.dash-analytics { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
@media (min-width: 1024px) {
  .dash-analytics { grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr); }
}
.dash-col-left, .dash-col-right { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.dash-chart-box { width: 100%; min-width: 0; min-height: 240px; }
.dash-extras { grid-column: 1 / -1; display: grid; gap: 20px; grid-template-columns: 1fr; min-width: 0; align-items: start; }
@media (min-width: 1024px) {
  .dash-extras { grid-template-columns: minmax(0, 1.35fr) minmax(260px, 1fr); }
}
.dash-org-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dash-org-table th { text-align: left; padding: 10px 12px; color: var(--text-4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-2); white-space: nowrap; }
.dash-org-table td { padding: 12px; border-bottom: 1px solid var(--border-2); color: var(--text-1); vertical-align: top; }
.dash-org-table tr:last-child td { border-bottom: none; }
`

const skAnim = { animation: 'pulse 1.4s ease-in-out infinite' }

function SkLine({ w, h = 10, mb = 0, style }) {
  return (
    <div
      style={{
        height: h,
        width: typeof w === 'number' ? `${w}%` : w,
        background: 'var(--surface-2)',
        borderRadius: 6,
        marginBottom: mb,
        ...skAnim,
        ...style,
      }}
    />
  )
}

function SkCircle({ size = 80 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--surface-2)',
        flexShrink: 0,
        ...skAnim,
      }}
    />
  )
}

function DashboardSkeleton() {
  const skCard = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    boxShadow: 'var(--shadow-sm)',
    minWidth: 0,
  }
  const skAccentCard = {
    ...skCard,
    background: 'var(--accent-bg)',
    borderColor: 'var(--accent-bd)',
  }
  return (
    <div className="dash-layout">
      <div className="dash-pulse" style={skAccentCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkLine w={55} h={12} mb={14} style={{ maxWidth: 160 }} />
            <SkLine w={28} h={36} mb={0} style={{ maxWidth: 100 }} />
          </div>
          <SkCircle size={80} />
        </div>
      </div>

      <div className="dash-brief" style={skCard}>
        <SkLine w={40} h={14} mb={20} style={{ maxWidth: 200 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <SkLine w={70} h={10} mb={8} />
              <SkLine w={45} h={22} mb={0} />
            </div>
          ))}
        </div>
      </div>

      <div className="dash-stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...skCard, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SkLine w={55} h={10} mb={10} />
              <SkLine w={35} h={26} mb={0} />
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0, ...skAnim }} />
          </div>
        ))}
      </div>

      <div className="dash-insights">
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...skCard, minHeight: 168 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--surface-2)', flexShrink: 0, ...skAnim }} />
              <div style={{ flex: 1 }}>
                <SkLine w={55} h={12} mb={8} style={{ maxWidth: 160 }} />
                <SkLine w={85} h={10} mb={0} />
              </div>
            </div>
            <SkLine w={100} h={8} mb={8} />
            <SkLine w={100} h={6} mb={0} />
          </div>
        ))}
      </div>

      <div className="dash-extras">
        <div style={skCard}>
          <SkLine w={35} h={14} mb={16} style={{ maxWidth: 200 }} />
          <SkLine w={100} h={12} mb={10} />
          <SkLine w={100} h={12} mb={10} />
          <SkLine w={100} h={12} mb={0} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={skCard}>
            <SkLine w={50} h={12} mb={14} style={{ maxWidth: 160 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: 32, width: 88, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
              ))}
            </div>
          </div>
          <div style={skCard}>
            <SkLine w={40} h={12} mb={14} style={{ maxWidth: 140 }} />
            <div style={{ width: '100%', height: 180, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
          </div>
        </div>
      </div>

      <div className="dash-analytics">
        <div className="dash-col-left">
          <div style={skCard}>
            <SkLine w={50} h={14} mb={20} style={{ maxWidth: 240 }} />
            <div style={{ width: '100%', height: 300, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
          </div>
          <div style={skCard}>
            <SkLine w={55} h={14} mb={20} style={{ maxWidth: 280 }} />
            <div style={{ width: '100%', height: 260, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
          </div>
        </div>
        <div className="dash-col-right">
          <div style={skCard}>
            <SkLine w={45} h={14} mb={20} style={{ maxWidth: 160 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SkLine w={55} h={10} mb={0} style={{ maxWidth: 140 }} />
                  <SkLine w={20} h={10} mb={0} style={{ maxWidth: 36 }} />
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', ...skAnim }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 56, borderRadius: 10, background: 'var(--surface-2)', ...skAnim }} />
              ))}
            </div>
          </div>
          <div style={skCard}>
            <SkLine w={60} h={14} mb={10} style={{ maxWidth: 220 }} />
            <SkLine w={90} h={12} mb={18} />
            <div style={{ width: '100%', height: 260, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
          </div>
          <div style={skCard}>
            <SkLine w={40} h={14} mb={16} style={{ maxWidth: 180 }} />
            <div style={{ width: '100%', height: 220, borderRadius: 8, background: 'var(--surface-2)', ...skAnim }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function safeRatio(num, den) {
  return den > 0 ? num / den : 0
}

function clampScore(value) {
  return Math.max(20, Math.min(95, Math.round(value)))
}

const cardRoot = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  boxShadow: 'var(--shadow-sm)',
  minWidth: 0,
}

const cardHover = {
  onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'var(--accent-bd)' },
  onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'var(--border)' },
}

function DashCard({ children, style, className, onMouseEnter, onMouseLeave }) {
  return (
    <Card
      appearance="outline"
      className={className}
      style={{ ...cardRoot, ...style }}
      onMouseEnter={(e) => {
        cardHover.onMouseEnter(e)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        cardHover.onMouseLeave(e)
        onMouseLeave?.(e)
      }}
    >
      {children}
    </Card>
  )
}

function sectionHeading(icon, text) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {icon}
      <Subtitle2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', fontWeight: 700, fontSize: 13 }}>
        {text}
      </Subtitle2>
    </div>
  )
}

const STAT_PALETTE = {
  green:   { bg: 'var(--green-bg)',  bd: 'var(--green-bd)',  fg: 'var(--green)' },
  neutral: { bg: 'var(--surface-2)', bd: 'var(--border-2)', fg: 'var(--text-3)' },
  yellow:  { bg: 'var(--yellow-bg)', bd: 'var(--yellow-bd)', fg: 'var(--yellow)' },
  brand:   { bg: 'var(--accent-bg)',  bd: 'var(--accent-bd)', fg: 'var(--accent-tx)' },
}

function StatCard({ label, value, icon, palette }) {
  const p = STAT_PALETTE[palette] || STAT_PALETTE.neutral
  return (
    <Card appearance="outline" style={{ ...cardRoot }} {...cardHover}>
      <CardHeader
        image={
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: p.bg,
              border: `1px solid ${p.bd}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: p.fg,
            }}
          >
            {icon}
          </div>
        }
        header={<Title3 style={{ margin: 0, lineHeight: 1.15, color: 'var(--text-1)' }}>{value}</Title3>}
        description={
          <Caption1 style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: 'var(--text-4)' }}>
            {label}
          </Caption1>
        }
      />
    </Card>
  )
}

function SubStatusBadge({ status, t }) {
  const s = String(status || '').toLowerCase()
  const color = s === 'active' ? 'success' : s === 'expired' ? 'danger' : 'warning'
  const key = s === 'expired' ? 'expired' : s === 'active' ? 'active' : 'pending'
  return (
    <Badge appearance="tint" color={color} size="medium">
      {t(`dashboard.${key}`)}
    </Badge>
  )
}

function InsightCard({ icon, title, description, children, tint }) {
  const tintStyle = tint
    ? { background: 'var(--accent-bg)', borderColor: 'var(--accent-bd)' }
    : {}
  return (
    <Card appearance="outline" style={{ ...cardRoot, ...tintStyle, display: 'flex', flexDirection: 'column', height: '100%' }} {...cardHover}>
      <CardHeader
        image={
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              color: 'var(--accent-tx)',
            }}
          >
            {icon}
          </span>
        }
        header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{title}</Subtitle2>}
        description={<Caption1 style={{ color: 'var(--text-4)' }}>{description}</Caption1>}
      />
      <Divider style={{ margin: '0 0 12px' }} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </Card>
  )
}

function KpiProgress({ label, percent, intent }) {
  const v = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Caption1 style={{ color: 'var(--text-2)', fontWeight: 600 }}>{label}</Caption1>
        <Caption1 style={{ color: 'var(--text-3)', fontWeight: 600 }}>{v}%</Caption1>
      </div>
      <ProgressBar value={v} max={100} thickness="medium" color={intent} />
    </div>
  )
}

const QUICK_LINKS = [
  { path: '/devices', Icon: CameraRegular, labelKey: 'nav.devices' },
  { path: '/map', Icon: MapRegular, labelKey: 'nav.map' },
  { path: '/shifts', Icon: CalendarClockRegular, labelKey: 'nav.shifts' },
  { path: '/middleware-logs', Icon: HistoryRegular, labelKey: 'nav.middlewareLogs' },
  { path: '/settings', Icon: SettingsRegular, labelKey: 'nav.settings' },
]

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [spin, setSpin]       = useState(false)
  const navigate = useNavigate()
  const abortRef = useRef(null)

  const load = useCallback(async (animate = false) => {
    if (animate) setSpin(true)
    setError('')
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const isFirstLoad = !animate
      const fetchPromise = fetch('/api/dashboard/metrics', { signal: abortRef.current.signal })

      const res = isFirstLoad
        ? await Promise.all([fetchPromise, new Promise(r => setTimeout(r, 800))]).then(arr => arr[0])
        : await fetchPromise

      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.dashboard || json)
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 400)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(t('dashboard.errLoad'))
      setLoading(false)
      if (animate) setTimeout(() => setSpin(false), 400)
    }
  }, [navigate, t])

  useEffect(() => {
    load()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [load])

  const summary = data?.summary || {}
  const orgs    = data?.org_cards || []
  const charts  = data?.charts || {}
  const now     = new Date()
  const locale  = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const isRu    = i18n.language === 'ru'

  const attendanceTotal = (summary.present_today || 0) + (summary.absent_today || 0)
  const attendanceRate  = attendanceTotal ? (summary.present_today * 100 / attendanceTotal) : 0
  const cameraHealth    = summary.cameras ? (summary.active_cameras * 100 / summary.cameras) : 0
  const lateRate        = summary.present_today ? (summary.late_today * 100 / summary.present_today) : 0

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

  const orgOverviewData = useMemo(() => {
    if (!charts.org_overview) return []
    return charts.org_overview.labels.map((lbl, i) => ({
      name: lbl,
      users: charts.org_overview.users[i],
      employees: charts.org_overview.employees[i],
      cameras: charts.org_overview.cameras[i],
    }))
  }, [charts])

  const attendanceData = useMemo(() => {
    if (!charts.attendance_today) return []
    const colors = ['var(--green)', 'var(--text-3)', 'var(--yellow)']
    const lblMap = {
      present: isRu ? 'Пришли' : 'Kelgan',
      absent: isRu ? 'Отсутствуют' : 'Kelmadi',
      late: isRu ? 'Опоздали' : 'Kechikkan'
    }
    return charts.attendance_today.labels.map((lbl, i) => ({
      name: lblMap[lbl] || lbl,
      value: charts.attendance_today.values[i],
      color: colors[i % colors.length]
    }))
  }, [charts, isRu])

  const cameraLoadData = useMemo(() => {
    if (!charts.camera_load) return []
    return charts.camera_load.labels.map((lbl, i) => ({
      name: lbl, value: charts.camera_load.values[i]
    }))
  }, [charts])

  const subscriptionData = useMemo(() => {
    if (!charts.subscription?.labels?.length) return []
    const keys = { active: 'active', pending: 'pending', expired: 'expired' }
    const colors = ['var(--green)', 'var(--yellow)', 'var(--red)']
    return charts.subscription.labels.map((lbl, i) => ({
      name: t(`dashboard.${keys[lbl] || lbl}`),
      value: Number(charts.subscription.values[i] ?? 0),
      color: colors[i % colors.length],
    }))
  }, [charts, t])

  const subscriptionTotal = useMemo(() => subscriptionData.reduce((a, x) => a + x.value, 0), [subscriptionData])

  const empPerCam = (summary.cameras ?? 0) > 0
    ? (Number(summary.employees || 0) / Number(summary.cameras)).toFixed(1)
    : '—'
  const offlineCams = Math.max(0, (summary.cameras ?? 0) - (summary.active_cameras ?? 0))

  const userEmpRatioPct = (summary.employees ?? 0) > 0
    ? Math.min(100, Math.round((Number(summary.users || 0) / Number(summary.employees)) * 100))
    : 0

  const subTiles = [
    { key: 'active', label: t('dashboard.active'), value: activeSub, bg: 'var(--green-bg)', bd: 'var(--green-bd)', fg: 'var(--green)' },
    { key: 'pending', label: t('dashboard.pending'), value: pendingSub, bg: 'var(--yellow-bg)', bd: 'var(--yellow-bd)', fg: 'var(--yellow)' },
    { key: 'expired', label: t('dashboard.expired'), value: expiredSub, bg: 'var(--red-bg)', bd: 'var(--red-bd)', fg: 'var(--red)' },
  ]

  return (
    <div className="dash-page">
      <style>{dashGridStyle}</style>
      <PageHero
        badge={`✦ ${t('dashboard.title')}`}
        title={t('dashboard.subtitle')}
        sub={dateStr}
        right={
          <Button
            appearance="secondary"
            icon={
              <span style={{ display: 'inline-flex', animation: spin ? 'dash-spin 0.65s linear infinite' : 'none' }}>
                <ArrowSyncRegular fontSize={16} />
              </span>
            }
            onClick={() => load(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.18)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {t('dashboard.refresh')}
          </Button>
        }
      />

      <div className="dash-inner">
        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <MessageBar intent="error" style={{ borderRadius: 10 }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {!loading && !error && data && (
          <div className="dash-layout">
            <DashCard
              className="dash-pulse"
              style={{
                background: 'var(--accent-bg)',
                borderColor: 'var(--accent-bd)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <Caption1 style={{ color: 'var(--accent-tx)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <HeartPulseRegular fontSize={16} style={{ flexShrink: 0 }} />
                    {isRu ? 'Индекс системы' : 'Tizim indeksi'}
                  </Caption1>
                  <Title3 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
                    {Math.round(systemPulse)}
                    <Text style={{ fontSize: 18, color: 'var(--text-4)', fontWeight: 600, marginLeft: 4 }}>/100</Text>
                  </Title3>
                </div>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: `conic-gradient(var(--accent) ${systemPulse}%, transparent ${systemPulse}%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 68, height: 68, background: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <PulseSquareRegular fontSize={30} />
                  </div>
                </div>
              </div>
            </DashCard>

            <DashCard className="dash-brief">
              <CardHeader
                header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{isRu ? 'Сводка на сегодня' : 'Bugungi xulosa'}</Subtitle2>}
                description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('dashboard.briefHint')}</Caption1>}
              />
              <Divider style={{ margin: '8px 0 18px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 20 }}>
                {[
                  { k: 'o', lab: isRu ? 'Организации' : 'Tashkilotlar', val: summary.organizations },
                  { k: 'e', lab: isRu ? 'Сотрудники' : 'Xodimlar', val: summary.employees },
                  { k: 'c', lab: isRu ? 'Камеры' : 'Kameralar', val: `${summary.active_cameras ?? 0} / ${summary.cameras ?? 0}` },
                  { k: 'l', lab: isRu ? 'Доля опозданий' : 'Kechikish ulushi', val: `${Math.round(lateRate)}%`, accent: true },
                  { k: 'a', lab: t('dashboard.attendancePct'), val: `${Math.round(attendanceRate)}%` },
                  { k: 'f', lab: t('dashboard.offlineCams'), val: offlineCams, accent: offlineCams > 0 },
                ].map(row => (
                  <div key={row.k}>
                    <Caption1 block style={{ color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>{row.lab}</Caption1>
                    <Text style={{ fontSize: 22, fontWeight: 700, color: row.accent ? 'var(--red)' : 'var(--text-1)' }}>{row.val ?? '—'}</Text>
                  </div>
                ))}
              </div>
            </DashCard>

            <div className="dash-stats">
              <StatCard label={t('dashboard.present')} value={summary.present_today ?? 0} icon={<CheckmarkCircleRegular fontSize={22} />} palette="green" />
              <StatCard label={t('dashboard.absent')}  value={summary.absent_today ?? 0}  icon={<DismissCircleRegular fontSize={22} />} palette="neutral" />
              <StatCard label={t('dashboard.late')}    value={summary.late_today ?? 0}    icon={<ClockRegular fontSize={22} />} palette="yellow" />
              <StatCard label={t('dashboard.users')}   value={summary.users ?? 0}         icon={<PersonRegular fontSize={22} />} palette="brand" />
            </div>

            <div className="dash-insights">
              <InsightCard
                icon={<Wifi4Regular fontSize={22} />}
                title={t('dashboard.insightNetTitle')}
                description={t('dashboard.insightNetSub')}
              >
                <Body1 style={{ color: 'var(--text-2)', marginBottom: 10, fontWeight: 600 }}>
                  {summary.active_cameras ?? 0}
                  <Text style={{ color: 'var(--text-4)', fontWeight: 500, margin: '0 6px' }}>/</Text>
                  {summary.cameras ?? 0}
                  <Caption1 style={{ display: 'block', marginTop: 6, color: 'var(--text-4)', fontWeight: 500 }}>
                    {t('dashboard.camOnlineLabel')}
                  </Caption1>
                </Body1>
                <ProgressBar value={Math.round(cameraHealth)} max={100} thickness="large" color="brand" />
              </InsightCard>

              <InsightCard
                icon={<PeopleTeamRegular fontSize={22} />}
                title={t('dashboard.insightAccessTitle')}
                description={t('dashboard.insightAccessSub')}
                tint
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Title3 style={{ margin: 0 }}>{summary.users ?? 0}</Title3>
                  <Text style={{ color: 'var(--text-4)', fontSize: 20 }}>/</Text>
                  <Title3 style={{ margin: 0 }}>{summary.employees ?? 0}</Title3>
                  <Caption1 style={{ color: 'var(--text-4)', fontWeight: 600 }}>({t('dashboard.userPerEmpHint')})</Caption1>
                </div>
                {(summary.employees ?? 0) > 0 ? (
                  <ProgressBar value={userEmpRatioPct} max={100} thickness="large" color="success" />
                ) : (
                  <Caption1 style={{ color: 'var(--text-4)' }}>—</Caption1>
                )}
              </InsightCard>

              <InsightCard
                icon={<ArrowTrendingRegular fontSize={22} />}
                title={t('dashboard.insightScaleTitle')}
                description={t('dashboard.insightScaleSub')}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, alignItems: 'stretch' }}>
                  {[
                    { k: 'org', v: summary.organizations ?? 0, lab: t('dashboard.orgs') },
                    { k: 'emp', v: summary.employees ?? 0, lab: t('dashboard.employees') },
                    { k: 'cam', v: summary.cameras ?? 0, lab: t('dashboard.cameras') },
                  ].map((cell, idx) => (
                    <div
                      key={cell.k}
                      style={{
                        textAlign: 'center',
                        padding: '8px 10px',
                        borderRight: idx < 2 ? '1px solid var(--border-2)' : undefined,
                      }}
                    >
                      <Title3 style={{ margin: '0 0 4px', color: 'var(--text-1)' }}>{cell.v}</Title3>
                      <Caption1 style={{ color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cell.lab}</Caption1>
                    </div>
                  ))}
                </div>
                <Body1 style={{ color: 'var(--text-3)', marginTop: 14, fontSize: 13, lineHeight: 1.45 }}>
                  {t('dashboard.empPerCam')}: <strong style={{ color: 'var(--text-1)' }}>{empPerCam}</strong>
                  {' · '}
                  {t('dashboard.offlineCams')}: <strong style={{ color: offlineCams > 0 ? 'var(--red)' : 'var(--text-1)' }}>{offlineCams}</strong>
                </Body1>
              </InsightCard>
            </div>

            {orgs.length > 0 && (
              <div className="dash-extras">
                <DashCard style={{ padding: 0, overflow: 'hidden' }}>
                  <CardHeader
                    style={{ padding: '20px 20px 8px' }}
                    image={<BuildingRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                    header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{t('dashboard.orgCards')}</Subtitle2>}
                    description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('dashboard.orgListHint')}</Caption1>}
                  />
                  <div style={{ padding: '0 12px 16px', overflow: 'auto', maxHeight: 420 }}>
                    <table className="dash-org-table">
                      <thead>
                        <tr>
                          <th>{t('dashboard.thOrg')}</th>
                          <th>{t('dashboard.thSub')}</th>
                          <th>{t('dashboard.thUe')}</th>
                          <th>{t('dashboard.thCam')}</th>
                          <th>{t('dashboard.thToday')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map((o) => {
                          const camLabel = `${o.active_camera_count ?? 0}/${o.camera_count ?? 0}`
                          const names = (o.camera_names || []).filter(Boolean).join(', ')
                          return (
                            <tr key={o.id}>
                              <td style={{ fontWeight: 600 }}>{o.name}</td>
                              <td>
                                <SubStatusBadge status={o.subscription_status} t={t} />
                              </td>
                              <td>
                                <Text style={{ fontSize: 13 }}>{o.user_count ?? 0}</Text>
                                <Text style={{ fontSize: 13, color: 'var(--text-4)' }}> / </Text>
                                <Text style={{ fontSize: 13 }}>{o.employee_count ?? 0}</Text>
                              </td>
                              <td>
                                <Text style={{ fontSize: 13, fontWeight: 600 }}>{camLabel}</Text>
                                {names ? (
                                  <Caption1 block style={{ color: 'var(--text-4)', marginTop: 6, lineHeight: 1.35 }} title={names}>
                                    {t('dashboard.sampleCams')}: {names}
                                  </Caption1>
                                ) : null}
                              </td>
                              <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: 'var(--green)' }}>{o.present_today ?? 0}</span>
                                <Text style={{ color: 'var(--text-4)', margin: '0 4px' }}>/</Text>
                                <span style={{ color: 'var(--text-3)' }}>{o.absent_today ?? 0}</span>
                                <Text style={{ color: 'var(--text-4)', margin: '0 4px' }}>/</Text>
                                <span style={{ color: 'var(--yellow)' }}>{o.late_today ?? 0}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </DashCard>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                  <DashCard>
                    <CardHeader
                      header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{t('dashboard.quickNav')}</Subtitle2>}
                      description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('dashboard.quickNavHint')}</Caption1>}
                    />
                    <Divider style={{ margin: '4px 0 14px' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {QUICK_LINKS.map(({ path, Icon, labelKey }) => (
                        <Button key={path} size="small" appearance="secondary" icon={<Icon fontSize={16} />} onClick={() => navigate(path)}>
                          {t(labelKey)}
                        </Button>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-2)', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('dashboard.empPerCam')}</Caption1>
                        <Text style={{ fontSize: 20, fontWeight: 700 }}>{empPerCam}</Text>
                      </div>
                      <div>
                        <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('dashboard.users')}</Caption1>
                        <Text style={{ fontSize: 20, fontWeight: 700 }}>{summary.users ?? 0}</Text>
                      </div>
                    </div>
                  </DashCard>

                  {subscriptionTotal > 0 && subscriptionData.length > 0 && (
                    <DashCard>
                      <CardHeader
                        image={<TargetRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                        header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{t('dashboard.subscriptionMix')}</Subtitle2>}
                        description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('dashboard.subscriptionHint')}</Caption1>}
                      />
                      <Divider style={{ margin: '4px 0 12px' }} />
                      <div className="dash-chart-box" style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                          <PieChart>
                            <Pie data={subscriptionData} innerRadius={52} outerRadius={76} paddingAngle={2} dataKey="value" stroke="none">
                              {subscriptionData.map((entry, index) => <Cell key={`sub-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} itemStyle={{ color: 'var(--text-1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </DashCard>
                  )}
                </div>
              </div>
            )}

            <div className="dash-analytics">
              <div className="dash-col-left">
                {orgs.length === 1 && (
                  <DashCard>
                    {sectionHeading(<BuildingRegular fontSize={18} style={{ color: 'var(--accent)' }} />, orgs[0].name)}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <SubStatusBadge status={orgs[0].subscription_status} t={t} />
                      <Caption1 style={{ color: 'var(--text-3)' }}>
                        {t('dashboard.users')}: <strong style={{ color: 'var(--text-1)' }}>{orgs[0].user_count ?? 0}</strong>
                        {' · '}
                        {t('dashboard.employees')}: <strong style={{ color: 'var(--text-1)' }}>{orgs[0].employee_count ?? 0}</strong>
                        {' · '}
                        {t('dashboard.cameras')}: <strong style={{ color: 'var(--text-1)' }}>{orgs[0].active_camera_count ?? 0}/{orgs[0].camera_count ?? 0}</strong>
                      </Caption1>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
                      <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-2)' }}>
                        <Caption1 style={{ color: 'var(--green)', fontWeight: 700 }}>{t('dashboard.present')}</Caption1>
                        <Title3 style={{ margin: '4px 0 0', color: 'var(--text-1)' }}>{orgs[0].present_today ?? 0}</Title3>
                      </div>
                      <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-2)' }}>
                        <Caption1 style={{ color: 'var(--text-3)', fontWeight: 700 }}>{t('dashboard.absent')}</Caption1>
                        <Title3 style={{ margin: '4px 0 0', color: 'var(--text-1)' }}>{orgs[0].absent_today ?? 0}</Title3>
                      </div>
                      <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-2)' }}>
                        <Caption1 style={{ color: 'var(--yellow)', fontWeight: 700 }}>{t('dashboard.late')}</Caption1>
                        <Title3 style={{ margin: '4px 0 0', color: 'var(--text-1)' }}>{orgs[0].late_today ?? 0}</Title3>
                      </div>
                    </div>
                    {(orgs[0].camera_names || []).length > 0 && (
                      <Caption1 style={{ color: 'var(--text-4)', lineHeight: 1.45 }}>
                        <strong style={{ color: 'var(--text-2)' }}>{t('dashboard.sampleCams')}:</strong>{' '}
                        {(orgs[0].camera_names || []).join(', ')}
                      </Caption1>
                    )}
                  </DashCard>
                )}

                {orgs.length > 1 && (
                  <DashCard>
                    {sectionHeading(<BuildingRegular fontSize={18} style={{ color: 'var(--accent)' }} />, isRu ? 'Сравнение организаций' : 'Tashkilotlar taqqoslamasi')}
                    <div className="dash-chart-box" style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                        <BarChart data={orgOverviewData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Bar dataKey="users" name={isRu ? 'Пользователи' : 'Users'} fill="var(--accent)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="employees" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="#038387" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="cameras" name={isRu ? 'Камеры' : 'Kameralar'} fill="var(--yellow)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </DashCard>
                )}

                {cameraLoadData.length > 0 && (
                  <DashCard>
                    {sectionHeading(<CameraRegular fontSize={18} style={{ color: 'var(--accent)' }} />, isRu ? 'Нагрузка на камеры (Сотрудники)' : 'Kameralar yuklamasi (Xodimlar)')}
                    <div className="dash-chart-box" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                        <BarChart data={cameraLoadData} layout="vertical" margin={{ top: 8, right: 24, left: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis type="number" stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={100} stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} />
                          <Bar dataKey="value" fill="var(--accent-tx)" radius={[0, 4, 4, 0]} barSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </DashCard>
                )}
              </div>

              <div className="dash-col-right">
                <DashCard>
                  <CardHeader
                    image={<TargetRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                    header={<Subtitle2 style={{ margin: 0, color: 'var(--text-1)', fontWeight: 700 }}>{isRu ? 'Коэффициенты' : 'Koeffitsiyentlar'}</Subtitle2>}
                    description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('dashboard.kpiHint')}</Caption1>}
                  />
                  <Divider style={{ margin: '4px 0 12px' }} />
                  <KpiProgress label={isRu ? 'Охват посещаемости' : 'Davomat qamrovi'} percent={attendanceRate} intent="success" />
                  <KpiProgress label={isRu ? 'Стабильность камер' : 'Kamera barqarorligi'} percent={cameraHealth} intent="brand" />
                  <KpiProgress label={isRu ? 'Активные подписки' : 'Faol obunalar'} percent={subRate} intent="warning" />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 8 }}>
                    {subTiles.map(s => (
                      <div
                        key={s.key}
                        style={{
                          textAlign: 'center',
                          padding: '12px 8px',
                          borderRadius: 10,
                          background: s.bg,
                          border: `1px solid ${s.bd}`,
                        }}
                      >
                        <Caption1 style={{ color: s.fg, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>{s.label}</Caption1>
                        <Title3 style={{ margin: '6px 0 0', color: s.fg, fontWeight: 700 }}>{s.value}</Title3>
                      </div>
                    ))}
                  </div>
                </DashCard>

                <DashCard>
                  {sectionHeading(null, isRu ? 'Поведенческий профиль (AI)' : 'Xulqiy profil (AI)')}
                  <Caption1 style={{ color: 'var(--text-4)', display: 'block', marginTop: -8, marginBottom: 12 }}>
                    {isRu ? 'Профиль собирается из дисциплины и покрытия' : 'Profil kelish intizomi va qamroviga asoslanadi'}
                  </Caption1>
                  <div className="dash-chart-box" style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                      <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                        <PolarGrid stroke="var(--border-3)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="AI" dataKey="A" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-tx)" fillOpacity={0.22} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </DashCard>

                {attendanceData.length > 0 && (
                  <DashCard>
                    {sectionHeading(null, isRu ? 'Срез посещаемости' : 'Davomat kesimi')}
                    <div className="dash-chart-box" style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                        <PieChart>
                          <Pie data={attendanceData} innerRadius={58} outerRadius={82} paddingAngle={2} dataKey="value" stroke="none">
                            {attendanceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} itemStyle={{ color: 'var(--text-1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </DashCard>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
