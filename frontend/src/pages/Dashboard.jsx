import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@fluentui/react-components'
import {
  BuildingRegular, PeopleRegular, CameraRegular,
  CheckmarkCircleRegular, DismissCircleRegular, ClockRegular,
  ArrowSyncRegular, PersonRegular, HeartPulseRegular,
  PulseSquareRegular, TargetRegular
} from '@fluentui/react-icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import PageHero from '../components/PageHero'

// Helpers
function safeRatio(num, den) {
  return den > 0 ? num / den : 0
}

function clampScore(value) {
  return Math.max(20, Math.min(95, Math.round(value)))
}

function StatBox({ label, value, icon, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 6, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        {icon}
      </div>
    </div>
  )
}

function ProgressBar({ label, percent, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, fontWeight: 600, color: 'var(--text-2)' }}>
        <span>{label}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, percent))}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

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

  // Computed metrics
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

  // AI Profile Radar
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

  // Org Overview Data
  const orgOverviewData = useMemo(() => {
    if (!charts.org_overview) return []
    return charts.org_overview.labels.map((lbl, i) => ({
      name: lbl,
      users: charts.org_overview.users[i],
      employees: charts.org_overview.employees[i],
      cameras: charts.org_overview.cameras[i],
    }))
  }, [charts])

  // Attendance Doughnut
  const attendanceData = useMemo(() => {
    if (!charts.attendance_today) return []
    const colors = ['#10b981', '#64748b', '#f59e0b']
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

  // Camera Load
  const cameraLoadData = useMemo(() => {
    if (!charts.camera_load) return []
    return charts.camera_load.labels.map((lbl, i) => ({
      name: lbl, value: charts.camera_load.values[i]
    }))
  }, [charts])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${t('dashboard.title')}`}
        title={t('dashboard.subtitle')}
        sub={dateStr}
        right={
          <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
            <ArrowSyncRegular fontSize={14} style={{ animation: spin ? 'spin 0.6s linear infinite' : 'none' }} />
            {t('dashboard.refresh')}
          </button>
        }
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px 80px' }}>
        
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 1. Header Metrics Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Pulse */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ width: 100, height: 14, background: 'var(--border-2)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: 80, height: 42, background: 'var(--border)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                </div>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-2)', animation: 'pulse 1.5s infinite' }} />
              </div>
              {/* Today's Brief */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', gridColumn: 'span 2' }}>
                <div style={{ width: 140, height: 18, background: 'var(--border-2)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i}>
                      <div style={{ width: '60%', height: 12, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                      <div style={{ width: '40%', height: 24, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Grid Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ width: '50%', height: 11, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ width: '30%', height: 28, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface-2)', animation: 'pulse 1.5s infinite' }} />
                </div>
              ))}
            </div>

            {/* 3. Deep Analytics Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', height: 360 }}>
                  <div style={{ width: 200, height: 18, background: 'var(--border-2)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: '100%', height: 280, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', height: 320 }}>
                  <div style={{ width: 240, height: 18, background: 'var(--border-2)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: '100%', height: 240, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                  <div style={{ width: 120, height: 18, background: 'var(--border-2)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
                  {[1,2,3].map(i => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ width: 100, height: 12, background: 'var(--surface-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                        <div style={{ width: 30, height: 12, background: 'var(--border-2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, animation: 'pulse 1.5s infinite' }} />
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 24 }}>
                    {[1,2,3].map(i => <div key={i} style={{ height: 48, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />)}
                  </div>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', height: 340 }}>
                   <div style={{ width: 180, height: 18, background: 'var(--border-2)', borderRadius: 4, marginBottom: 20, animation: 'pulse 1.5s infinite' }} />
                   <div style={{ width: '100%', height: 250, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 6, padding: '16px 20px', color: 'var(--red)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* 1. Header Metrics (Pulse + Top Stats) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Tizim Pulsi */}
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <HeartPulseRegular fontSize={16} />
                    {isRu ? 'Индекс системы' : 'Tizim indeksi'}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>
                    {Math.round(systemPulse)}<span style={{ fontSize: 18, color: 'var(--text-4)' }}>/100</span>
                  </div>
                </div>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: `conic-gradient(var(--accent) ${systemPulse}%, transparent ${systemPulse}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 68, height: 68, background: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <PulseSquareRegular fontSize={32} />
                  </div>
                </div>
              </div>

              {/* Today's Brief */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px', gridColumn: 'span 2' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{isRu ? 'Сводка на сегодня' : 'Bugungi xulosa'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Организации' : 'Tashkilotlar'}</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.organizations}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Сотрудники' : 'Xodimlar'}</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.employees}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Камеры' : 'Kameralar'}</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.active_cameras} / {summary.cameras}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>{isRu ? 'Доля опозданий' : 'Kechikish ulushi'}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{Math.round(lateRate)}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Grid Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <StatBox label={t('dashboard.present')} value={summary.present_today} icon={<CheckmarkCircleRegular fontSize={24} />} color="#10b981" />
              <StatBox label={t('dashboard.absent')}  value={summary.absent_today}  icon={<DismissCircleRegular fontSize={24} />} color="#64748b" />
              <StatBox label={t('dashboard.late')}    value={summary.late_today}    icon={<ClockRegular fontSize={24} />} color="#f59e0b" />
              <StatBox label={t('dashboard.users')}   value={summary.users}         icon={<PersonRegular fontSize={24} />} color="#0ea5e9" />
            </div>

            {/* 3. Deep Analytics Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
              
              {/* Left Column: Charts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Org Comparison */}
                {orgs.length > 1 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{isRu ? 'Сравнение организаций' : 'Tashkilotlar taqqoslamasi'}</div>
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orgOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Bar dataKey="users" name={isRu ? 'Пользователи' : 'Users'} fill="#0f766e" radius={[4,4,0,0]} />
                          <Bar dataKey="employees" name={isRu ? 'Сотрудники' : 'Xodimlar'} fill="#0284c7" radius={[4,4,0,0]} />
                          <Bar dataKey="cameras" name={isRu ? 'Камеры' : 'Kameralar'} fill="#f59e0b" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Camera Load */}
                {cameraLoadData.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{isRu ? 'Нагрузка на камеры (Сотрудники)' : 'Kameralar yuklamasi (Xodimlar)'}</div>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cameraLoadData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis type="number" stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={100} stroke="var(--text-4)" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip cursor={{fill: 'var(--surface-2)'}} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: AI Profile & Signals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Signals */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TargetRegular fontSize={18} color="var(--accent)" />
                    {isRu ? 'Коэффициенты' : 'Koeffitsiyentlar'}
                  </div>
                  <ProgressBar label={isRu ? 'Охват посещаемости' : 'Davomat qamrovi'} percent={attendanceRate} color="#10b981" />
                  <ProgressBar label={isRu ? 'Стабильность камер' : 'Kamera barqarorligi'} percent={cameraHealth} color="#3b82f6" />
                  <ProgressBar label={isRu ? 'Активные подписки' : 'Faol obunalar'} percent={subRate} color="#f59e0b" />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 24, textAlign: 'center' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px 8px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#10b981', fontWeight: 600 }}>Faol</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#10b981', marginTop: 4 }}>{activeSub}</div>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px 8px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#3b82f6', fontWeight: 600 }}>Kutilmoqda</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#3b82f6', marginTop: 4 }}>{pendingSub}</div>
                    </div>
                    <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '12px 8px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#f43f5e', fontWeight: 600 }}>Tugagan</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#f43f5e', marginTop: 4 }}>{expiredSub}</div>
                    </div>
                  </div>
                </div>

                {/* AI Radar */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{isRu ? 'Поведенческий профиль (AI)' : 'Xulqiy profil (AI)'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 20 }}>
                    {isRu ? 'Профиль собирается из дисциплины и покрытия' : 'Profil kelish intizomi va qamroviga asoslanadi'}
                  </div>
                  <div style={{ height: 260, marginLeft: -20, marginRight: -20 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="var(--border-3)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="AI" dataKey="A" stroke="#0ea5e9" strokeWidth={2} fill="#0ea5e9" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Today's Chart */}
                {attendanceData.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 0 2px rgba(0,0,0,0.06)', padding: '24px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{isRu ? 'Срез посещаемости' : 'Davomat kesimi'}</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attendanceData} innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                            {attendanceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <RechartsTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }} itemStyle={{ color: 'var(--text-1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  )
}
