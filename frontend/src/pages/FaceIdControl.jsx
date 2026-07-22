import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowSyncRegular,
  CameraRegular,
  CheckmarkCircleRegular,
  DatabaseRegular,
  DismissCircleRegular,
  PersonRegular,
  SearchRegular,
  ShieldCheckmarkRegular,
  WarningRegular,
  WifiOffRegular,
  BuildingRegular,
  BuildingMultipleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import { useToast } from '../components/Toaster'
import CustomSelect from '../components/CustomSelect'
import Skeleton from '../components/Skeleton'

export default function FaceIdControl() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  // ── Filter states ──────────────────────────────────────────────────────────
  const [orgs, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [orgFilter, setOrgFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  // ── Tab & data states ─────────────────────────────────────────────────────
  const [tab, setTab] = useState('review')
  const [loading, setLoading] = useState(false)
  const [filterLoading, setFilterLoading] = useState(true)
  const [queue, setQueue] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [audit, setAudit] = useState({ summary: {}, problem_cameras: [] })
  const [offline, setOffline] = useState([])
  const [backups, setBackups] = useState([])
  const [backupBusy, setBackupBusy] = useState(false)

  // ── Review modal states ───────────────────────────────────────────────────
  const [selected, setSelected] = useState(null)
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Load filter data (orgs & branches) ───────────────────────────────────
  const loadFilters = useCallback(async () => {
    setFilterLoading(true)
    try {
      const res = await fetch('/api/attendance/filter-data', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setOrgs(Array.isArray(data?.organizations) ? data.organizations : [])
      setBranches(Array.isArray(data?.branches) ? data.branches : [])
    } catch {
      // silent
    } finally {
      setFilterLoading(false)
    }
  }, [])

  useEffect(() => { loadFilters() }, [loadFilters])

  // ── Load main data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (orgFilter && orgFilter !== 'all') params.set('organization_id', orgFilter)
      if (branchFilter && branchFilter !== 'all') params.set('branch_id', branchFilter)

      const auditParams = new URLSearchParams()
      if (orgFilter && orgFilter !== 'all') auditParams.set('organization_id', orgFilter)
      if (branchFilter && branchFilter !== 'all') auditParams.set('branch_id', branchFilter)

      const offlineParams = new URLSearchParams({ minutes: '10' })
      if (orgFilter && orgFilter !== 'all') offlineParams.set('organization_id', orgFilter)
      if (branchFilter && branchFilter !== 'all') offlineParams.set('branch_id', branchFilter)

      const [queueRes, auditRes, offlineRes, backupsRes] = await Promise.all([
        fetch(`/api/attendance/review-queue?${params}`, { credentials: 'include' }),
        fetch(`/api/system/faceid-audit?${auditParams}`, { credentials: 'include' }),
        fetch(`/api/system/offline-cameras?${offlineParams}`, { credentials: 'include' }),
        fetch('/api/system/backups', { credentials: 'include' }),
      ])
      if (queueRes.ok) {
        const data = await queueRes.json()
        setQueue(Array.isArray(data.items) ? data.items : [])
        setPendingCount(Number(data.pending || 0))
      }
      if (auditRes.ok) setAudit(await auditRes.json())
      if (offlineRes.ok) {
        const data = await offlineRes.json()
        setOffline(Array.isArray(data.items) ? data.items : [])
      }
      if (backupsRes.ok) {
        const data = await backupsRes.json()
        setBackups(Array.isArray(data.items) ? data.items : [])
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [toast, orgFilter, branchFilter])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Employee search in review modal ───────────────────────────────────────
  useEffect(() => {
    if (!selected) return
    const timer = setTimeout(async () => {
      const p = new URLSearchParams({ limit: '30' })
      if (employeeQuery.trim()) p.set('q', employeeQuery.trim())
      if (selected.organization_id) p.set('organization_id', selected.organization_id)
      try {
        const res = await fetch(`/api/attendance/review-employees?${p}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setEmployees(Array.isArray(data.items) ? data.items : [])
      } catch {
        setEmployees([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [employeeQuery, selected])

  // ── Review modal handlers ─────────────────────────────────────────────────
  function openReview(item) {
    setSelected(item)
    setEmployeeQuery(item.employee_name && item.employee_name !== "Noma'lum" ? item.employee_name : '')
    setSelectedEmployeeId(item.employee_id ? String(item.employee_id) : '')
    setNote('')
    setEmployees([])
  }

  async function submitReview(action) {
    if (!selected) return
    setSaving(true)
    try {
      const body = {
        action,
        employee_id: action === 'approve' ? Number(selectedEmployeeId || 0) : null,
        note,
        learn: true,
      }
      const res = await fetch(`/api/attendance/${selected.id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      toast.success(isRu ? 'Сохранено' : 'Saqlandi')
      setSelected(null)
      loadAll()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  async function createBackup() {
    setBackupBusy(true)
    try {
      const res = await fetch('/api/system/backup', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      toast.success(isRu ? 'Backup создан' : 'Backup yaratildi')
      loadAll()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBackupBusy(false)
    }
  }

  // ── Filter computed values ────────────────────────────────────────────────
  const branchesByOrg = useMemo(() => {
    if (orgFilter === 'all') return branches
    return branches.filter(b => String(b.organization_id) === String(orgFilter))
  }, [branches, orgFilter])

  const orgOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все организации' : 'Hamma tashkilotlar' },
    ...orgs.map(o => ({ value: String(o.id), label: o.name }))
  ], [orgs, isRu])

  const branchOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Все филиалы' : 'Hamma filiallar' },
    ...branchesByOrg.map(b => ({ value: String(b.id), label: b.name }))
  ], [branchesByOrg, isRu])

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const summary = audit?.summary || {}
  const tabs = useMemo(() => [
    { id: 'review',  label: isRu ? 'Подтверждение'   : 'Tasdiqlash',       count: pendingCount },
    { id: 'offline', label: isRu ? 'Офлайн камеры'   : 'Offline kameralar', count: offline.length },
    { id: 'audit',   label: isRu ? 'Аудит'           : 'Audit',            count: Number(summary.unknown || 0) },
    { id: 'backup',  label: 'Backup',                                        count: backups.length },
  ], [isRu, pendingCount, offline.length, summary.unknown, backups.length])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={isRu ? '✦ Face ID контроль' : '✦ Face ID nazorat'}
        title={isRu ? 'Face ID качество и аудит' : 'Face ID sifati va audit'}
        sub={isRu ? 'Низкая уверенность, неизвестные события, камеры и backup' : "Past confidence, noma'lum hodisalar, kameralar va backup"}
        right={
          <button onClick={loadAll} disabled={loading} style={heroBtn}>
            <ArrowSyncRegular fontSize={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Обновить' : 'Yangilash'}
          </button>
        }
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .faceid-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 32px 80px;
        }
        .faceid-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }
        @media (max-width: 768px) {
          .faceid-container { padding: 16px 16px 60px !important; }
          .faceid-toolbar { flex-direction: column; align-items: stretch !important; }
          .faceid-toolbar > div { flex: 1 1 100% !important; width: 100% !important; }
        }
      `}</style>

      <div className="faceid-container">

        {/* ── Metric cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <MetricCard
            icon={<ShieldCheckmarkRegular />}
            label={isRu ? 'Ожидает подтверждения' : 'Tasdiq kutmoqda'}
            value={pendingCount}
            color="var(--yellow)" bg="var(--yellow-bg)" border="var(--yellow-bd)"
          />
          <MetricCard
            icon={<WarningRegular />}
            label={isRu ? 'Неизвестные' : "Noma'lum"}
            value={summary.unknown || 0}
            color="var(--red)" bg="var(--red-bg)" border="var(--red-bd)"
          />
          <MetricCard
            icon={<CameraRegular />}
            label={isRu ? 'Камера события' : 'Kamera hodisalari'}
            value={summary.camera || 0}
            color="var(--accent)" bg="var(--accent-bg)" border="var(--accent-bd)"
          />
          <MetricCard
            icon={<WifiOffRegular />}
            label={isRu ? 'Офлайн камер' : 'Offline kameralar'}
            value={offline.length}
            color="var(--red)" bg="var(--red-bg)" border="var(--red-bd)"
          />
        </div>

        {/* ── Filter toolbar ────────────────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BuildingRegular fontSize={15} />
            {isRu ? 'Фильтры' : 'Filterlar'}
          </div>
          <div className="faceid-toolbar">
            {/* Tashkilot filtri */}
            {orgs.length > 0 && (
              <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                <FieldLabel>{isRu ? 'Организация' : 'Tashkilot'}</FieldLabel>
                <CustomSelect
                  value={orgFilter}
                  onChange={val => { setOrgFilter(val); setBranchFilter('all') }}
                  options={orgOptions}
                  placeholder={isRu ? 'Все организации' : 'Hamma tashkilotlar'}
                />
              </div>
            )}

            {/* Filial filtri */}
            <div style={{ flex: '1 1 180px', minWidth: 160 }}>
              <FieldLabel>{isRu ? 'Филиал' : 'Filial'}</FieldLabel>
              <CustomSelect
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchOptions}
                placeholder={isRu ? 'Все филиалы' : 'Hamma filiallar'}
                disabled={branchesByOrg.length === 0 && orgFilter === 'all'}
              />
            </div>

            {/* Reset button */}
            {(orgFilter !== 'all' || branchFilter !== 'all') && (
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => { setOrgFilter('all'); setBranchFilter('all') }}
                  style={secondaryBtn}
                >
                  <DismissCircleRegular fontSize={14} />
                  {isRu ? 'Сбросить' : 'Tozalash'}
                </button>
              </div>
            )}
          </div>

          {/* Active filters badge */}
          {(orgFilter !== 'all' || branchFilter !== 'all') && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {orgFilter !== 'all' && (
                <span style={filterBadge}>
                  <BuildingRegular fontSize={11} />
                  {orgs.find(o => String(o.id) === orgFilter)?.name || orgFilter}
                </span>
              )}
              {branchFilter !== 'all' && (
                <span style={filterBadge}>
                  <BuildingMultipleRegular fontSize={11} />
                  {branches.find(b => String(b.id) === branchFilter)?.name || branchFilter}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div style={tabBar}>
          {tabs.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={tabBtn(tab === item.id)}>
              {item.label}
              <span style={tabBadge(tab === item.id)}>{item.count}</span>
            </button>
          ))}
        </div>

        {/* ── Review tab ───────────────────────────────────────────────── */}
        {tab === 'review' && (
          <div style={cardStyle}>
            <SectionHeader
              title={isRu ? 'Tasdiqlash kerak bo\'lgan davomatlar' : "Tasdiqlash kerak bo'lgan davomatlar"}
              count={queue.length}
            />
            {loading ? (
              <SkeletonRows count={6} />
            ) : queue.length === 0 ? (
              <EmptyState text={isRu ? 'Подтверждения не требуются' : "Tasdiqlash kerak emas"} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['ID', isRu ? 'Vaqt' : 'Vaqt', isRu ? 'Xodim' : 'Xodim', 'Confidence',
                        isRu ? 'Kamera' : 'Kamera', isRu ? 'Tashkilot' : 'Tashkilot',
                        isRu ? 'Sabab' : 'Sabab', ''].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(it => (
                      <tr key={it.id} style={{ transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}><code style={{ color: 'var(--text-4)', fontSize: 12 }}>#{it.id}</code></td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{formatTime(it.timestamp)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDate(it.timestamp)}</div>
                        </td>
                        <td style={tdStyle}>
                          {it.employee_id
                            ? <Link to={`/employees/${it.employee_uuid || it.employee_id}`} style={linkStyle}>{it.employee_name}</Link>
                            : <span style={{ color: 'var(--text-3)' }}>{it.person_name || "Noma'lum"}</span>
                          }
                        </td>
                        <td style={tdStyle}><ConfidenceBadge value={it.face_confidence} min={it.camera_min_face_confidence} /></td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{it.camera_name || '—'}</div>
                          {it.camera_mac && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}><code>{it.camera_mac}</code></div>}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 13 }}>{it.organization_name || '—'}</div>
                          {it.branch_name && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{it.branch_name}</div>}
                        </td>
                        <td style={tdStyle}><ReasonBadge reason={it.review_reason} isRu={isRu} /></td>
                        <td style={tdStyle}>
                          <button onClick={() => openReview(it)} style={primaryBtn}>
                            {isRu ? 'Открыть' : 'Ochish'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Offline tab ───────────────────────────────────────────────── */}
        {tab === 'offline' && (
          <div style={cardStyle}>
            <SectionHeader title={isRu ? 'Offline kameralar' : 'Offline kameralar'} count={offline.length} />
            {loading ? (
              <SkeletonRows count={5} />
            ) : offline.length === 0 ? (
              <EmptyState text={isRu ? 'Все камеры онлайн' : "Barcha kameralar online"} icon="✅" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['ID', isRu ? 'Kamera' : 'Kamera', 'MAC', 'ISUP',
                        isRu ? 'Tashkilot' : 'Tashkilot', isRu ? 'Filial' : 'Filial',
                        isRu ? 'Oxirgi signal' : 'Oxirgi signal'].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offline.map(cam => (
                      <tr key={cam.id}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}><code style={{ color: 'var(--text-4)', fontSize: 12 }}>#{cam.id}</code></td>
                        <td style={tdStyle}>
                          <Link to={`/devices/${cam.id}`} style={linkStyle}>{cam.name}</Link>
                        </td>
                        <td style={tdStyle}><code style={{ fontSize: 12 }}>{cam.mac_address || '—'}</code></td>
                        <td style={tdStyle}>{cam.isup_device_id || '—'}</td>
                        <td style={tdStyle}>{cam.organization_name || '—'}</td>
                        <td style={tdStyle}>{cam.branch_name || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>
                            {formatDateTime(cam.last_seen_at) || (isRu ? "Signal yo'q" : "Signal yo'q")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Audit tab ─────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div style={cardStyle}>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              <SummaryItem label={isRu ? 'Jami' : 'Jami'} value={summary.total || 0} color="var(--text-1)" />
              <SummaryItem label={isRu ? 'Aniqlangan' : 'Aniqlangan'} value={summary.known || 0} color="var(--green)" />
              <SummaryItem label={isRu ? "Noma'lum" : "Noma'lum"} value={summary.unknown || 0} color="var(--red)" />
              <SummaryItem label={isRu ? 'Kamera' : 'Kamera'} value={summary.camera || 0} color="var(--accent)" />
              <SummaryItem label={isRu ? 'Tasdiq kutmoqda' : 'Tasdiq kutmoqda'} value={summary.pending || 0} color="var(--yellow)" />
            </div>
            <SectionHeader title={isRu ? 'Kamera-davomat auditi' : 'Kamera-davomat auditi'} count={(audit.problem_cameras || []).length} />
            {loading ? (
              <SkeletonRows count={5} />
            ) : (audit.problem_cameras || []).length === 0 ? (
              <EmptyState text={isRu ? 'Проблемных камер нет' : "Muammoli kameralar yo'q"} icon="✅" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[isRu ? 'Kamera' : 'Kamera', 'MAC',
                        isRu ? 'Jami' : 'Jami', isRu ? 'Tasdiq kutmoqda' : 'Tasdiq kutmoqda',
                        isRu ? "Noma'lum" : "Noma'lum"].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(audit.problem_cameras || []).map(cam => (
                      <tr key={cam.camera_id || cam.camera_mac}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}>
                          {cam.camera_id
                            ? <Link to={`/devices/${cam.camera_id}`} style={linkStyle}>{cam.camera_name || `#${cam.camera_id}`}</Link>
                            : '—'}
                        </td>
                        <td style={tdStyle}><code style={{ fontSize: 12 }}>{cam.camera_mac || '—'}</code></td>
                        <td style={tdStyle}><strong>{cam.total}</strong></td>
                        <td style={tdStyle}>
                          <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{cam.pending}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: 'var(--red)', fontWeight: 700 }}>{cam.unknown}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Backup tab ────────────────────────────────────────────────── */}
        {tab === 'backup' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <SectionHeader title="Backup" count={backups.length} compact />
              <button onClick={createBackup} disabled={backupBusy} style={primaryBtn}>
                <DatabaseRegular fontSize={15} />
                {backupBusy ? (isRu ? 'Создается...' : 'Yaratilmoqda...') : (isRu ? 'Создать backup' : 'Backup yaratish')}
              </button>
            </div>
            {loading ? (
              <SkeletonRows count={4} />
            ) : backups.length === 0 ? (
              <EmptyState text={isRu ? 'Бэкапов нет' : "Backuplar yo'q"} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[isRu ? 'Fayl' : 'Fayl', isRu ? 'Hajm' : 'Hajm',
                        isRu ? 'Yaratilgan' : 'Yaratilgan', isRu ? "Yo'l" : "Yo'l"].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map(b => (
                      <tr key={b.filename}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}><strong style={{ fontSize: 13 }}>{b.filename}</strong></td>
                        <td style={tdStyle}><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{b.size_mb} MB</span></td>
                        <td style={tdStyle}>{formatDateTime(b.created_at)}</td>
                        <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.path}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Review modal ─────────────────────────────────────────────────── */}
      {selected && (
        <div style={modalBackdrop} onMouseDown={() => setSelected(null)}>
          <div style={modal} onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{isRu ? 'Davomatni tasdiqlash' : 'Davomatni tasdiqlash'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                  #{selected.id} · {formatDateTime(selected.timestamp)} · {selected.camera_name || 'Kamera'}
                  {selected.organization_name && <> · {selected.organization_name}</>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={iconBtn}><DismissCircleRegular /></button>
            </div>

            {selected.snapshot_url && (
              <img
                src={selected.snapshot_url}
                alt=""
                style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            )}

            <label style={{ display: 'block', marginTop: 14 }}>
              <FieldLabel>{isRu ? 'Xodim qidirish' : 'Xodim qidirish'}</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '0 10px' }}>
                <SearchRegular style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                <input
                  value={employeeQuery}
                  onChange={e => setEmployeeQuery(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 0', fontSize: 13, color: 'var(--text-1)' }}
                  placeholder={isRu ? 'Ism yoki personal ID' : 'Ism yoki personal ID'}
                />
              </div>
            </label>

            <div style={{ maxHeight: 170, overflowY: 'auto', marginTop: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              {employees.map(emp => (
                <button key={emp.id} onClick={() => setSelectedEmployeeId(String(emp.id))} style={empBtn(selectedEmployeeId === String(emp.id))}>
                  <PersonRegular fontSize={15} />
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {emp.name}
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                      {emp.personal_id || "ID yo'q"} · {emp.organization_name || '—'}
                    </span>
                  </span>
                  {selectedEmployeeId === String(emp.id) && <CheckmarkCircleRegular style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
              {!employees.length && (
                <div style={{ padding: 14, color: 'var(--text-4)', fontSize: 13 }}>
                  {isRu ? 'Xodim topilmadi' : 'Xodim topilmadi'}
                </div>
              )}
            </div>

            <label style={{ display: 'block', marginTop: 12 }}>
              <FieldLabel>{isRu ? 'Izoh' : 'Izoh'}</FieldLabel>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                style={inpStyle}
                placeholder={isRu ? 'Operator izohi' : 'Operator izohi'}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => submitReview('mark_unknown')} disabled={saving} style={secondaryBtn}>
                {isRu ? "Noma'lum qoldirish" : "Noma'lum qoldirish"}
              </button>
              <button onClick={() => submitReview('approve')} disabled={saving || !selectedEmployeeId} style={primaryBtn}>
                <ShieldCheckmarkRegular fontSize={15} />
                {isRu ? 'Tasdiqlash' : 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, bg, border }) {
  return (
    <div style={{
      background: bg || 'var(--surface)',
      border: `1px solid ${border || 'var(--border)'}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count, compact }) {
  return (
    <div style={{ marginBottom: compact ? 0 : 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{title}</div>
      {count !== undefined && (
        <span style={{
          background: 'var(--surface-2)', color: 'var(--text-3)',
          fontSize: 11, fontWeight: 700, padding: '2px 8px',
          borderRadius: 999, border: '1px solid var(--border)',
        }}>{count}</span>
      )}
    </div>
  )
}

function SummaryItem({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

function SkeletonRows({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => <Skeleton.Row key={i} />)}
    </div>
  )
}

function EmptyState({ text, icon }) {
  return (
    <div style={{
      padding: 36, textAlign: 'center', color: 'var(--text-4)',
      fontSize: 13, background: 'var(--bg)', borderRadius: 10,
      border: '1px dashed var(--border-2)',
    }}>
      {icon && <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>}
      {text}
    </div>
  )
}

function ConfidenceBadge({ value, min }) {
  if (value == null) return <span style={{ color: 'var(--text-4)' }}>—</span>
  const pct = Math.round(Number(value) * 100)
  const minPct = Math.round(Number(min || 0.4) * 100)
  const ok = pct >= minPct
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column',
      fontWeight: 800, color: ok ? 'var(--green)' : 'var(--yellow)',
    }}>
      {pct}%
      <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 500 }}>min {minPct}%</span>
    </span>
  )
}

function ReasonBadge({ reason, isRu }) {
  const v = String(reason || '')
  let text = v || '—'
  let color = 'var(--text-3)'
  let bg = 'var(--surface-2)'
  let border = 'var(--border)'

  if (v.startsWith('low_confidence')) {
    text = isRu ? 'Past confidence' : 'Past confidence'
    color = 'var(--yellow)'; bg = 'var(--yellow-bg)'; border = 'var(--yellow-bd)'
  } else if (v === 'unknown_person') {
    text = isRu ? "Noma'lum shaxs" : "Noma'lum shaxs"
    color = 'var(--red)'; bg = 'var(--red-bg)'; border = 'var(--red-bd)'
  }

  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border}`,
    }}>{text}</span>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return iso }
}

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-GB') } catch { return iso }
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return iso }
}

// ── Styles ─────────────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20, marginBottom: 16,
}
const tabBar = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }
const tabBtn = active => ({
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '8px 14px', borderRadius: 9,
  border: `1px solid ${active ? 'var(--accent-bd)' : 'var(--border)'}`,
  background: active ? 'var(--accent-bg)' : 'var(--surface)',
  color: active ? 'var(--accent-tx)' : 'var(--text-2)',
  cursor: 'pointer', fontWeight: 700, fontSize: 13,
  transition: 'all 0.15s',
})
const tabBadge = active => ({
  minWidth: 22, height: 20, borderRadius: 999,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 6px',
  background: active ? 'var(--accent)' : 'var(--surface-2)',
  color: active ? '#fff' : 'var(--text-3)', fontSize: 11, fontWeight: 700,
})
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = {
  textAlign: 'left', padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-4)', fontSize: 11, textTransform: 'uppercase',
  fontWeight: 700, letterSpacing: 0.4, whiteSpace: 'nowrap',
}
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const linkStyle = { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }
const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', border: 'none', borderRadius: 8,
  background: 'var(--accent)', color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'opacity 0.15s',
}
const secondaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', border: '1px solid var(--border-2)',
  borderRadius: 8, background: 'var(--surface-2)',
  color: 'var(--text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
}
const heroBtn = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const filterBadge = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '3px 10px', borderRadius: 999,
  background: 'var(--accent-bg)', color: 'var(--accent-tx)',
  fontSize: 11, fontWeight: 700, border: '1px solid var(--accent-bd)',
}
const modalBackdrop = {
  position: 'fixed', inset: 0, zIndex: 9998,
  background: 'rgba(0,0,0,.72)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const modal = {
  width: 'min(720px, 96vw)', maxHeight: '92vh', overflowY: 'auto',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.4)',
}
const iconBtn = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text-2)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}
const inpStyle = {
  width: '100%', height: 36, borderRadius: 8,
  border: '1px solid var(--border-2)', background: 'var(--bg)',
  color: 'var(--text-1)', padding: '0 10px', boxSizing: 'border-box',
  fontSize: 13, outline: 'none',
}
const empBtn = active => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
  padding: '10px 12px', border: 'none',
  borderBottom: '1px solid var(--border)',
  background: active ? 'var(--accent-bg)' : 'transparent',
  color: active ? 'var(--accent-tx)' : 'var(--text-2)', cursor: 'pointer',
  transition: 'background 0.15s',
})
