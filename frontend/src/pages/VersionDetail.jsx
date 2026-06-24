/**
 * VersionDetail — /settings/versions/:id
 * Ko'rish sahifasi. Tizim dizayni asosida: PageHero + Section kartalar.
 * Release notes Markdown render qilinadi.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EditRegular,
  DeleteRegular,
  CalendarLtrRegular,
  PersonRegular,
  LayerRegular,
  CodeRegular,
  TagRegular,
} from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toaster'
import {
  cardStyle, kickerStyle, sectionTitleStyle,
  accentBtn, subtleBtn,
  StatusBadge, moduleColor, ErrBanner,
} from './Versions'

// Lightweight Markdown → HTML
function mdToHtml(md = '') {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, (_, c) =>
      `<pre style="background:var(--bg);padding:14px;border-radius:8px;overflow-x:auto;font-size:12.5px;border:1px solid var(--border);line-height:1.6;margin:10px 0"><code style="font-family:monospace">${c.trim()}</code></pre>`)
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px;color:var(--text-1)">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:17px;font-weight:700;margin:22px 0 10px;color:var(--text-1);padding-bottom:6px;border-bottom:1px solid var(--border)">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:21px;font-weight:800;margin:24px 0 12px;color:var(--text-1)">$1</h1>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:18px 0"/>')
    .replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:10px;margin:5px 0"><span style="color:#10b981;font-size:16px;line-height:1.3">✅</span><span style="text-decoration:line-through;color:var(--text-3)">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm,'<div style="display:flex;align-items:flex-start;gap:10px;margin:5px 0"><span style="font-size:16px;line-height:1.3">⬜</span><span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<li style="margin:5px 0;padding-left:2px;line-height:1.65">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li style="margin:5px 0;list-style-type:decimal;padding-left:2px;line-height:1.65">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul style="padding-left:22px;margin:8px 0">${m}</ul>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-1)">$1</strong>')
    .replace(/_(.+?)_/g,       '<em>$1</em>')
    .replace(/~~(.+?)~~/g,     '<del style="color:var(--text-3)">$1</del>')
    .replace(/`(.+?)`/g,       '<code style="background:var(--bg);padding:2px 7px;border-radius:5px;font-size:12.5px;font-family:monospace;border:1px solid var(--border);color:var(--accent-tx,#818cf8)">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--accent-tx,#818cf8);text-decoration:underline;font-weight:600" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n+/g, '</p><p style="margin:8px 0;line-height:1.75">')
    .replace(/\n/g, '<br/>')
  return `<div style="font-size:14px;line-height:1.75;color:var(--text-1)"><p style="margin:0 0 8px">${html}</p></div>`
}

export default function VersionDetail() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const { id } = useParams()
  const confirm = useConfirm()
  const toast = useToast()

  const [currentUser, setCurrentUser] = useState(null)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCurrentUser(d) })
      .catch(() => {})

    fetch('/api/versions', { credentials: 'include' })
      .then(r => r.json())
      .then(list => {
        const v = list.find(v => String(v.id) === String(id))
        if (v) setVersion(v)
        else setError(isRu ? 'Versiya topilmadi' : 'Versiya topilmadi')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isRu])

  const role = (currentUser?.role || '').toLowerCase().replace(/_/g, '')
  const isSuper = role === 'superadmin'

  async function handleDelete() {
    const ok = await confirm({
      title: isRu ? 'Versiyani o\'chirish' : 'Versiyani o\'chirish',
      message: `v${version?.version} — ${version?.title || ''}`,
      confirmText: isRu ? 'Ha, o\'chirish' : 'Ha, o\'chirish',
      cancelText: isRu ? 'Bekor' : 'Bekor',
      danger: true,
    })
    if (!ok) return
    try {
      await fetch(`/api/versions/${id}`, { method: 'DELETE', credentials: 'include' })
      toast.success(isRu ? 'Versiya o\'chirildi' : 'Versiya o\'chirildi')
      navigate('/settings/versions')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
          title={isRu ? 'Versiya tafsilotlari' : 'Versiya tafsilotlari'}
          backPath="/settings/versions"
        />
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}><Skeleton.Card rows={4} /></div>
          <div style={cardStyle}><Skeleton.Card rows={8} /></div>
        </div>
      </div>
    )
  }

  if (error || !version) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
          title={isRu ? 'Versiya tafsilotlari' : 'Versiya tafsilotlari'}
          backPath="/settings/versions"
        />
        <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 32px' }}>
          <ErrBanner msg={error || (isRu ? 'Topilmadi' : 'Topilmadi')} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={version.title || `v${version.version}`}
        sub={`v${version.version} · ${version.module || 'core'}`}
        backPath="/settings/versions"
        right={isSuper && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate(`/settings/versions/${id}/edit`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <EditRegular fontSize={15} />
              {isRu ? 'Tahrirlash' : 'Tahrirlash'}
            </button>
            <button
              onClick={handleDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <DeleteRegular fontSize={15} />
            </button>
          </div>
        )}
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Meta info card */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <div style={kickerStyle}>{isRu ? 'Ma\'lumotlar' : 'Ma\'lumotlar'}</div>
            <h2 style={sectionTitleStyle}>{isRu ? 'Versiya tafsilotlari' : 'Versiya tafsilotlari'}</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {/* Version */}
            <MetaCard
              label={isRu ? 'Versiya' : 'Versiya'}
              icon={<CodeRegular fontSize={14} style={{ color: 'var(--accent-tx,#818cf8)' }} />}
              value={
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: 'var(--accent-tx,#818cf8)' }}>
                  v{version.version}
                </span>
              }
            />
            {/* Status */}
            <MetaCard
              label={isRu ? 'Holat' : 'Holat'}
              icon={null}
              value={<StatusBadge status={version.status} isRu={isRu} />}
            />
            {/* Module */}
            {version.module && (
              <MetaCard
                label={isRu ? 'Modul' : 'Modul'}
                icon={<LayerRegular fontSize={14} style={{ color: moduleColor(version.module) }} />}
                value={
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: `${moduleColor(version.module)}22`,
                    color: moduleColor(version.module), textTransform: 'uppercase',
                  }}>
                    {version.module}
                  </span>
                }
              />
            )}
            {/* Released at */}
            {version.released_at && (
              <MetaCard
                label={isRu ? 'Chiqarish sanasi' : 'Chiqarish sanasi'}
                icon={<CalendarLtrRegular fontSize={14} style={{ color: 'var(--text-3)' }} />}
                value={
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {new Date(version.released_at).toLocaleDateString(isRu ? 'ru-RU' : 'uz-UZ', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                }
              />
            )}
            {/* Author */}
            {version.author && (
              <MetaCard
                label={isRu ? 'Muallif' : 'Muallif'}
                icon={<PersonRegular fontSize={14} style={{ color: 'var(--text-3)' }} />}
                value={<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{version.author}</span>}
              />
            )}
          </div>
        </section>

        {/* Release notes card */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={kickerStyle}>{isRu ? 'Kontent' : 'Kontent'}</div>
            <h2 style={sectionTitleStyle}>{isRu ? 'Nashr eslatmalari' : 'Nashr eslatmalari'}</h2>
          </div>

          {version.release_notes ? (
            <div
              style={{ padding: '4px 0' }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(version.release_notes) }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <TagRegular fontSize={32} style={{ color: 'var(--text-4)', marginBottom: 10 }} />
              <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 16 }}>
                {isRu ? 'Nashr eslatmalari qo\'shilmagan' : 'Nashr eslatmalari qo\'shilmagan'}
              </div>
              {isSuper && (
                <button
                  onClick={() => navigate(`/settings/versions/${id}/edit`)}
                  style={{ ...accentBtn, margin: '0 auto' }}
                >
                  <EditRegular fontSize={14} />
                  {isRu ? 'Eslatma qo\'shish' : 'Eslatma qo\'shish'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/settings/versions')} style={subtleBtn}>
            {isRu ? 'Ro\'yxatga qaytish' : 'Ro\'yxatga qaytish'}
          </button>
          {isSuper && (
            <button onClick={() => navigate(`/settings/versions/${id}/edit`)} style={accentBtn}>
              <EditRegular fontSize={14} />
              {isRu ? 'Tahrirlash' : 'Tahrirlash'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MetaCard ─────────────────────────────────────────────────────────────────
function MetaCard({ label, icon, value }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      {value}
    </div>
  )
}
