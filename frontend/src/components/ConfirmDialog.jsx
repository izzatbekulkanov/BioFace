/**
 * ConfirmDialog — Fluent UI dizayniga mos global tasdiqlash dialogi.
 *
 * Ishlash tartibi:
 *   1. useConfirm() hook'ini import qiling
 *   2. const confirm = useConfirm()  →  confirm({ ... }) Promise qaytaradi
 *   3. <ConfirmProvider> ni App.jsx ichiga qo'shing (bir marta)
 *
 * Misol:
 *   const confirmed = await confirm({
 *     title: "Kamerani o'chirish",
 *     message: `"${cam.name}" kamerasini o'chirmoqchimisiz?`,
 *     confirmText: "O'chirish",
 *     danger: true,
 *   })
 *   if (confirmed) { ... }
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { DeleteRegular, DismissRegular, WarningRegular, InfoRegular } from '@fluentui/react-icons'

/* ── Context ─────────────────────────────────────────────────── */
const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

/* ── Dialog komponent ─────────────────────────────────────────── */
function Dialog({ open, title, message, confirmText, cancelText, danger, icon, onConfirm, onCancel }) {
  const overlayRef = useRef(null)

  // ESC bilan yopish
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const accentColor = danger ? '#f87171' : '#0078d4'
  const accentBg    = danger ? 'rgba(248,113,113,0.12)' : 'rgba(0,120,212,0.12)'
  const accentBd    = danger ? 'rgba(248,113,113,0.25)' : 'rgba(0,120,212,0.25)'

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeInOverlay 0.15s ease',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 28px 24px',
        maxWidth: 420,
        width: '100%',
        boxShadow: 'var(--shadow)',
        animation: 'slideUpDialog 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: accentBg, border: `1px solid ${accentBd}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accentColor, fontSize: 20,
          }}>
            {icon || (danger
              ? <DeleteRegular fontSize={20} />
              : <InfoRegular fontSize={20} />
            )}
          </div>
          <div style={{ flex: 1, paddingTop: 2 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: 'var(--text-1)',
              letterSpacing: -0.2, marginBottom: 6,
            }}>
              {title}
            </div>
            <div style={{
              fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.5,
            }}>
              {message}
            </div>
          </div>
          {/* X close */}
          <button onClick={onCancel} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-4)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
          >
            <DismissRegular fontSize={13} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 -28px 20px', width: 'calc(100% + 56px)' }} />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '9px 20px', borderRadius: 9,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            {cancelText || 'Bekor qilish'}
          </button>
          <button onClick={onConfirm} style={{
            padding: '9px 20px', borderRadius: 9, border: 'none',
            background: danger ? '#f87171' : 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            autoFocus
          >
            {danger && <DeleteRegular fontSize={14} />}
            {confirmText || 'Tasdiqlash'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInOverlay { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUpDialog { from { opacity:0; transform:scale(0.92) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}

/* ── Provider ─────────────────────────────────────────────────── */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false })
  const resolveRef = useRef(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setState({ open: true, ...opts })
    })
  }, [])

  const handleConfirm = () => {
    setState(s => ({ ...s, open: false }))
    resolveRef.current?.(true)
  }

  const handleCancel = () => {
    setState(s => ({ ...s, open: false }))
    resolveRef.current?.(false)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        danger={state.danger}
        icon={state.icon}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}
