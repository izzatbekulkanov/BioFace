/**
 * VersionsList — /settings/versions
 * Tizim dizayni asosida: PageHero + Section kartalar
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  TagRegular,
  AddRegular,
  EditRegular,
  DeleteRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  BeakerRegular,
  CalendarLtrRegular,
  PersonRegular,
  CodeRegular,
  LayerRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'

// ── Shared constants exported for use in other version pages ─────────────────
export const STATUS_META = {
  released:   { uz: 'Chiqarildi',  ru: 'Выпущено',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  beta:       { uz: 'Beta',        ru: 'Бета',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  deprecated: { uz: 'Eskirgan',    ru: 'Устаревший', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}
export const MODULE_COLORS = {
  core: '#6366f1', frontend: '#06b6d4', backend: '#f59e0b',
  mobile: '#10b981', api: '#ec4899',
}
export const moduleColor = m => MODULE_COLORS[m?.toLowerCase()] || '#94a3b8'

export function StatusBadge({ status, isRu }) {
  const sm = STATUS_META[status] || STATUS_META.released
  const Icon = status === 'released' ? CheckmarkCircleRegular
    : status === 'beta' ? BeakerRegular : DismissCircleRegular
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 20, background: sm.bg, color: sm.color,
    }}>
      <Icon fontSize={12} />
      {sm[isRu ? 'ru' : 'uz']}
    </span>
  )
}

export default function VersionsList() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const aliveRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch('/api/versions', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (aliveRef.current) { setVersions(data); setError('') }
    } catch (e) {
      if (aliveRef.current) setError(e.message)
    } finally {
      if (aliveRef.current) { setLoading(false); setRefreshing(false) }
    }
  }, [])

  useEffect(() => {
    aliveRef.current = true
    load(true)
    return () => { aliveRef.current = false }
  }, [load])

  async function handleDelete(id, versionTag) {
    const ok = await confirm({
      title: isRu ? 'Versiyani o\'chirish' : 'Versiyani o\'chirish',
      message: `v${versionTag} ${isRu ? 'versiyasini o\'chirishni tasdiqlaysizmi?' : 'versiyasini o\'chirishni tasdiqlaysizmi?'}`,
      confirmText: isRu ? 'Ha, o\'chirish' : 'Ha, o\'chirish',
      cancelText: isRu ? 'Bekor' : 'Bekor',
      danger: true,
    })
    if (!ok) return
    try {
      await fetch(`/api/versions/${id}`, { method: 'DELETE', credentials: 'include' })
      toast.success(isRu ? 'Versiya o\'chirildi' : 'Versiya o\'chirildi')
      load(true)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const latest = versions[0]

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={isRu ? 'Versiya nazorati' : 'Versiya nazorati'}
        sub={isRu ? 'История версий и изменений системы' : 'Tizim versiyalari va o\'zgarishlar tarixi'}
        right={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => load()} disabled={refreshing || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
                opacity: (refreshing || loading) ? 0.6 : 1,
              }}
            >
              <ArrowSyncRegular fontSize={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {isRu ? 'Yangilash' : 'Yangilash'}
            </button>
            <button
              onClick={() => navigate('/settings/versions/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <AddRegular fontSize={15} />
              {isRu ? 'Versiya qo\'shish' : 'Versiya qo\'shish'}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 80px' }}>
        {error && <ErrBanner msg={error} />}

        {/* Latest version highlight card */}
        {!loading && latest && (
          <div
            onClick={() => navigate(`/settings/versions/${latest.id}`)}
            style={{
              ...cardStyle,
              marginBottom: 24, cursor: 'pointer',
              borderColor: 'var(--accent-border, rgba(99,102,241,.35))',
              background: 'var(--surface)',
              transition: 'box-shadow .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                background: 'var(--surface-2, var(--bg))',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 18px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                  {isRu ? 'Joriy versiya' : 'Joriy versiya'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-tx, #818cf8)', fontFamily: 'monospace', letterSpacing: -1 }}>
                  v{latest.version}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                  {latest.title || `v${latest.version}`}
                </div>
                <VersionMeta v={latest} isRu={isRu} />
              </div>
              <StatusBadge status={latest.status} isRu={isRu} />
            </div>
          </div>
        )}

        {/* Section: versions list */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={kickerStyle}>{isRu ? 'Barcha versiyalar' : 'Barcha versiyalar'}</div>
              <h2 style={sectionTitleStyle}>{isRu ? 'Versiyalar tarixi' : 'Versiyalar tarixi'}</h2>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>
              {versions.length} {isRu ? 'ta versiya' : 'ta versiya'}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <Skeleton width={70} height={12} />
                  <Skeleton width={60} height={18} radius={20} />
                  <Skeleton width="30%" height={12} />
                  <Skeleton width={80} height={12} style={{ marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <TagRegular fontSize={36} style={{ color: 'var(--text-4)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                {isRu ? 'Versiyalar topilmadi' : 'Versiyalar topilmadi'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 20 }}>
                {isRu ? 'Birinchi versiyani qo\'shing' : 'Birinchi versiyani qo\'shing'}
              </div>
              <button
                onClick={() => navigate('/settings/versions/new')}
                style={{ ...accentBtn, margin: '0 auto' }}
              >
                <AddRegular fontSize={14} />
                {isRu ? 'Versiya qo\'shish' : 'Versiya qo\'shish'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {versions.map((v, idx) => (
                <VersionRow
                  key={v.id}
                  v={v}
                  isRu={isRu}
                  isLast={idx === versions.length - 1}
                  onView={() => navigate(`/settings/versions/${v.id}`)}
                  onEdit={() => navigate(`/settings/versions/${v.id}/edit`)}
                  onDelete={() => handleDelete(v.id, v.version)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── VersionRow ────────────────────────────────────────────────────────────────
function VersionRow({ v, isRu, isLast, onView, onEdit, onDelete }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        background: hov ? 'var(--surface-2, rgba(255,255,255,0.02))' : 'transparent',
        borderRadius: hov ? 8 : 0,
        cursor: 'pointer',
        transition: 'background .15s',
        paddingLeft: hov ? 8 : 0,
        paddingRight: hov ? 8 : 0,
        marginLeft: hov ? -8 : 0,
        marginRight: hov ? -8 : 0,
      }}
      onClick={onView}
    >
      {/* Version number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--accent-tx, #818cf8)', minWidth: 75 }}>
        <CodeRegular fontSize={13} />
        v{v.version}
      </div>

      {/* Module badge */}
      {v.module && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: `${moduleColor(v.module)}22`, color: moduleColor(v.module),
          textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
        }}>
          {v.module}
        </span>
      )}

      {/* Title */}
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {v.title || <span style={{ color: 'var(--text-4)' }}>—</span>}
      </div>

      {/* Meta */}
      <VersionMeta v={v} isRu={isRu} />
      <StatusBadge status={v.status} isRu={isRu} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
        <IconBtn onClick={onEdit} title={isRu ? 'Tahrirlash' : 'Tahrirlash'}>
          <EditRegular fontSize={14} />
        </IconBtn>
        <IconBtn onClick={onDelete} title={isRu ? 'O\'chirish' : 'O\'chirish'} danger>
          <DeleteRegular fontSize={14} />
        </IconBtn>
      </div>
    </div>
  )
}

// ── Reusable small helpers ────────────────────────────────────────────────────
function VersionMeta({ v, isRu }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-4)', flexWrap: 'wrap' }}>
      {v.released_at && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CalendarLtrRegular fontSize={12} />
          {new Date(v.released_at).toLocaleDateString(isRu ? 'ru-RU' : 'uz-UZ')}
        </span>
      )}
      {v.author && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PersonRegular fontSize={12} />
          {v.author}
        </span>
      )}
    </div>
  )
}

