import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ShieldCheckmarkRegular,
  ArrowSyncRegular,
  PersonRegular,
  BuildingRegular,
  FilterRegular,
  SearchRegular,
  AddRegular,
  EditRegular,
  DeleteRegular,
  ArrowExportRegular,
  ArrowImportRegular,
  SignOutRegular,
  ArrowEnterRegular,
  DismissCircleRegular,
  EyeRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import CustomSelect from '../components/CustomSelect'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'

const ACTION_ICONS = {
  CREATE:  { icon: <AddRegular />,        color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-bd)' },
  UPDATE:  { icon: <EditRegular />,        color: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-bd)' },
  DELETE:  { icon: <DeleteRegular />,      color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-bd)' },
  LOGIN:   { icon: <ArrowEnterRegular />,     color: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-bd)' },
  LOGOUT:  { icon: <SignOutRegular />,      color: 'var(--text-3)', bg: 'var(--surface-2)', border: 'var(--border)' },
  EXPORT:  { icon: <ArrowExportRegular />, color: 'var(--purple)', bg: 'var(--purple-bg)', border: 'var(--purple-bd)' },
  IMPORT:  { icon: <ArrowImportRegular />, color: 'var(--purple)', bg: 'var(--purple-bg)', border: 'var(--purple-bd)' },
  APPROVE: { icon: <CheckmarkCircleRegular />, color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-bd)' },
  REJECT:  { icon: <DismissCircleRegular />, color: 'var(--red)',   bg: 'var(--red-bg)',   border: 'var(--red-bd)' },
}

function ActionBadge({ action }) {
  const cfg = ACTION_ICONS[action] || ACTION_ICONS.UPDATE
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>{cfg.icon}</span>
      {action}
    </span>
  )
}

function EntityBadge({ type }) {
  const colors = {
    employee: 'var(--accent)', device: 'var(--yellow)', organization: 'var(--green)',
    user: 'var(--purple)', attendance: 'var(--dir-in)', salary: 'var(--dir-out)',
  }
  const color = colors[type] || 'var(--text-3)'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, color, background: color + '18',
      border: `1px solid ${color}30`,
    }}>
      {type}
    </span>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
      {children}
    </div>
  )
}

function DetailModal({ log, onClose, isRu }) {
  if (!log) return null
  let oldVals = null, newVals = null
  try { oldVals = log.old_values ? JSON.parse(log.old_values) : null } catch {}
  try { newVals = log.new_values ? JSON.parse(log.new_values) : null } catch {}

  return (
    <div style={modalBackdrop} onMouseDown={onClose}>
      <div style={modal} onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {isRu ? 'Audit yozuvi tafsilotlari' : 'Audit yozuvi tafsilotlari'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-4)' }}>#{log.id} · {formatDateTime(log.created_at)}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><DismissCircleRegular /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <InfoRow label={isRu ? 'Amal' : 'Amal'} value={<ActionBadge action={log.action} />} />
          <InfoRow label={isRu ? 'Tur' : 'Tur'} value={log.entity_type ? <EntityBadge type={log.entity_type} /> : '—'} />
          <InfoRow label={isRu ? 'Foydalanuvchi' : 'Foydalanuvchi'} value={log.user_name || '—'} />
          <InfoRow label={isRu ? 'Rol' : 'Rol'} value={log.user_role || '—'} />
          <InfoRow label={isRu ? 'Obyekt' : 'Obyekt'} value={log.entity_name || log.entity_id || '—'} />
          <InfoRow label="IP" value={<code style={{ fontSize: 12 }}>{log.ip_address || '—'}</code>} />
        </div>

        {log.description && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--accent-tx)' }}>
            {log.description}
          </div>
        )}

        {(oldVals || newVals) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {oldVals && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 6 }}>
                  {isRu ? 'Eski qiymatlar' : 'Eski qiymatlar'}
                </div>
                <pre style={{
                  background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8,
                  padding: 12, fontSize: 11, color: 'var(--red)', overflowX: 'auto',
                  maxHeight: 200, margin: 0,
                }}>
                  {JSON.stringify(oldVals, null, 2)}
                </pre>
              </div>
            )}
            {newVals && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 6 }}>
                  {isRu ? 'Yangi qiymatlar' : 'Yangi qiymatlar'}
                </div>
                <pre style={{
                  background: 'var(--green-bg)', border: '1px solid var(--green-bd)', borderRadius: 8,
                  padding: 12, fontSize: 11, color: 'var(--green)', overflowX: 'auto',
                  maxHeight: 200, margin: 0,
                }}>
                  {JSON.stringify(newVals, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  )
}

