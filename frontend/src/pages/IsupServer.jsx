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
import CustomSelect from '../components/CustomSelect'

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

  // Traces terminal state
  const [traces, setTraces] = useState([])
  const [tracesLoading, setTracesLoading] = useState(true)
  const [tracesError, setTracesError] = useState('')
  const [tracesFilter, setTracesFilter] = useState('all')
  const [autoscroll, setAutoscroll] = useState(true)
  const terminalContainerRef = useRef(null)

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

  const loadTraces = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setTracesLoading(true)
    try {
      const res = await fetch(`/api/isup-traces?limit=150&filter=${tracesFilter}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (aliveRef.current) {
        setTraces(data?.items || [])
        setTracesError('')
      }
    } catch (e) {
      if (aliveRef.current) setTracesError(e.message)
    } finally {
      if (aliveRef.current) setTracesLoading(false)
    }
  }, [tracesFilter])

  useEffect(() => {
    aliveRef.current = true
    loadStatus({ silent: true })
    loadDevices({ silent: true })
    loadTraces({ silent: true })
    const id1 = setInterval(() => loadStatus({ silent: true }), 5000)
    const id2 = setInterval(() => loadDevices({ silent: true }), 7000)
    const id3 = setInterval(() => loadTraces({ silent: true }), 3000)
    return () => {
      aliveRef.current = false
      clearInterval(id1)
      clearInterval(id2)
      clearInterval(id3)
    }
  }, [loadStatus, loadDevices, loadTraces])

  useEffect(() => {
    if (autoscroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight
    }
  }, [traces, autoscroll])

  const handleClearTraces = async () => {
    const ok = await confirm({
      title: isRu ? 'Очистить терминал?' : 'Terminalni tozalash?',
      message: isRu 
        ? 'Все записи логов iSUP будут навсегда удалены с сервера.' 
        : 'Barcha iSUP loglari serverdan butunlay o\'chib ketadi.',
      confirmText: isRu ? 'Очистить' : 'Tozalash',
      cancelText: isRu ? 'Отмена' : 'Bekor qilish',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch('/api/isup-traces', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(isRu ? 'Логи очищены' : 'Loglar tozalandi')
      await loadTraces({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleAction = async (action) => {
    if (action === 'stop') {
      const ok = await confirm({
        title: isRu ? 'Остановить ISUP сервер?' : "iSUP serverni to'xtatish?",
        message: isRu
          ? 'Все подключения и прием событий с камер будут временно приостановлены.'
          : 'Barcha kameralar bilan ulanish va voqealarni qabul qilish vaqtincha to\'xtatiladi.',
        confirmText: isRu ? 'Остановить' : "To'xtatish",
        cancelText: isRu ? 'Отмена' : 'Bekor qilish',
        danger: true,
      })
      if (!ok) return
    } else if (action === 'restart') {
      const ok = await confirm({
        title: isRu ? 'Перезапустить ISUP сервер?' : 'iSUP serverni qayta ishga tushirish?',
        message: isRu
          ? 'Это вызовет кратковременный разрыв подключения всех камер.'
          : 'Bu barcha kameralar ulanishida qisqa muddatli uzilishga olib keladi.',
        confirmText: isRu ? 'Перезапустить' : 'Restart qilish',
        cancelText: isRu ? 'Отмена' : 'Bekor qilish',
        danger: false,
      })
      if (!ok) return
    }

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
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .isup-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 768px) {
          .isup-container {
            padding: 16px 16px 60px !important;
          }
        }
        @media (max-width: 600px) {
          .modal-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="isup-container">
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
                <div style={{ width: 160 }}>
                  <CustomSelect
                    value={stateFilter}
                    onChange={val => setStateFilter(val)}
                    options={[
                      { value: 'all', label: isRu ? 'Все' : 'Hammasi' },
                      { value: 'online', label: isRu ? 'Онлайн' : 'Online' },
                      { value: 'offline', label: isRu ? 'Оффлайн' : 'Offline' },
                      { value: 'unsaved', label: isRu ? 'Не сохранено' : 'DB da yo\'q' }
                    ]}
                  />
                </div>
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

          {/* iSUP Traces Terminal card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                  </span>
                  &nbsp; {isRu ? 'iSUP Логи в реальном времени' : 'iSUP Real-Time Loglar'}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={tracesFilter}
                  onChange={e => setTracesFilter(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 8,
                    border: '1px solid var(--border-2)', background: 'var(--bg)',
                    color: 'var(--text-1)', fontSize: 12, outline: 'none',
                  }}
                >
                  <option value="all">{isRu ? 'Все события' : 'Barcha hodisalar'}</option>
                  <option value="error">{isRu ? 'Ошибки' : 'Xatoliklar'}</option>
                  <option value="alarm">{isRu ? 'Давомат (7661)' : 'Davomat (7661)'}</option>
                  <option value="picture">{isRu ? 'Suratlar (7662)' : 'Suratlar (7662)'}</option>
                </select>

                <button
                  onClick={handleClearTraces}
                  style={smallBtn('danger')}
                >
                  {isRu ? 'Очистить лог' : 'Tozalash'}
                </button>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoscroll}
                    onChange={e => setAutoscroll(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Auto-scroll
                </label>
              </div>
            </div>

            {tracesError && (
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 12 }}>
                {tracesError}
              </div>
            )}

            <div
              ref={terminalContainerRef}
              style={{
                background: '#090d16',
                border: '1px solid #1f2937',
                borderRadius: 8,
                padding: '16px',
                height: '350px',
                overflowY: 'auto',
                fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#e2e8f0',
              }}
            >
              {tracesLoading && traces.length === 0 ? (
                <div style={{ color: 'var(--text-4)' }}>
                  {isRu ? 'Подключение к логам...' : 'Loglarga ulanmoqda...'}
                </div>
              ) : traces.length === 0 ? (
                <div style={{ color: '#6e7681', fontStyle: 'italic' }}>
                  {isRu ? '[СИСТЕМА] Ожидание событий iSUP...' : '[TIZIM] iSUP hodisalari kutilmoqda...'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {traces.map((t, idx) => {
                    const event = t.event || 'system';
                    let eventLabel = '⚙️ SYSTEM';
                    let eventColor = '#a855f7';
                    if (event.includes('alarm_7661')) {
                      eventLabel = '🔔 ALARM';
                      eventColor = '#eab308';
                    } else if (event.includes('picture_7662')) {
                      eventLabel = '🖼️ PICTURE';
                      eventColor = '#3b82f6';
                    } else if (event.includes('register') || event.includes('keepalive')) {
                      eventLabel = '🟢 REGISTER';
                      eventColor = '#22c55e';
                    } else if (event.includes('error') || event.includes('fail')) {
                      eventLabel = '❌ ERROR';
                      eventColor = '#ef4444';
                    }

                    const timeStr = t.at ? t.at.split('T')[1]?.substring(0, 8) || t.at : '—';
                    const detailStr = Object.entries(t.details || {})
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' | ');

                    return (
                      <div key={idx} style={{ wordBreak: 'break-all', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: '#6e7681', flexShrink: 0 }}>[{timeStr}]</span>
                        <span style={{ color: eventColor, fontWeight: 'bold', flexShrink: 0, minWidth: '90px' }}>{eventLabel}</span>
                        <span style={{ color: '#ffffff', fontWeight: '500', flexShrink: 0 }}>{event}</span>
                        {detailStr && <span style={{ color: '#94a3b8' }}>— {detailStr}</span>}
                      </div>
                    );
                  })}
                  {/* scroll endpoint */}
                </div>
              )}
            </div>
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
  const [branches, setBranches] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [suggestedNames, setSuggestedNames] = useState([])
  const orgOptions = useMemo(() => [
    { value: '', label: isRu ? '— Без организации —' : '— Tashkilotsiz —' },
    ...orgs.map(o => ({ value: String(o.id), label: o.name }))
  ], [orgs, isRu])

  const branchOptions = useMemo(() => [
    { value: '', label: isRu ? '— Без филиала —' : '— Filialsiz —' },
    ...branches.map(b => ({ value: String(b.id), label: b.name }))
  ], [branches, isRu])

  const pwdSuggestBtnStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-2)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  }

  const [form, setForm] = useState({
    name: target?.display_name || target?.device_id || '',
    isup_device_id: target?.device_id || '',
    mac_address: target?.mac_address || '',
    serial_number: '',
    model: target?.model || target?.camera_model || '',
    firmware_version: '',
    local_ip: '',
    external_ip: target?.ip && target.ip !== '-' ? target.ip : '',
    location: '',
    organization_id: '',
    branch_id: '',
    username: 'admin',
    password: '',
    isup_password: 'facex2024',
    max_memory: 1500,
    min_face_confidence: 0.40,
    direction: 'in',
  })

  // Load name suggestions history
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('isup_camera_names') || '[]')
      setSuggestedNames(Array.isArray(list) ? list : [])
    } catch {
      // silent
    }
  }, [])

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
              local_ip: meta?.detected?.local_ip || prev.local_ip,
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

  // Load branches when organization_id changes
  useEffect(() => {
    if (!form.organization_id) {
      setBranches([])
      setForm(prev => ({ ...prev, branch_id: '' }))
      return
    }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/organizations/${form.organization_id}/branches`, { credentials: 'include' })
        if (res.ok) {
          const list = await res.json()
          if (alive) {
            setBranches(Array.isArray(list) ? list : [])
            setForm(prev => ({ ...prev, branch_id: '' }))
          }
        }
      } catch (err) {
        console.error('Failed to load branches:', err)
      }
    })()
    return () => { alive = false }
  }, [form.organization_id])

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
        local_ip: form.local_ip.trim() || null,
        external_ip: form.external_ip.trim() || null,
        location: form.location.trim() || null,
        organization_id: form.organization_id ? Number(form.organization_id) : null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        username: form.username.trim() || null,
        isup_password: form.isup_password.trim() || null,
        max_memory: Number(form.max_memory) || 1500,
        min_face_confidence: Number(form.min_face_confidence) || 0.40,
        direction: form.direction || 'in',
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

      // Save name to localStorage history
      try {
        const prevNames = JSON.parse(localStorage.getItem('isup_camera_names') || '[]')
        const newName = form.name.trim()
        if (newName && !prevNames.includes(newName)) {
          const nextNames = [newName, ...prevNames].slice(0, 10)
          localStorage.setItem('isup_camera_names', JSON.stringify(nextNames))
        }
      } catch {
        // silent
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

            <div className="modal-grid">
              <Field label={isRu ? 'Имя' : 'Nomi'} required>
                <input value={form.name} onChange={setField('name')} style={inp} />
                {suggestedNames.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {suggestedNames.map(nm => (
                      <button
                        key={nm}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, name: nm }))}
                        style={pwdSuggestBtnStyle}
                      >
                        {nm}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="ISUP Device ID">
                <input value={form.isup_device_id} disabled style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} readOnly />
              </Field>

              <Field label="MAC">
                <input value={form.mac_address} onChange={setField('mac_address')} style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase' }} placeholder="AA:BB:CC:11:22:33" />
              </Field>
              <Field label="Serial">
                <input value={form.serial_number} onChange={setField('serial_number')} style={{ ...inp, fontFamily: 'monospace' }} placeholder="DS-K1T..." />
              </Field>

              <Field label={isRu ? 'Модель' : 'Model'}>
                <input value={form.model} onChange={setField('model')} style={inp} placeholder="DS-K1T343" />
              </Field>
              <Field label="Firmware">
                <input value={form.firmware_version} onChange={setField('firmware_version')} style={inp} placeholder="V3.3.15" />
              </Field>

              <Field label={isRu ? 'Локальный IP (LAN)' : 'Lokal IP (LAN)'}>
                <input value={form.local_ip} onChange={setField('local_ip')} style={{ ...inp, fontFamily: 'monospace' }} placeholder="192.168.1.100" />
              </Field>
              <Field label={isRu ? 'Внешний IP (WAN)' : 'Tashqi IP (WAN)'}>
                <input value={form.external_ip} disabled style={{ ...inp, opacity: 0.6, cursor: 'not-allowed', fontFamily: 'monospace' }} placeholder="100.71.61.63" readOnly />
              </Field>
              <Field label={isRu ? 'Расположение' : 'Joylashuvi'}>
                <input value={form.location} onChange={setField('location')} style={inp} placeholder={isRu ? '1-вход' : '1-kirish'} />
              </Field>

              <Field label={isRu ? 'Организация' : 'Tashkilot'}>
                <CustomSelect
                  value={form.organization_id}
                  onChange={val => setForm(prev => ({ ...prev, organization_id: val }))}
                  options={orgOptions}
                  placeholder={isRu ? '— Без организации —' : '— Tashkilotsiz —'}
                />
              </Field>
              <Field label={isRu ? 'Филиал' : 'Filial'}>
                <CustomSelect
                  value={form.branch_id}
                  onChange={val => setForm(prev => ({ ...prev, branch_id: val }))}
                  options={branchOptions}
                  disabled={!form.organization_id}
                  placeholder={isRu ? '— Без филиала —' : '— Filialsiz —'}
                />
              </Field>
              <Field label={isRu ? 'Лимит лиц' : 'Yuzlar limiti'}>
                <input type="number" value={form.max_memory} onChange={setField('max_memory')} style={inp} />
              </Field>
              <Field label={isRu ? 'Минимальная уверенность' : 'Minimal confidence'}>
                <input type="number" min="0.10" max="0.95" step="0.01" value={form.min_face_confidence} onChange={setField('min_face_confidence')} style={inp} />
              </Field>

              <Field label={isRu ? 'Направление' : 'Yo\'nalish'}>
                <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 7, padding: 3, height: 36, boxSizing: 'border-box' }}>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, direction: 'in' }))}
                    style={{
                      flex: 1,
                      border: 'none',
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: form.direction === 'in' ? 'var(--accent)' : 'transparent',
                      color: form.direction === 'in' ? '#fff' : 'var(--text-2)',
                    }}
                  >
                    {isRu ? 'Вход' : 'Kirish (Keldi)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, direction: 'out' }))}
                    style={{
                      flex: 1,
                      border: 'none',
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: form.direction === 'out' ? 'var(--accent)' : 'transparent',
                      color: form.direction === 'out' ? '#fff' : 'var(--text-2)',
                    }}
                  >
                    {isRu ? 'Выход' : 'Chiqish (Ketdi)'}
                  </button>
                </div>
              </Field>
              <Field label="ISAPI username">
                <input value={form.username} onChange={setField('username')} style={inp} placeholder="admin" />
              </Field>

              <Field label="ISAPI password">
                <input type="text" value={form.password} onChange={setField('password')} style={inp} placeholder="Qwerty@123456." />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {['Qwerty@123456.', 'Qwerty@12', 'Namdu@309', 'HIK@2024'].map(pwd => (
                    <button
                      key={pwd}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, password: pwd }))}
                      style={pwdSuggestBtnStyle}
                    >
                      {pwd}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="ISUP key">
                <input value={form.isup_password} disabled style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} placeholder="facex2024" readOnly />
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
