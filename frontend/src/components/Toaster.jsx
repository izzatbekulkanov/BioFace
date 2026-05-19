/**
 * Toaster — global bildirishnoma tizimi.
 *
 * Foydalanish:
 *   1) <ToastProvider> ni App.jsx ga bir marta qo'shing
 *   2) Komponent ichida:
 *        const toast = useToast()
 *        toast.success("Saqlandi")
 *        toast.error("Xatolik yuz berdi")
 *        toast.info("Yangilanmoqda...")
 *        toast.warning("Diqqat")
 *   3) Toastlar o'ng-pastki burchakda chiqadi va avtomatik o'chadi.
 *
 * API:
 *   toast(message, opts)        // { type, duration, title, action }
 *   toast.success(msg, opts)
 *   toast.error(msg, opts)
 *   toast.warning(msg, opts)
 *   toast.info(msg, opts)
 *   toast.dismiss(id)
 *   toast.clear()
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import {
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  WarningRegular,
  InfoRegular,
  DismissRegular,
} from '@fluentui/react-icons'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let _id = 0
const nextId = () => ++_id

const TONES = {
  success: { color: '#10b981', bg: 'rgba(16,185,129,0.10)',  bd: 'rgba(16,185,129,0.35)',  Icon: CheckmarkCircleRegular },
  error:   { color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',   bd: 'rgba(244,63,94,0.35)',   Icon: ErrorCircleRegular },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  bd: 'rgba(245,158,11,0.35)',  Icon: WarningRegular },
  info:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  bd: 'rgba(59,130,246,0.35)',  Icon: InfoRegular },
}

export function ToastProvider({ children, max = 4 }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id))
    const handle = timersRef.current.get(id)
    if (handle) {
      clearTimeout(handle)
      timersRef.current.delete(id)
    }
  }, [])

  const clear = useCallback(() => {
    setToasts([])
    timersRef.current.forEach(h => clearTimeout(h))
    timersRef.current.clear()
  }, [])

  const push = useCallback((message, opts = {}) => {
    const type = opts.type || 'info'
    const duration = opts.duration ?? (type === 'error' ? 6000 : 3500)
    const id = nextId()
    const item = {
      id,
      message: typeof message === 'string' ? message : String(message),
      title: opts.title,
      type,
      action: opts.action,    // { label, onClick }
    }
    setToasts(list => {
      const next = [...list, item]
      // max'dan ortiqlarini eskidan o'chiramiz
      while (next.length > max) {
        const removed = next.shift()
        if (removed?.id != null) {
          const h = timersRef.current.get(removed.id)
          if (h) { clearTimeout(h); timersRef.current.delete(removed.id) }
        }
      }
      return next
    })
    if (duration > 0) {
      const handle = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, handle)
    }
    return id
  }, [dismiss, max])

  // Hook'ni callable function qilish — toast(...) va toast.success(...) ishlashi uchun
  const api = useCallback((message, opts) => push(message, opts), [push])
  api.success = useCallback((m, o = {}) => push(m, { ...o, type: 'success' }), [push])
  api.error   = useCallback((m, o = {}) => push(m, { ...o, type: 'error' }),   [push])
  api.warning = useCallback((m, o = {}) => push(m, { ...o, type: 'warning' }), [push])
  api.info    = useCallback((m, o = {}) => push(m, { ...o, type: 'info' }),    [push])
  api.dismiss = dismiss
  api.clear   = clear

  // tozalash
  useEffect(() => () => {
    timersRef.current.forEach(h => clearTimeout(h))
    timersRef.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <style>{`
        @keyframes bfToastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes bfToastOut {
          to { opacity: 0; transform: translateX(20px) scale(0.95); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 20, bottom: 20,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 10000,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 40px)',
      }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const tone = TONES[toast.type] || TONES.info
  const { Icon } = tone
  return (
    <div
      role="status"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      style={{
        pointerEvents: 'auto',
        minWidth: 280,
        maxWidth: 420,
        background: 'var(--surface)',
        border: `1px solid ${tone.bd}`,
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        padding: '12px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        animation: 'bfToastIn 0.18s cubic-bezier(0.34, 1.4, 0.64, 1)',
      }}
    >
      <div
        style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: tone.bg, color: tone.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon fontSize={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
            {toast.title}
          </div>
        )}
        <div style={{
          fontSize: 13, color: toast.title ? 'var(--text-3)' : 'var(--text-1)',
          lineHeight: 1.45, wordBreak: 'break-word',
        }}>
          {toast.message}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action.onClick?.(); onDismiss() }}
            style={{
              marginTop: 6, padding: '4px 8px', borderRadius: 6,
              background: 'transparent', border: 'none',
              color: tone.color, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss"
        style={{
          width: 24, height: 24, flexShrink: 0,
          background: 'transparent', border: 'none', borderRadius: 6,
          color: 'var(--text-4)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
      >
        <DismissRegular fontSize={13} />
      </button>
    </div>
  )
}