export default function AuditLogs() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const toast = useToast()

  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 50

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter)
      if (entityFilter && entityFilter !== 'all') params.set('entity_type', entityFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo + 'T23:59:59')
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/audit-logs?${params}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) {
          // API hali tayyor emas
          setLogs([])
          setTotal(0)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setLogs(Array.isArray(data.items) ? data.items : [])
      setTotal(Number(data.total || 0))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, entityFilter, dateFrom, dateTo, search, toast])

  useEffect(() => {
    setPage(1)
  }, [actionFilter, entityFilter, dateFrom, dateTo, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPages = Math.ceil(total / limit) || 1

  const actionOptions = useMemo(() => [
    { value: 'all', label: isRu ? 'Barcha amallar' : 'Barcha amallar' },
    { value: 'CREATE',  label: isRu ? 'Yaratish'  : 'Yaratish' },
    { value: 'UPDATE',  label: isRu ? 'Tahrirlash': 'Tahrirlash' },
    { value: 'DELETE',  label: isRu ? "O'chirish"  : "O'chirish" },
    { value: 'LOGIN',   label: isRu ? 'Kirish'    : 'Kirish' },
    { value: 'LOGOUT',  label: isRu ? 'Chiqish'   : 'Chiqish' },
    { value: 'EXPORT',  label: 'Export' },
    { value: 'APPROVE', label: isRu ? 'Tasdiqlash': 'Tasdiqlash' },
    { value: 'REJECT',  label: isRu ? 'Rad etish' : 'Rad etish' },
  ], [isRu])

  const entityOptions = useMemo(() => [
    { value: 'all',          label: isRu ? 'Barcha turlar' : 'Barcha turlar' },
    { value: 'employee',     label: isRu ? 'Xodim'         : 'Xodim' },
    { value: 'device',       label: isRu ? 'Kamera'        : 'Kamera' },
    { value: 'organization', label: isRu ? 'Tashkilot'     : 'Tashkilot' },
    { value: 'branch',       label: isRu ? 'Filial'        : 'Filial' },
    { value: 'user',         label: isRu ? 'Foydalanuvchi' : 'Foydalanuvchi' },
    { value: 'schedule',     label: isRu ? 'Smena'         : 'Smena' },
    { value: 'attendance',   label: isRu ? 'Davomat'       : 'Davomat' },
    { value: 'salary',       label: isRu ? 'Maosh'         : 'Maosh' },
    { value: 'holiday',      label: isRu ? 'Bayram'        : 'Bayram' },
  ], [isRu])

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge="✦ Audit"
        title={isRu ? 'Audit jurnali' : 'Audit jurnali'}
        sub={isRu ? 'Kim nima o\'zgartirdi — to\'liq tarix' : "Kim nima o'zgartirdi — to'liq tarix"}
        right={
          <button onClick={loadData} disabled={loading} style={heroBtn}>
            <ArrowSyncRegular fontSize={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {isRu ? 'Yangilash' : 'Yangilash'}
          </button>
        }
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .audit-container { max-width: 1400px; margin: 0 auto; padding: 24px 32px 80px; }
        @media (max-width: 768px) {
          .audit-container { padding: 16px !important; }
          .audit-filters { flex-direction: column !important; }
          .audit-filters > div { width: 100% !important; }
        }
      `}</style>

      <div className="audit-container">

        {/* ── Stats strip ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: isRu ? 'Jami yozuvlar' : 'Jami yozuvlar', value: total, color: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-bd)' },
            { label: isRu ? 'Ko\'rsatilmoqda' : "Ko'rsatilmoqda", value: logs.length, color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-bd)' },
            { label: isRu ? 'Sahifa' : 'Sahifa', value: `${page}/${totalPages}`, color: 'var(--text-2)', bg: 'var(--surface-2)', border: 'var(--border)' },
          ].map((s, i) => (
            <div key={i} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>
            <FilterRegular fontSize={15} />
            {isRu ? 'Filterlar' : 'Filterlar'}
          </div>
          <div className="audit-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 160px' }}>
              <FieldLabel>{isRu ? 'Amal' : 'Amal'}</FieldLabel>
              <CustomSelect value={actionFilter} onChange={setActionFilter} options={actionOptions} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <FieldLabel>{isRu ? 'Tur' : 'Tur'}</FieldLabel>
              <CustomSelect value={entityFilter} onChange={setEntityFilter} options={entityOptions} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <FieldLabel>{isRu ? 'Boshlanish sanasi' : 'Boshlanish sanasi'}</FieldLabel>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inpStyle} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <FieldLabel>{isRu ? 'Tugash sanasi' : 'Tugash sanasi'}</FieldLabel>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inpStyle} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <FieldLabel>{isRu ? 'Qidiruv' : 'Qidiruv'}</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '1px solid var(--border-3)', borderRadius: 8, padding: '0 10px' }}>
                <SearchRegular style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={isRu ? 'Foydalanuvchi, tavsif...' : 'Foydalanuvchi, tavsif...'}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 0', fontSize: 13, color: 'var(--text-1)' }}
                />
              </div>
            </div>
            {(actionFilter !== 'all' || entityFilter !== 'all' || dateFrom || dateTo || search) && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => { setActionFilter('all'); setEntityFilter('all'); setDateFrom(''); setDateTo(''); setSearch('') }}
                  style={secondaryBtn}
                >
                  <DismissCircleRegular fontSize={14} />
                  {isRu ? 'Tozalash' : 'Tozalash'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div style={cardStyle}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => <Skeleton.Row key={i} />)}
            </div>
          ) : logs.length === 0 ? (
            <div style={emptyStyle}>
              <ShieldCheckmarkRegular style={{ fontSize: 40, color: 'var(--text-4)', marginBottom: 10 }} />
              <div>{isRu ? "Audit yozuvlari topilmadi" : "Audit yozuvlari topilmadi"}</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>
                {isRu ? "Amallar bajarilgach bu yerda ko'rsatiladi" : "Amallar bajarilgach bu yerda ko'rsatiladi"}
              </div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        'ID',
                        isRu ? 'Vaqt'          : 'Vaqt',
                        isRu ? 'Foydalanuvchi' : 'Foydalanuvchi',
                        isRu ? 'Amal'          : 'Amal',
                        isRu ? 'Tur'           : 'Tur',
                        isRu ? 'Obyekt'        : 'Obyekt',
                        isRu ? 'Tavsif'        : 'Tavsif',
                        'IP',
                        '',
                      ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}
                        style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-4)' }}>#{log.id}</code></td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{formatTime(log.created_at)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDate(log.created_at)}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                              <PersonRegular fontSize={14} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user_name || '—'}</div>
                              {log.user_role && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{log.user_role}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}><ActionBadge action={log.action} /></td>
                        <td style={tdStyle}>{log.entity_type ? <EntityBadge type={log.entity_type} /> : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 13 }}>{log.entity_name || '—'}</div>
                          {log.entity_id && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>ID: {log.entity_id}</div>}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.description || '—'}
                          </div>
                        </td>
                        <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-4)' }}>{log.ip_address || '—'}</code></td>
                        <td style={tdStyle}>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedLog(log) }}
                            style={{ ...secondaryBtn, padding: '4px 8px', fontSize: 11 }}
                          >
                            <EyeRegular fontSize={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
                  {isRu ? `Jami: ${total} ta yozuv` : `Jami: ${total} ta yozuv`}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ ...secondaryBtn, opacity: page === 1 ? 0.5 : 1 }}
                  >
                    ← {isRu ? 'Oldingi' : 'Oldingi'}
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{ ...secondaryBtn, opacity: page >= totalPages ? 0.5 : 1 }}
                  >
                    {isRu ? 'Keyingi' : 'Keyingi'} →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} isRu={isRu} />
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
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }
const heroBtn = { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const secondaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-4)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4, whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const emptyStyle = { padding: 48, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center' }
const inpStyle = { width: '100%', height: 36, borderRadius: 8, border: '1px solid var(--border-3)', background: 'var(--bg)', color: 'var(--text-1)', padding: '0 10px', boxSizing: 'border-box', fontSize: 13, outline: 'none' }
const modalBackdrop = { position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const modal = { width: 'min(800px, 96vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }
const iconBtn = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
