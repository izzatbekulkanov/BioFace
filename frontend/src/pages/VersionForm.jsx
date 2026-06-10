/**
 * VersionForm — /settings/versions/new  |  /settings/versions/:id/edit
 * Tizim dizayni asosida: PageHero + backPath + Section kartalar + Field komponent
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { SaveRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import PageHero from '../components/PageHero'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toaster'
import RichEditor from '../components/RichEditor'
import {
  cardStyle, kickerStyle, sectionTitleStyle,
  inpStyle, accentBtn, subtleBtn,
  moduleColor, StatusBadge, ErrBanner,
} from './Versions'

const MODULES = ['core', 'frontend', 'backend', 'mobile', 'api']
const EMPTY = {
  version: '', module: 'core', title: '',
  release_notes: '', author: '', status: 'released', released_at: '',
}

export default function VersionForm() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const toast = useToast()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    fetch('/api/versions', { credentials: 'include' })
      .then(r => r.json())
      .then(list => {
        const v = list.find(v => String(v.id) === String(id))
        if (v) {
          setForm({
            version:       v.version || '',
            module:        v.module  || 'core',
            title:         v.title   || '',
            release_notes: v.release_notes || '',
            author:        v.author  || '',
            status:        v.status  || 'released',
            released_at:   v.released_at ? v.released_at.slice(0, 10) : '',
          })
        } else setError(isRu ? 'Versiya topilmadi' : 'Versiya topilmadi')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isEdit, isRu])

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setV = k => v => setForm(f => ({ ...f, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.version.trim()) { setError(isRu ? 'Versiya raqami majburiy' : 'Versiya raqami majburiy'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      payload.released_at = payload.released_at ? new Date(payload.released_at).toISOString() : null
      const url    = isEdit ? `/api/versions/${id}` : '/api/versions'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const saved = await res.json()
      toast.success(isEdit
        ? (isRu ? 'Versiya yangilandi' : 'Versiya yangilandi')
        : (isRu ? 'Versiya qo\'shildi' : 'Versiya qo\'shildi'))
      navigate(`/settings/versions/${saved.id}`)
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)' }}>
        <PageHero
          badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
          title={isEdit ? (isRu ? 'Versiyani tahrirlash' : 'Versiyani tahrirlash') : (isRu ? 'Yangi versiya' : 'Yangi versiya')}
          backPath="/settings/versions"
        />
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
          <div style={cardStyle}><Skeleton.Card rows={6} /></div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', overflowY: 'auto' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .vf-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .vf-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        @media (max-width: 600px) {
          .vf-grid-2, .vf-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <PageHero
        badge={`✦ ${isRu ? 'Система' : 'Tizim'}`}
        title={isEdit
          ? (isRu ? 'Versiyani tahrirlash' : 'Versiyani tahrirlash')
          : (isRu ? 'Yangi versiya qo\'shish' : 'Yangi versiya qo\'shish')}
        sub={isRu
          ? 'Versiya ma\'lumotlarini to\'ldiring va saqlang'
          : 'Versiya ma\'lumotlarini to\'ldiring va saqlang'}
        backPath="/settings/versions"
        right={
          <button
            type="button"
            onClick={() => navigate('/settings/versions')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeftRegular fontSize={15} />
            {isRu ? 'Orqaga' : 'Orqaga'}
          </button>
        }
      />

      <form onSubmit={onSubmit} style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && <ErrBanner msg={error} />}

        {/* Section 1: Asosiy ma'lumotlar */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={kickerStyle}>{isRu ? 'Asosiy' : 'Asosiy'}</div>
            <h2 style={sectionTitleStyle}>{isRu ? 'Versiya ma\'lumotlari' : 'Versiya ma\'lumotlari'}</h2>
          </div>

          <div className="vf-grid-2" style={{ marginBottom: 14 }}>
            <Field label={isRu ? 'Versiya raqami' : 'Versiya raqami'} required>
              <div style={{ position: 'relative' }}>
                <input
                  id="vf-version"
                  required
                  value={form.version}
                  onChange={setF('version')}
                  placeholder="2.4.1"
                  style={{ ...inpStyle, fontFamily: 'monospace', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}
                />
              </div>
            </Field>
            <Field label={isRu ? 'Sarlavha' : 'Sarlavha'}>
              <input
                id="vf-title"
                value={form.title}
                onChange={setF('title')}
                placeholder={isRu ? 'Qisqa tavsif' : 'Qisqa tavsif'}
                style={inpStyle}
              />
            </Field>
          </div>

          {/* Module selector */}
          <Field label={isRu ? 'Modul' : 'Modul'}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {MODULES.map(m => (
                <button
                  key={m} type="button"
                  onClick={() => setV('module')(m)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    border: `1px solid ${form.module === m ? moduleColor(m) : 'var(--border)'}`,
                    background: form.module === m ? `${moduleColor(m)}22` : 'var(--bg)',
                    color: form.module === m ? moduleColor(m) : 'var(--text-3)',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5, transition: 'all .15s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
        </section>

        {/* Section 2: Holat va sana */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={kickerStyle}>{isRu ? 'Holat' : 'Holat'}</div>
            <h2 style={sectionTitleStyle}>{isRu ? 'Holat, sana, muallif' : 'Holat, sana, muallif'}</h2>
          </div>
          <div className="vf-grid-3">
            <Field label={isRu ? 'Holat' : 'Holat'}>
              <select id="vf-status" value={form.status} onChange={setF('status')} style={inpStyle}>
                <option value="released">{isRu ? 'Chiqarildi' : 'Chiqarildi'}</option>
                <option value="beta">Beta</option>
                <option value="deprecated">{isRu ? 'Eskirgan' : 'Eskirgan'}</option>
              </select>
            </Field>
            <Field label={isRu ? 'Chiqarish sanasi' : 'Chiqarish sanasi'}>
              <input id="vf-date" type="date" value={form.released_at} onChange={setF('released_at')} style={inpStyle} />
            </Field>
            <Field label={isRu ? 'Muallif' : 'Muallif'}>
              <input id="vf-author" value={form.author} onChange={setF('author')} placeholder="BioFace Team" style={inpStyle} />
            </Field>
          </div>

          {/* Current status preview */}
          {form.status && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{isRu ? 'Ko\'rinishi:' : 'Ko\'rinishi:'}</span>
              <StatusBadge status={form.status} isRu={isRu} />
            </div>
          )}
        </section>

        {/* Section 3: Release Notes */}
        <section style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={kickerStyle}>{isRu ? 'Kontent' : 'Kontent'}</div>
            <h2 style={sectionTitleStyle}>{isRu ? 'Nashr eslatmalari (Release Notes)' : 'Nashr eslatmalari (Release Notes)'}</h2>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-4)' }}>
              {isRu
                ? 'Markdown formati qo\'llab-quvvatlanadi. Sarlavha (# ##), ro\'yxat (- 1.), kod (` ```), bold, italic va boshqalar.'
                : 'Markdown formati qo\'llab-quvvatlanadi. Sarlavha (# ##), ro\'yxat (- 1.), kod (` ```), bold, italic va boshqalar.'}
            </div>
          </div>
          <RichEditor
            value={form.release_notes}
            onChange={setV('release_notes')}
            minRows={14}
            placeholder={'## Yangiliklar\n\n- **Yangi xususiyat** — batafsil tavsif\n- *Tuzatish* — nima tuzatildi\n\n## Xatoliklar tuzatildi\n\n- Bug #123 — muammo tavsifi\n\n## Migratsiya'}
          />
        </section>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'flex-end',
          padding: '16px 20px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <button type="button" onClick={() => navigate('/settings/versions')} style={subtleBtn}>
            <ArrowLeftRegular fontSize={14} />
            {isRu ? 'Bekor qilish' : 'Bekor qilish'}
          </button>
          <button type="submit" disabled={saving} style={{ ...accentBtn, opacity: saving ? 0.7 : 1 }}>
            <SaveRegular fontSize={14} style={{ animation: saving ? 'spin 1s linear infinite' : 'none' }} />
            {saving
              ? (isRu ? 'Saqlanmoqda…' : 'Saqlanmoqda…')
              : (isRu ? 'Saqlash' : 'Saqlash')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Field component (tizim bilan bir xil) ─────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#f43f5e' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{hint}</span>}
    </label>
  )
}
