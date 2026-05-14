import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster, Toast, ToastBody, ToastTitle, useToastController } from '@fluentui/react-components'

const NotificationContext = createContext(null)
const TOASTER_ID = 'bioface-global-toaster'

function normalizeToastInput(input, fallbackIntent) {
  if (typeof input === 'string') {
    return { body: input, intent: fallbackIntent }
  }
  if (input && typeof input === 'object') {
    return { ...input, intent: input.intent || fallbackIntent }
  }
  return { intent: fallbackIntent }
}

export function useNotify() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotify must be used inside <NotificationProvider>')
  return ctx
}

export function NotificationProvider({ children }) {
  const { t } = useTranslation()
  const { dispatchToast, dismissToast, dismissAllToasts } = useToastController(TOASTER_ID)

  const defaultTitles = useMemo(() => ({
    info: t('toast.info'),
    success: t('toast.success'),
    warning: t('toast.warning'),
    error: t('toast.error'),
  }), [t])

  const show = useCallback((input = {}) => {
    const {
      title,
      body,
      intent = 'info',
      timeout,
      position = 'bottom-end',
      pauseOnHover = true,
      pauseOnWindowBlur = true,
    } = normalizeToastInput(input, 'info')

    dispatchToast(
      <Toast>
        <ToastTitle>{title || defaultTitles[intent] || defaultTitles.info}</ToastTitle>
        {body ? <ToastBody>{body}</ToastBody> : null}
      </Toast>,
      {
        intent,
        position,
        timeout: typeof timeout === 'number' ? timeout : (intent === 'error' ? 5200 : 3600),
        pauseOnHover,
        pauseOnWindowBlur,
      },
    )
  }, [defaultTitles, dispatchToast])

  const notify = useMemo(() => ({
    show,
    info: (input) => show(normalizeToastInput(input, 'info')),
    success: (input) => show(normalizeToastInput(input, 'success')),
    warning: (input) => show(normalizeToastInput(input, 'warning')),
    error: (input) => show(normalizeToastInput(input, 'error')),
    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
  }), [dismissAllToasts, dismissToast, show])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    window.bfNotify = notify
    return () => { delete window.bfNotify }
  }, [notify])

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Toaster
        toasterId={TOASTER_ID}
        position="bottom-end"
        pauseOnHover
        pauseOnWindowBlur
        offset={{ horizontal: 24, vertical: 20 }}
        limit={4}
      />
    </NotificationContext.Provider>
  )
}
