import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  Text,
  Title3,
  Caption1,
  Subtitle2,
  Switch,
  MessageBar,
  MessageBarBody,
  Badge,
  Input,
  Divider,
  CardHeader,
} from '@fluentui/react-components'
import {
  ServerRegular, ArrowSyncRegular, PlayRegular, ArrowClockwiseRegular, StopRegular,
  CameraRegular, PlugDisconnectedRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useConfirm } from '../components/ConfirmDialog'
import { useNotify } from '../components/Notifications'

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
  minWidth: 0,
}

const hoverCard = {
  onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'var(--accent-bd)' },
  onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'var(--border)' },
}

const skAnim = { animation: 'pulse 1.4s ease-in-out infinite' }
const REDIS_SNAPSHOT_PATTERN = 'bioface:*'
const REDIS_SNAPSHOT_LIMIT = 50
const REDIS_EVENTS_LIMIT = 20

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

function SkBlock({ w = '100%', h = 40, radius = 10, style }) {
  return (
    <div
      style={{
        width: typeof w === 'number' ? `${w}%` : w,
        height: h,
        borderRadius: radius,
        background: 'var(--surface-2)',
        ...skAnim,
        ...style,
      }}
    />
  )
}

function IsupServerSkeleton() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ ...card, padding: '20px 18px' }}>
            <SkLine w={42} h={10} mb={14} style={{ maxWidth: 120 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <SkBlock w={12} h={12} radius={999} />
              <SkLine w={46} h={20} mb={0} style={{ maxWidth: 120 }} />
            </div>
            <SkLine w={86} h={10} mb={8} />
            <SkLine w={72} h={10} mb={8} />
            <SkLine w={54} h={10} mb={0} />
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <SkLine w={24} h={14} mb={10} style={{ maxWidth: 180 }} />
          <SkLine w={40} h={10} mb={0} style={{ maxWidth: 260 }} />
        </div>
        <Divider />
        <div style={{ padding: '12px 20px 20px' }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1.1fr) minmax(160px, 1fr) 110px',
                gap: 16,
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: row < 5 ? '1px solid var(--border-2)' : 'none',
              }}
            >
              <div>
                <SkLine w={48} h={12} mb={8} style={{ maxWidth: 160 }} />
                <SkLine w={82} h={10} mb={0} />
              </div>
              <SkLine w={72} h={12} mb={0} style={{ maxWidth: 180 }} />
              <SkBlock w={72} h={28} radius={999} style={{ justifySelf: 'end' }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <SkLine w={28} h={14} mb={10} style={{ maxWidth: 200 }} />
            <SkLine w={44} h={10} mb={0} style={{ maxWidth: 300 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SkBlock w={220} h={34} radius={8} />
            <SkBlock w={118} h={34} radius={8} />
          </div>
        </div>
        <Divider />
        <div style={{ padding: '10px 20px 20px' }}>
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div
              key={row}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px minmax(180px, 1.3fr) minmax(120px, 1fr) 110px 100px',
                gap: 16,
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: row < 6 ? '1px solid var(--border-2)' : 'none',
              }}
            >
              <SkLine w={70} h={12} mb={0} />
              <SkLine w={64} h={12} mb={0} />
              <SkLine w={58} h={12} mb={0} />
              <SkBlock w={88} h={28} radius={999} />
              <SkBlock w={72} h={28} radius={8} style={{ justifySelf: 'end' }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20, marginBottom: 20 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 12px' }}>
              <SkLine w={28} h={14} mb={10} style={{ maxWidth: 180 }} />
              <SkLine w={46} h={10} mb={0} style={{ maxWidth: 260 }} />
            </div>
            <Divider />
            <div style={{ padding: '18px 20px 20px' }}>
              {[1, 2, 3, 4].map((row) => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: row < 4 ? 14 : 0 }}>
                  <SkBlock h={52} radius={10} />
                  <SkBlock h={52} radius={10} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <SkLine w={22} h={14} mb={10} style={{ maxWidth: 160 }} />
          <SkLine w={34} h={10} mb={0} style={{ maxWidth: 240 }} />
        </div>
        <Divider />
        <div style={{ padding: '12px 20px 20px' }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(180px, 0.9fr) minmax(220px, 1.4fr)',
                gap: 16,
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: row < 5 ? '1px solid var(--border-2)' : 'none',
              }}
            >
              <SkLine w={72} h={12} mb={0} />
              <SkLine w={64} h={12} mb={0} />
              <SkLine w={90} h={12} mb={0} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function formatDuration(sec) {
  if (sec == null || Number.isNaN(Number(sec))) return '—'
  const s = Math.max(0, Math.floor(Number(sec)))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}

function formatCheckedAt(iso, locale) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return String(iso)
  }
}

