import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CameraRegular,
  ArrowSyncRegular,
  PlayRegular,
  StopRegular,
  ArrowClockwiseRegular,
  AddRegular,
  DismissRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

/**
 * ISUP Server — alohida sahifa.
 *
 * Tarkibida:
 *   • jarayonni boshqarish (start/stop/restart) + tezkor stats
 *   • portlar holati
 *   • Hikvision SDK kartasi
 *   • "Ulangan ISUP qurilmalar" jadvali (filtr, sahifalash, qo'shish, uzish)
 *
 * Backend:
 *   GET    /api/isup/process              — process status
 *   POST   /api/isup/process/start|stop|restart
 *   GET    /api/isup-devices              — live + DB-configured kameralar
 *   GET    /api/isup-devices/{id}/metadata— MAC, serial, model va h.k.
 *   DELETE /api/isup-devices/{id}         — kamera ulanishini uzish
 *   POST   /api/cameras                   — DB ga yangi kamera qo'shish
 *   GET    /api/organizations             — tashkilotlar ro'yxati (form uchun)
 */
export default function IsupServer() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const confirm = useConfirm()
  const toast = useToast()

  const [status, setStatus] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const aliveRef = useRef(true)

  // Ulangan qurilmalar holati
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState('')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')   // all | online | offline | unsaved

  // Modal
  const [addTarget, setAddTarget] = useState(null)        // device dict bosilgan

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch('/api/isup/process', { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(isRu ? 'Не авторизован. Войдите в систему.' : 'Avtorizatsiya talab qilinadi. Tizimga kiring.')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const next = data?.status ?? data
      if (aliveRef.current) {
        setStatus(next)
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

  const loadDevices = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setDevicesLoading(true)
    try {
      const res = await fetch('/api/isup-devices', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (aliveRef.current) {
        setDevices(Array.isArray(data) ? data : [])
        setDevicesError('')
      }
    } catch (e) {
      if (aliveRef.current) setDevicesError(e.message)
    } finally {
      if (aliveRef.current) setDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    aliveRef.current = true
    loadStatus({ silent: true })
    loadDevices({ silent: true })
    const id1 = setInterval(() => loadStatus({ silent: true }), 5000)
    const id2 = setInterval(() => loadDevices({ silent: true }), 7000)
    return () => {
      aliveRef.current = false
      clearInterval(id1)
      clearInterval(id2)
    }
  }, [loadStatus, loadDevices])

  const handleAction = async (action) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/isup/process/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const next = data?.status ?? data
      if (aliveRef.current) {
        setStatus(next)
        setError('')
      }
      const labels = {
        start: isRu ? 'ISUP сервер запущен' : 'ISUP server ishga tushirildi',
        stop: isRu ? 'ISUP сервер остановлен' : "ISUP server to'xtatildi",
        restart: isRu ? 'ISUP сервер перезапущен' : 'ISUP server qayta ishga tushirildi',
      }
      toast.success(labels[action] || (isRu ? 'Готово' : 'Bajarildi'))
    } catch (e) {
      if (aliveRef.current) setError(e.message)
      toast.error(e.message)
    } finally {
      if (aliveRef.current) setActionLoading(false)
    }
  }

  const handleDisconnect = async (deviceId) => {
    if (!deviceId) return
    const ok = await confirm({
      title: isRu ? 'Отключить устройство?' : 'Qurilmani uzasizmi?',
      message: isRu
        ? `Текущее ISUP-подключение устройства ${deviceId} будет разорвано.`
        : `${deviceId} qurilmasining joriy ISUP ulanishi uziladi.`,
      confirmText: isRu ? 'Отключить' : 'Uzish',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/isup-devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(isRu ? 'Устройство отключено' : 'Qurilma uzildi')
      await loadDevices({ silent: true })
    } catch (e) {
      setDevicesError(e.message)
      toast.error(e.message)
    }
  }

  // --- derived data ---
  const running = status?.running
  const ports = status?.ports || []
  const sdk = status?.sdk || {}
  const showSkeleton = initialLoading && !status

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return devices.filter(d => {
      // state filter
      if (stateFilter !== 'all') {
        const isOnline = !!d.online
        const isSaved = !!d.db_camera_id
        if (stateFilter === 'online' && !isOnline) return false
        if (stateFilter === 'offline' && isOnline) return false
        if (stateFilter === 'unsaved' && isSaved) return false
      }
      if (!q) return true
      const haystack = [
        d.device_id, d.display_name, d.mac_address,
        d.ip, d.model, d.camera_model, d.serial,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [devices, search, stateFilter])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge="✦ ISUP"
        title="ISUP Server"
        sub={isRu ? 'Состояние процесса и подключённые устройства' : 'Jarayon holati va ulangan qurilmalar'}
        right={
          <button
            onClick={() => { loadStatus(); loadDevices() }}
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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && (
          <div style={{ marginBottom: 20, padding: 14, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Process control card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <CameraRegular style={{ color: '#8b5cf6' }} /> {isRu ? 'Управление процессом' : 'Jarayon boshqaruvi'}
              </h3>

              {showSkeleton ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Skeleton.Button width={130} />
                  <Skeleton.Button width={120} />
                  <Skeleton.Button width={100} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleAction('start')}
                    disabled={running || actionLoading}
                    style={controlBtn(running ? 'disabled' : 'success')}
                  >
                    <PlayRegular fontSize={14} /> {isRu ? 'Запустить' : 'Ishga tushirish'}
                  </button>
                  <button
                    onClick={() => handleAction('stop')}
                    disabled={!running || actionLoading}
                    style={controlBtn(!running ? 'disabled' : 'danger')}
                  >
                    <StopRegular fontSize={14} /> {isRu ? 'Остановить' : "To'xtatish"}
                  </button>
                  <button
                    onClick={() => handleAction('restart')}
                    disabled={actionLoading}
                    style={controlBtn('accent')}
                  >
                    <ArrowClockwiseRegular fontSize={14} /> Restart
                  </button>
                </div>
              )}
            </div>

            {showSkeleton ? (
              <Skeleton.Stats count={6} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard label={isRu ? 'Статус' : 'Holat'} value={running ? (isRu ? 'Работает' : 'Ishlayapti') : (isRu ? 'Остановлен' : "To'xtagan")} valueColor={running ? '#10b981' : '#f43f5e'} />
                <StatCard label="PID" value={status?.pid || '—'} />
                <StatCard label={isRu ? 'Режим' : 'Rejim'} value={sdk.mode || '—'} />
                <StatCard label={isRu ? 'Память' : 'Xotira'} value={status?.memory_mb != null ? `${status.memory_mb} MB` : '—'} />
                <StatCard label="CPU" value={status?.cpu_percent != null ? `${status.cpu_percent}%` : '—'} />
                <StatCard label={isRu ? 'Время работы' : 'Ishlash vaqti'} value={formatUptime(status?.uptime_seconds, isRu)} />
              </div>
            )}
          </div>

          {/* Connected ISUP devices */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <CameraRegular style={{ color: '#22c55e' }} /> {isRu ? 'Подключённые ISUP устройства' : 'Ulangan ISUP qurilmalar'}
                </h3>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-4)' }}>
                  {filteredDevices.length} {isRu ? 'результат фильтра' : 'ta filter natijasi'} / {devices.length} {isRu ? 'всего' : 'jami'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={isRu ? 'Поиск (ID, MAC, имя)' : 'Qidiruv (ID, MAC, nom)'}
                  style={{
                    minWidth: 220, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 13, outline: 'none',
                  }}
                />
                <select
                  value={stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="all">{isRu ? 'Все' : 'Hammasi'}</option>
                  <option value="online">{isRu ? 'Онлайн' : 'Online'}</option>
                  <option value="offline">{isRu ? 'Оффлайн' : 'Offline'}</option>
                  <option value="unsaved">{isRu ? 'Не сохранено' : 'DB da yo\'q'}</option>
                </select>
              </div>
            </div>

            {devicesError && (
              <div style={{ marginBottom: 14, padding: 10, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 12 }}>
                {devicesError}
              </div>
            )}

            {devicesLoading && devices.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton.Row key={i} />)}
              </div>
            ) : filteredDevices.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border-2)' }}>
                {isRu ? 'Подключённые ISUP устройства не найдены.' : "Hozircha ulangan ISUP qurilmalar topilmadi."}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                  <thead>
                    <tr>
                      {[
                        isRu ? 'Устройство' : 'Qurilma',
                        'IP',
                        'MAC',
                        isRu ? 'Модель' : 'Model',
                        isRu ? 'Состояние' : 'Holat',
                        isRu ? 'В БД' : 'DB',
                        '',
                      ].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map(d => {
                      const isOnline = !!d.online
                      const isSaved = !!d.db_camera_id
                      return (
                        <tr key={d.device_id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600 }}>{d.display_name || d.device_id}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'monospace', marginTop: 2 }}>
                              {d.device_id}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <code style={{ fontSize: 12, color: 'var(--text-1)' }}>{d.ip || '—'}</code>
                            {d.port && d.port !== '-' && <span style={{ color: 'var(--text-4)' }}>:{d.port}</span>}
                          </td>
                          <td style={tdStyle}>
                            <code style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.mac_address || '—'}</code>
                          </td>
                          <td style={tdStyle}>
                            {d.model || d.camera_model || '—'}
                          </td>
                          <td style={tdStyle}>
                            <Pill ok={isOnline} text={isOnline ? 'Online' : (d.connection_state === 'not_registered' ? (isRu ? 'не рег.' : "ro'y. yo'q") : 'Offline')} />
                          </td>
                          <td style={tdStyle}>
                            {isSaved
                              ? <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckmarkCircleRegular fontSize={14} />#{d.db_camera_id}</span>
                              : <span style={{ color: 'var(--text-4)' }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {!isSaved && (
                                <button
                                  onClick={() => setAddTarget(d)}
                                  title={isRu ? 'Добавить в БД' : "DB ga qo'shish"}
                                  style={smallBtn('accent')}
                                >
                                  <AddRegular fontSize={13} /> {isRu ? 'Добавить' : "Qo'shish"}
                                </button>
                              )}
                              {isOnline && (
                                <button
                                  onClick={() => handleDisconnect(d.device_id)}
                                  title={isRu ? 'Отключить' : 'Uzish'}
                                  style={smallBtn('danger')}
                                >
                                  <DismissRegular fontSize={13} /> {isRu ? 'Откл.' : 'Uz'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ports card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>
              {isRu ? 'Порты' : 'Portlar'}
            </h4>
            {showSkeleton ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <Skeleton width="60%" height={12} />
                    <div style={{ marginTop: 6 }}>
                      <Skeleton width="40%" height={10} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {ports.length === 0 && (
                  <div style={{ color: 'var(--text-4)', fontSize: 13 }}>{isRu ? 'Нет данных' : "Ma'lumot yo'q"}</div>
                )}
                {ports.map(p => (
                  <div
                    key={p.key}
                    style={{
                      padding: '12px 14px', background: 'var(--bg)', borderRadius: 8,
                      border: `1px solid ${p.listening ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{p.host}:{p.port}</div>
                    </div>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: p.listening ? '#10b981' : '#ef4444',
                      flexShrink: 0,
                    }} title={p.listening ? 'Listening' : 'Down'} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SDK card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>Hikvision SDK</h4>
            {showSkeleton ? (
              <Skeleton.Stats count={4} />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <StatCard label={isRu ? 'Готовность' : 'Tayyor'} value={sdk.ready ? 'OK' : '—'} valueColor={sdk.ready ? '#10b981' : 'var(--text-4)'} />
                  <StatCard label={isRu ? 'Папка SDK' : 'SDK papkasi'} value={sdk.sdk_dir_exists ? (isRu ? 'найдена' : 'mavjud') : (isRu ? 'нет' : "yo'q")} valueColor={sdk.sdk_dir_exists ? '#10b981' : '#f43f5e'} />
                  <StatCard label={isRu ? 'Найденные DLL' : 'Topilgan DLL'} value={`${(sdk.found_dlls || []).length}/${(sdk.required_dlls || []).length}`} />
                  <StatCard label={isRu ? 'Отсутствуют' : 'Yetishmayotgan'} value={(sdk.missing_dlls || []).length} valueColor={(sdk.missing_dlls || []).length ? '#f43f5e' : '#10b981'} />
                </div>
                {sdk.note && (
                  <div style={{ marginTop: 14, padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 12 }}>
                    {sdk.note}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {addTarget && (
        <AddDeviceModal
          target={addTarget}
          onClose={() => setAddTarget(null)}
          onSaved={async () => {
            setAddTarget(null)
            await loadDevices({ silent: true })
          }}
          isRu={isRu}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Add device modal
// ────────────────────────────────────────────────────────────────────────────

function AddDeviceModal({ target, onClose, onSaved, isRu }) {
  const [orgs, setOrgs] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])

  const [form, setForm] = useState({
    name: target?.display_name || target?.device_id || '',
    isup_device_id: target?.device_id || '',
    mac_address: target?.mac_address || '',
    serial_number: '',
    model: target?.model || target?.camera_model || '',
    firmware_version: '',
    external_ip: target?.ip && target.ip !== '-' ? target.ip : '',
    location: '',
    organization_id: '',
    username: 'admin',
    password: '',
    isup_password: 'facex2024',
    max_memory: 1500,
  })

  // Metadata + organizations
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [metaRes, orgRes] = await Promise.all([
          fetch(`/api/isup-devices/${encodeURIComponent(target.device_id)}/metadata`, { credentials: 'include' }),
          fetch('/api/organizations', { credentials: 'include' }),
        ])
        if (orgRes.ok) {
          const list = await orgRes.json()
          if (alive) setOrgs(Array.isArray(list) ? list : (list?.items || []))
        }
        if (metaRes.ok) {
          const meta = await metaRes.json()
          if (alive) {
            setForm(prev => ({
              ...prev,
              mac_address: meta?.detected?.mac_address || prev.mac_address,
              serial_number: meta?.detected?.serial_number || prev.serial_number,
              model: meta?.detected?.model || prev.model,
              firmware_version: meta?.detected?.firmware_version || prev.firmware_version,
              external_ip: meta?.detected?.external_ip || prev.external_ip,
            }))
            if (Array.isArray(meta?.warnings) && meta.warnings.length) {
              setWarnings(meta.warnings)
            }
          }
        }
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoadingMeta(false)
      }
    })()
    return () => { alive = false }
  }, [target.device_id])

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim()) {
      setError(isRu ? 'Введите имя' : 'Nomni kiriting')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        name: form.name.trim(),
        isup_device_id: form.isup_device_id.trim() || null,
        mac_address: form.mac_address.trim() || null,
        serial_number: form.serial_number.trim() || null,
        model: form.model.trim() || null,
        firmware_version: form.firmware_version.trim() || null,
        external_ip: form.external_ip.trim() || null,
        location: form.location.trim() || null,
        organization_id: form.organization_id ? Number(form.organization_id) : null,
        username: form.username.trim() || null,
        isup_password: form.isup_password.trim() || null,
        max_memory: Number(form.max_memory) || 1500,
      }
      if (form.password.trim()) body.password = form.password.trim()

      const res = await fetch('/api/cameras', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data?.detail || data?.message || `HTTP ${res.status}`
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{
          width: '100%', maxWidth: 640,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isRu ? 'Добавить камеру' : "Kamera qo'shish"}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <DismissRegular fontSize={20} />
          </button>
        </div>

        {loadingMeta ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
            <Skeleton width="100%" height={36} />
            <Skeleton width="60%" height={36} />
          </div>
        ) : (
          <>
            {warnings.length > 0 && (
              <div style={{ marginBottom: 14, padding: 10, background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 8, border: '1px solid var(--yellow-bd)', fontSize: 12 }}>
                {warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={isRu ? 'Имя' : 'Nomi'} required>
                <input value={form.name} onChange={setField('name')} style={inp} />
              </Field>
              <Field label="ISUP Device ID" hint={isRu ? 'Изменять не рекомендуется' : 'O\'zgartirish tavsiya etilmaydi'}>
                <input value={form.isup_device_id} onChange={setField('isup_device_id')} style={inp} />
              </Field>

              <Field label="MAC">
                <input value={form.mac_address} onChange={setField('mac_address')} style={inp} placeholder="AA:BB:CC:11:22:33" />
              </Field>
              <Field label="Serial">
                <input value={form.serial_number} onChange={setField('serial_number')} style={inp} />
              </Field>

              <Field label={isRu ? 'Модель' : 'Model'}>
                <input value={form.model} onChange={setField('model')} style={inp} placeholder="DS-K1T343" />
              </Field>
              <Field label="Firmware">
                <input value={form.firmware_version} onChange={setField('firmware_version')} style={inp} />
              </Field>

              <Field label={isRu ? 'IP' : 'IP'}>
                <input value={form.external_ip} onChange={setField('external_ip')} style={inp} placeholder="192.168.1.100" />
              </Field>
              <Field label={isRu ? 'Расположение' : 'Joylashuvi'}>
                <input value={form.location} onChange={setField('location')} style={inp} placeholder={isRu ? '1-вход' : '1-kirish'} />
              </Field>

              <Field label={isRu ? 'Организация' : 'Tashkilot'}>
                <select value={form.organization_id} onChange={setField('organization_id')} style={inp}>
                  <option value="">{isRu ? '— Без организации —' : '— Tashkilotsiz —'}</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label={isRu ? 'Лимит лиц' : 'Yuzlar limiti'}>
                <input type="number" value={form.max_memory} onChange={setField('max_memory')} style={inp} />
              </Field>

              <Field label="ISAPI username">
                <input value={form.username} onChange={setField('username')} style={inp} placeholder="admin" />
              </Field>
              <Field label="ISAPI password">
                <input type="password" value={form.password} onChange={setField('password')} style={inp} />
              </Field>

              <Field label="ISUP key" hint={isRu ? 'Камеры регистрируются с этим ключом' : 'Kameralar shu kalit bilan ulanadi'}>
                <input value={form.isup_password} onChange={setField('isup_password')} style={inp} placeholder="facex2024" />
              </Field>
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: 10, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={onClose} disabled={saving} style={smallBtn('subtle')}>
                {isRu ? 'Отмена' : 'Bekor qilish'}
              </button>
              <button type="submit" disabled={saving} style={smallBtn('accent')}>
                {saving
                  ? <ArrowSyncRegular fontSize={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <AddRegular fontSize={14} />}
                {saving ? (isRu ? 'Сохранение...' : 'Saqlanmoqda...') : (isRu ? 'Добавить' : "Qo'shish")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// helpers / styles
// ────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor }) {
  return (
    <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor || 'var(--text-1)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function Pill({ ok, text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.10)',
      color: ok ? '#10b981' : '#f43f5e',
      fontSize: 11, fontWeight: 600,
      border: `1px solid ${ok ? 'rgba(16,185,129,0.30)' : 'rgba(244,63,94,0.25)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#10b981' : '#f43f5e' }} />
      {text}
    </span>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{hint}</span>}
    </label>
  )
}

const inp = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const thStyle = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase',
  letterSpacing: 0.4, borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}

function controlBtn(kind) {
  const map = {
    success:  { bg: '#10b981', color: '#fff' },
    danger:   { bg: '#f43f5e', color: '#fff' },
    accent:   { bg: 'var(--accent-bg)', color: 'var(--accent-tx)', border: '1px solid var(--accent-bd)' },
    disabled: { bg: 'var(--surface-2)', color: 'var(--text-4)' },
  }
  const t = map[kind] || map.accent
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    background: t.bg,
    color: t.color,
    border: t.border || 'none',
    borderRadius: 7, fontSize: 12, fontWeight: 600,
    cursor: kind === 'disabled' ? 'not-allowed' : 'pointer',
  }
}

function smallBtn(kind) {
  const map = {
    accent: { bg: 'var(--accent)', color: '#fff' },
    danger: { bg: '#f43f5e', color: '#fff' },
    subtle: { bg: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
  }
  const t = map[kind] || map.subtle
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 6,
    background: t.bg, color: t.color,
    border: t.border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }
}

function formatUptime(seconds, isRu) {
  if (!seconds && seconds !== 0) return '—'
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}${isRu ? 'д' : 'k'} ${h}${isRu ? 'ч' : 's'}`
  if (h > 0) return `${h}${isRu ? 'ч' : 's'} ${m}${isRu ? 'м' : 'd'}`
  return `${m}${isRu ? 'м' : 'd'}`
}