function IconBtn({ onClick, title, danger, children }) {
  const [hov, setHov] = useState(false)
  const color = danger ? '#ef4444' : 'var(--accent)'
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 7, border: 'none',
        background: hov ? (danger ? 'rgba(239,68,68,0.1)' : 'var(--surface-2, rgba(99,102,241,.1))') : 'transparent',
        color: hov ? color : 'var(--text-3)', cursor: 'pointer', transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

export function ErrBanner({ msg }) {
  return (
    <div style={{ marginBottom: 20, padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, border: '1px solid var(--red-bd)', fontSize: 14 }}>
      {msg}
    </div>
  )
}

// ── Shared styles (exported for use in sibling pages) ─────────────────────────
export const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
}
export const kickerStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--accent-tx, #818cf8)',
  textTransform: 'uppercase', letterSpacing: 0.7,
}
export const sectionTitleStyle = {
  margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--text-1)',
}
export const inpStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 7,
  border: '1px solid var(--border-2, var(--border))', background: 'var(--bg)',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
export const accentBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 18px', borderRadius: 8,
  background: 'var(--accent)', border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
export const subtleBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 18px', borderRadius: 8,
  background: 'var(--surface-2, var(--surface))', border: '1px solid var(--border-2, var(--border))',
  color: 'var(--text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