function countListeningPorts(ports) {
  if (!Array.isArray(ports)) return 0
  return ports.filter((p) => p && p.listening === true).length
}

function buildRedisFallback(error = null) {
  return {
    connected: false,
    host: '127.0.0.1',
    port: 6379,
    pattern: REDIS_SNAPSHOT_PATTERN,
    limit: REDIS_SNAPSHOT_LIMIT,
    checked_at: null,
    ping_ms: null,
    dbsize: 0,
    keys: [],
    channels: [],
    stats: {},
    service: {},
    error,
  }
}

function formatRedisHitRatio(stats) {
  const hits = Number(stats?.keyspace_hits || 0)
  const misses = Number(stats?.keyspace_misses || 0)
  const total = hits + misses
  if (!total) return '—'
  return `${((hits / total) * 100).toFixed(1)}%`
}

function formatRedisPreview(value) {
  if (value == null) return '—'
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 180)}…` : value
  try {
    const text = JSON.stringify(value)
    return text.length > 180 ? `${text.slice(0, 180)}…` : text
  } catch {
    return String(value)
  }
}

function pickBanner(health, process, devices, t) {
  const list = Array.isArray(devices) ? devices : []
  const hasConfiguredOnly = list.some((d) => (d.source || '') === 'configured_only')
  const hasLive = list.some((d) => (d.source || '') !== 'configured_only')
  if (!process.binary_exists) return { intent: 'error', text: t('isup.bannerNoBinary') }
  if (!process.running) return { intent: 'warning', text: t('isup.bannerProcessStopped') }
  if (!health.running) return { intent: 'warning', text: t('isup.bannerHealthOffline') }
  const mode = health.sdk?.mode || process.sdk?.mode || 'emulated'
  if (mode !== 'hikvision_sdk') return { intent: 'warning', text: t('isup.bannerEmulated') }
  if (!(health.sdk?.ready ?? process.sdk?.ready ?? false)) return { intent: 'error', text: t('isup.bannerSdkNotReady') }
  if (hasConfiguredOnly && !hasLive) return { intent: 'warning', text: t('isup.bannerConfiguredOnly') }
  return null
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
  if (!res.ok) {
    const detail = data.detail || data.message || `HTTP ${res.status}`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data
}

export default function IsupServer() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const notify = useNotify()
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState({})
  const [process, setProcess] = useState({})
  const [devices, setDevices] = useState([])
  const [redisSnapshot, setRedisSnapshot] = useState(() => buildRedisFallback())
  const [redisEvents, setRedisEvents] = useState([])
  const [error, setError] = useState('')
  const [banner, setBanner] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [deviceSearch, setDeviceSearch] = useState('')
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setError('')
    try {
      const [h, devList, procRes, redisSnapRes, redisEventsRes] = await Promise.all([
        fetchJson('/api/isup-health'),
        fetchJson('/api/isup-devices'),
        fetchJson('/api/isup/process'),
        fetchJson(`/api/redis/snapshot?pattern=${encodeURIComponent(REDIS_SNAPSHOT_PATTERN)}&limit=${REDIS_SNAPSHOT_LIMIT}`)
          .catch((e) => buildRedisFallback(e.message || t('isup.loadErr'))),
        fetchJson(`/api/redis/events?limit=${REDIS_EVENTS_LIMIT}&today_only=true`)
          .catch(() => ({ items: [] })),
      ])
      const proc = procRes.status || {}
      const devs = Array.isArray(devList) ? devList : []
      const redisSnap = {
        ...buildRedisFallback(),
        ...(redisSnapRes || {}),
        keys: Array.isArray(redisSnapRes?.keys) ? redisSnapRes.keys : [],
        channels: Array.isArray(redisSnapRes?.channels) ? redisSnapRes.channels : [],
        stats: redisSnapRes?.stats || {},
        service: redisSnapRes?.service || {},
      }
      setHealth(h)
      setProcess(proc)
      setDevices(devs)
      setRedisSnapshot(redisSnap)
      setRedisEvents(Array.isArray(redisEventsRes?.items) ? redisEventsRes.items : [])
      setBanner(pickBanner(h, proc, devs, t))
    } catch (e) {
      setError(e.message || t('isup.loadErr'))
      setBanner({ intent: 'error', text: e.message || t('isup.loadErr') })
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const id = setInterval(() => { load() }, 8000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const ports = useMemo(() => health.ports || process.ports || [], [health.ports, process.ports])

  const online = Boolean(health.running)
  const processRunning = Boolean(process.running)
  const statusLabel = online ? t('isup.statusOnline') : (processRunning ? t('isup.statusProcess') : t('isup.statusStopped'))
  const statusColor = online ? 'var(--green)' : (processRunning ? 'var(--yellow)' : 'var(--red)')

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase()
    if (!q) return devices
    return devices.filter((d) => {
      const hay = [
        d.device_id, d.display_name, d.camera_name, d.remote_ip, d.ip, d.port, d.mac_address, d.model, d.source,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [devices, deviceSearch])

  const runProcess = async (action) => {
    setBusy(true)
    try {
      const data = await fetchJson(`/api/isup/process/${action}`, { method: 'POST' })
      setBanner({ intent: 'success', text: data.message || t('isup.actionOk') })
      notify.success({
        title: t(`isup.${action}`),
        body: data.message || t('isup.actionOk'),
      })
      await load()
    } catch (e) {
      setBanner({ intent: 'error', text: `${action}: ${e.message}` })
      notify.error({
        title: t(`isup.${action}`),
        body: e.message || t('isup.loadErr'),
      })
    } finally {
      setBusy(false)
    }
  }

  const disconnectDevice = async (deviceId) => {
    const ok = await confirm({
      title: t('isup.disconnectTitle'),
      message: t('isup.disconnectMsg', { id: deviceId }),
      confirmText: t('isup.disconnectConfirm'),
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await fetchJson(`/api/isup-devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' })
      setBanner({ intent: 'success', text: t('isup.disconnected') })
      notify.success({
        title: t('isup.disconnect'),
        body: t('isup.disconnected'),
      })
      await load()
    } catch (e) {
      setBanner({ intent: 'error', text: e.message })
      notify.error({
        title: t('isup.disconnect'),
        body: e.message || t('isup.loadErr'),
      })
    } finally {
      setBusy(false)
    }
  }

  const listeningCount = countListeningPorts(ports)
  const redisStatusColor = redisSnapshot.connected ? 'var(--green)' : (redisSnapshot.service?.listening === true ? 'var(--yellow)' : 'var(--red)')
  const redisStatusLabel = redisSnapshot.connected ? t('isup.redisOnline') : (redisSnapshot.service?.listening === true ? t('isup.redisDegraded') : t('isup.redisOffline'))
  const redisKeys = useMemo(() => (Array.isArray(redisSnapshot.keys) ? redisSnapshot.keys.slice(0, 12) : []), [redisSnapshot.keys])
  const redisChannels = useMemo(() => (Array.isArray(redisSnapshot.channels) ? redisSnapshot.channels : []), [redisSnapshot.channels])
  const redisRecentEvents = useMemo(() => (Array.isArray(redisEvents) ? redisEvents.slice(0, REDIS_EVENTS_LIMIT) : []), [redisEvents])
  const redisMessageIntent = redisSnapshot.connected ? 'success' : (redisSnapshot.service?.listening === true ? 'warning' : 'error')
  const redisMessage = redisSnapshot.connected ? '' : (redisSnapshot.error || t('isup.redisDisconnectedHint'))

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${t('nav.isupServer')}`}
        title={t('isup.title')}
        sub={t('isup.subtitle')}
        right={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Caption1 style={{ color: 'rgba(255,255,255,0.75)' }}>{t('isup.autoRefresh')}</Caption1>
              <Switch checked={autoRefresh} onChange={(_, d) => setAutoRefresh(Boolean(d.checked))} />
            </div>
            <Button
              appearance="secondary"
              icon={
                <span style={{ display: 'inline-flex', animation: busy ? 'bf-spin 0.65s linear infinite' : 'none' }}>
                  <ArrowSyncRegular />
                </span>
              }
              onClick={() => load()}
              disabled={busy || loading}
              style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
            >
              {t('isup.refresh')}
            </Button>
            <Button appearance="primary" icon={<PlayRegular />} onClick={() => runProcess('start')} disabled={busy}>{t('isup.start')}</Button>
            <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={() => runProcess('restart')} disabled={busy}>{t('isup.restart')}</Button>
            <Button appearance="secondary" icon={<StopRegular />} onClick={() => runProcess('stop')} disabled={busy} style={{ borderColor: 'var(--red-bd)', color: 'var(--red)' }}>{t('isup.stop')}</Button>
          </div>
        }
      />
      <style>{`.bf-spin { animation: spin 0.65s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.42; } }`}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 80px' }}>
        {banner && (
          <MessageBar intent={banner.intent} style={{ marginBottom: 16, borderRadius: 10 }}>
            <MessageBarBody>{banner.text}</MessageBarBody>
          </MessageBar>
        )}

        {loading && <IsupServerSkeleton />}

        {!loading && error && !banner && (
          <MessageBar intent="error" style={{ borderRadius: 10 }}><MessageBarBody>{error}</MessageBarBody></MessageBar>
        )}

        {!loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <Card appearance="outline" style={{ ...card }} {...hoverCard}>
                <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.cardStatus')}</Caption1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                  <Title3 style={{ margin: 0 }}>{statusLabel}</Title3>
                </div>
                <Caption1 block style={{ marginTop: 10, color: 'var(--text-3)' }}>{health.isup_server_url ? `API: ${health.isup_server_url}` : 'API: —'}</Caption1>
                <Caption1 block style={{ color: 'var(--text-4)', marginTop: 4 }}>
                  SDK: {health.sdk?.mode || process.sdk?.mode || '—'}{Boolean(health.sdk?.ready ?? process.sdk?.ready) ? ' (ready)' : ''}
                </Caption1>
                <Caption1 block style={{ color: 'var(--text-5)', marginTop: 6 }}>{t('isup.lastCheck')}: {formatCheckedAt(health.checked_at, locale)}</Caption1>
              </Card>

              <Card appearance="outline" style={{ ...card }} {...hoverCard}>
                <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.cardProcess')}</Caption1>
                <Title3 style={{ margin: '10px 0 4px' }}>{process.pid ?? '—'}</Title3>
                <Caption1 style={{ color: 'var(--text-3)' }}>PID</Caption1>
                <Caption1 block style={{ marginTop: 10, color: 'var(--text-3)' }}>{t('isup.uptime')}: {formatDuration(process.uptime_seconds)}</Caption1>
                <Caption1 block style={{ color: 'var(--text-4)', marginTop: 4 }}>BioFace: {process.panel?.bind || '—'}</Caption1>
              </Card>

              <Card appearance="outline" style={{ ...card }} {...hoverCard}>
                <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.cardResources')}</Caption1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                    <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>RAM</Caption1>
                    <Text style={{ fontSize: 18, fontWeight: 700 }}>{Number(process.memory_mb ?? health.sys_info?.ram_mb ?? 0).toFixed(0)} MB</Text>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                    <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>CPU</Caption1>
                    <Text style={{ fontSize: 18, fontWeight: 700 }}>{Number(process.cpu_percent ?? health.sys_info?.cpu_percent ?? 0).toFixed(1)}%</Text>
                  </div>
                </div>
              </Card>

              <Card appearance="outline" style={{ ...card }} {...hoverCard}>
                <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.cardDevices')}</Caption1>
                <Title3 style={{ margin: '10px 0 4px' }}>{devices.length}</Title3>
                <Caption1 style={{ color: 'var(--text-3)' }}>{t('isup.devicesCount')}</Caption1>
                <Caption1 block style={{ marginTop: 10, color: 'var(--text-4)' }}>
                  {t('isup.portsListening')}: {listeningCount}/{ports.length}
                </Caption1>
              </Card>

              <Card appearance="outline" style={{ ...card }} {...hoverCard}>
                <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.cardRedis')}</Caption1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: redisStatusColor, flexShrink: 0 }} />
                  <Title3 style={{ margin: 0 }}>{redisStatusLabel}</Title3>
                </div>
                <Caption1 block style={{ marginTop: 10, color: 'var(--text-3)' }}>
                  {redisSnapshot.host || '127.0.0.1'}:{redisSnapshot.port || 6379}
                </Caption1>
                <Caption1 block style={{ color: 'var(--text-4)', marginTop: 4 }}>
                  {t('isup.redisPing')}: {redisSnapshot.ping_ms == null ? '—' : `${Number(redisSnapshot.ping_ms).toFixed(2)} ms`}
                </Caption1>
                <Caption1 block style={{ color: 'var(--text-5)', marginTop: 6 }}>
                  {t('isup.redisKeys')}: {redisSnapshot.dbsize ?? 0}
                </Caption1>
              </Card>
            </div>

            <Card appearance="outline" style={{ ...card, padding: 0, marginBottom: 20, overflow: 'hidden' }} {...hoverCard}>
              <CardHeader
                style={{ padding: '18px 20px 8px' }}
                image={<ServerRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                header={<Subtitle2 style={{ margin: 0 }}>{t('isup.portMap')}</Subtitle2>}
                description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.portMapHint')}</Caption1>}
              />
              <Divider />
              <div style={{ overflow: 'auto', maxHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colService')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colAddr')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colState')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ports.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)' }}>{t('isup.noPorts')}</td></tr>
                    ) : ports.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-2)' }}>
                        <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                          <Text style={{ fontWeight: 600 }}>{p.title || p.key || '—'}</Text>
                          <Caption1 block style={{ marginTop: 4, color: 'var(--text-4)' }}>{p.purpose || ''}</Caption1>
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace, monospace', color: 'var(--text-2)' }}>{p.host ?? '—'}:{p.port ?? '—'}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {p.listening === true && <Badge appearance="tint" color="success">{t('isup.listening')}</Badge>}
                          {p.listening === false && <Badge appearance="tint" color="danger">{t('isup.notListening')}</Badge>}
                          {p.listening !== true && p.listening !== false && <Badge appearance="tint" color="informative">?</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div style={{ marginBottom: 20 }}>
              {!redisSnapshot.connected && (
                <MessageBar intent={redisMessageIntent} style={{ marginBottom: 16, borderRadius: 10 }}>
                  <MessageBarBody>{redisMessage}</MessageBarBody>
                </MessageBar>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                <Card appearance="outline" style={{ ...card, padding: 0, overflow: 'hidden' }} {...hoverCard}>
                  <CardHeader
                    style={{ padding: '18px 20px 8px' }}
                    image={<ServerRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                    header={<Subtitle2 style={{ margin: 0 }}>{t('isup.redisSection')}</Subtitle2>}
                    description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.redisSectionHint')}</Caption1>}
                  />
                  <Divider />
                  <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisHost')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.host || '127.0.0.1'}:{redisSnapshot.port || 6379}</Text>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisPattern')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.pattern || REDIS_SNAPSHOT_PATTERN}</Text>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisMemory')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.stats?.used_memory_human || '—'}</Text>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisPing')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.ping_ms == null ? '—' : `${Number(redisSnapshot.ping_ms).toFixed(2)} ms`}</Text>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisClients')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.stats?.connected_clients ?? '—'}</Text>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                      <Caption1 style={{ fontWeight: 700, color: 'var(--text-4)' }}>{t('isup.redisBlocked')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>{redisSnapshot.stats?.blocked_clients ?? '—'}</Text>
                    </div>
                  </div>
                  <Divider />
                  <div style={{ padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisDbSize')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{redisSnapshot.dbsize ?? 0}</Text>
                    </div>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisChannels')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{redisChannels.length}</Text>
                    </div>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisServiceState')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>
                        {redisSnapshot.service?.listening === true ? t('isup.listening') : (redisSnapshot.service?.listening === false ? t('isup.notListening') : t('isup.redisUnknown'))}
                      </Text>
                    </div>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisServicePid')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{redisSnapshot.service?.pid ?? '—'}</Text>
                    </div>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisHitRatio')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{formatRedisHitRatio(redisSnapshot.stats)}</Text>
                    </div>
                    <div>
                      <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.lastCheck')}</Caption1>
                      <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{formatCheckedAt(redisSnapshot.checked_at, locale)}</Text>
                    </div>
                  </div>
                  {redisSnapshot.error && (
                    <>
                      <Divider />
                      <div style={{ padding: '16px 20px 20px' }}>
                        <Caption1 style={{ color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700 }}>{t('isup.redisLastError')}</Caption1>
                        <Text style={{ display: 'block', marginTop: 6, color: 'var(--red)' }}>{redisSnapshot.error}</Text>
                      </div>
                    </>
                  )}
                </Card>

                <Card appearance="outline" style={{ ...card, padding: 0, overflow: 'hidden' }} {...hoverCard}>
                  <CardHeader
                    style={{ padding: '18px 20px 8px' }}
                    image={<CameraRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                    header={<Subtitle2 style={{ margin: 0 }}>{t('isup.redisEvents')}</Subtitle2>}
                    description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.redisEventsHint')}</Caption1>}
                  />
                  <Divider />
                  <div style={{ padding: 20, display: 'grid', gap: 10, maxHeight: 420, overflow: 'auto' }}>
                    {redisRecentEvents.length === 0 ? (
                      <Text style={{ color: 'var(--text-4)' }}>{t('isup.redisNoEvents')}</Text>
                    ) : redisRecentEvents.map((row) => (
                      <div key={row.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border-2)' }}>
                        <Caption1 style={{ color: 'var(--text-5)' }}>{formatCheckedAt(row.timestamp, locale)}</Caption1>
                        <Text style={{ display: 'block', marginTop: 4, fontWeight: 700 }}>{row.camera_name || row.camera_id || '—'}</Text>
                        <Caption1 block style={{ marginTop: 4, color: 'var(--text-3)' }}>
                          {(row.person_name || row.person_id || '—')} {row.status ? `• ${row.status}` : ''} {row.source ? `• ${row.source}` : ''}
                        </Caption1>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card appearance="outline" style={{ ...card, padding: 0, marginBottom: 16, overflow: 'hidden' }} {...hoverCard}>
                <CardHeader
                  style={{ padding: '18px 20px 8px' }}
                  image={<ServerRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                  header={<Subtitle2 style={{ margin: 0 }}>{t('isup.redisChannels')}</Subtitle2>}
                  description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.redisChannelsHint')}</Caption1>}
                />
                <Divider />
                <div style={{ padding: 20 }}>
                  {redisChannels.length === 0 ? (
                    <Text style={{ color: 'var(--text-4)' }}>{t('isup.redisNoChannels')}</Text>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {redisChannels.map((channel) => (
                        <Badge key={channel} appearance="filled" color="informative" style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace' }}>
                          {channel}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card appearance="outline" style={{ ...card, padding: 0, overflow: 'hidden' }} {...hoverCard}>
                <CardHeader
                  style={{ padding: '18px 20px 8px' }}
                  image={<ServerRegular fontSize={22} style={{ color: 'var(--accent-tx)' }} />}
                  header={<Subtitle2 style={{ margin: 0 }}>{t('isup.redisKeys')}</Subtitle2>}
                  description={<Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.redisSnapshotHint', { pattern: redisSnapshot.pattern || REDIS_SNAPSHOT_PATTERN })}</Caption1>}
                />
                <Divider />
                <div style={{ overflow: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>Key</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.redisType')}</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.redisPreview')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redisKeys.length === 0 ? (
                        <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)' }}>{t('isup.redisNoKeys')}</td></tr>
                      ) : redisKeys.map((item) => (
                        <tr key={item.key} style={{ borderBottom: '1px solid var(--border-2)' }}>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', fontFamily: 'ui-monospace, monospace' }}>{item.key}</td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Text style={{ display: 'block', fontWeight: 700 }}>{item.type || '—'}</Text>
                            <Caption1 block style={{ marginTop: 4, color: 'var(--text-4)' }}>
                              {t('isup.redisTtl')}: {item.ttl ?? '—'} • {t('isup.redisSize')}: {item.size ?? 0}
                            </Caption1>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', fontFamily: 'ui-monospace, monospace', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {formatRedisPreview(item.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card appearance="outline" style={{ ...card, padding: 0, overflow: 'hidden' }} {...hoverCard}>
              <div style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Subtitle2 style={{ margin: 0 }}>{t('isup.deviceList')}</Subtitle2>
                  <Caption1 style={{ color: 'var(--text-4)' }}>{t('isup.deviceListHint')}</Caption1>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Input appearance="outline" placeholder={t('isup.search')} value={deviceSearch} onChange={(_, d) => setDeviceSearch(d.value)} style={{ minWidth: 200 }} />
                  <Button appearance="secondary" icon={<CameraRegular />} onClick={() => navigate('/devices')}>{t('isup.openCameras')}</Button>
                </div>
              </div>
              <Divider />
              <div style={{ overflow: 'auto', maxHeight: 480 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>ID</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colName')}</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>IP</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colSource')}</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{t('isup.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)' }}>{t('isup.noDevices')}</td></tr>
                    ) : filteredDevices.map((d) => {
                      const id = d.device_id || d.id || '—'
                      const name = d.display_name || d.camera_name || id
                      const ip = d.remote_ip || d.ip || '—'
                      const src = d.source || '—'
                      const canDisconnect = src !== 'configured_only' && String(id).length > 2
                      return (
                        <tr key={String(id)} style={{ borderBottom: '1px solid var(--border-2)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{id}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{name}</td>
                          <td style={{ padding: '12px 16px' }}>{ip}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge appearance="outline" color={src === 'configured_only' ? 'warning' : 'success'}>{src}</Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {canDisconnect ? (
                              <Button size="small" appearance="subtle" icon={<PlugDisconnectedRegular />} onClick={() => disconnectDevice(id)} disabled={busy}>
                                {t('isup.disconnect')}
                              </Button>
                            ) : (
                              <Caption1 style={{ color: 'var(--text-5)' }}>—</Caption1>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
