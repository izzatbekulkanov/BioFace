import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseRegular, ArrowSyncRegular } from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'

/**
 * Redis Monitor — alohida sahifa. Skeleton loader bilan.
 *
 * Backend endpointi:
 *   GET /api/redis/status -> { ok, connected, host, port, redis_version, used_memory_human, total_keys, uptime_days, ... }
 */
export default function RedisMonitor() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'

  const [status, setStatus] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const aliveRef = useRef(true)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch('/api/redis/status', { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(isRu ? 'Не авторизован. Войдите в систему.' : 'Avtorizatsiya talab qilinadi. Tizimga kiring.')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      if (aliveRef.current) {
        setStatus(data)
        setError('')
      }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) {
        setInitialLoading(false)
        setRefreshing(false)
      }
    }
  }, [isRu])

  useEffect(() => {
    aliveRef.current = true
    load({ silent: true })
    const id = setInterval(() => load({ silent: true }), 5000)
    return () => {
      aliveRef.current = false
      clearInterval(id)
    }
  }, [load])

  const showSkeleton = initialLoading && !status

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge="✦ Redis"
        title="Redis Monitor"
        sub={isRu ? 'Состояние сервера Redis и метрики' : 'Redis server holati va metrikalar'}
        right={
          <button
            onClick={() => load()}
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={{ marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }}>
            {error}
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0, marginBottom: 18 }}>
            <DatabaseRegular style={{ color: '#ef4444' }} /> {isRu ? 'Информация о сервере' : "Server haqida ma'lumot"}
          </h3>

          {showSkeleton ? (
            <Skeleton.Stats count={8} />
          ) : status ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard
                label={isRu ? 'Статус' : 'Holat'}
                value={status.connected ? 'Connected' : 'Disconnected'}
                valueColor={status.connected ? '#10b981' : '#f43f5e'}
              />
              <StatCard label="Host" value={`${status.host || '127.0.0.1'}:${status.port || 6379}`} />
              <StatCard label="Ping" value={status.ping_ms != null ? `${status.ping_ms} ms` : '—'} />
              <StatCard label={isRu ? 'Версия' : 'Versiya'} value={status.redis_version || '—'} />
              <StatCard label={isRu ? 'Память' : 'Xotira'} value={status.used_memory_human || '—'} />
              <StatCard label={isRu ? 'Пик памяти' : "Xotira pik'i"} value={status.used_memory_peak_human || '—'} />
              <StatCard label={isRu ? 'Ключи' : 'Kalitlar'} value={status.total_keys ?? '—'} />
              <StatCard label="Clients" value={status.connected_clients ?? '—'} />
              <StatCard label="Uptime" value={status.uptime_days != null ? `${status.uptime_days}d` : '—'} />
              <StatCard label="Ops/sec" value={status.instantaneous_ops_per_sec ?? '—'} />
              <StatCard label="Hits" value={status.keyspace_hits ?? '—'} />
              <StatCard label="Misses" value={status.keyspace_misses ?? '—'} />
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)' }}>
              {isRu ? "Не удалось получить статус Redis" : "Redis holatini olishda xatolik"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, valueColor }) {
  return (
    <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor || 'var(--text-1)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
