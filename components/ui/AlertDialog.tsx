'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { X, AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react'

type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertOptions {
  title?: string
  type?: AlertType
}

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface AlertDialogConfig {
  open: boolean
  title: string
  message: string
  type: AlertType
  actions: Array<{
    label: string
    onClick: () => void
    variant: 'primary' | 'danger' | 'ghost'
  }>
}

interface AlertContextValue {
  alert: (message: string, options?: AlertOptions) => void
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

const AlertContext = createContext<AlertContextValue | null>(null)

const ICONS = {
  success: CheckCircle,
  error: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
} as const

const ICON_COLORS: Record<AlertType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
}

const DEFAULT_TITLE_KEY: Record<AlertType, string> = {
  success: 'alertDialog.success',
  error: 'alertDialog.error',
  warning: 'alertDialog.warning',
  info: 'alertDialog.info',
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used within AlertProvider')
  return ctx
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('b2b.common')
  const [config, setConfig] = useState<AlertDialogConfig>({
    open: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
  })
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback(() => {
    setConfig((prev) => ({ ...prev, open: false }))
  }, [])

  const alert = useCallback(
    (message: string, options?: AlertOptions) => {
      const type = options?.type || 'info'
      setConfig({
        open: true,
        title: options?.title || t(DEFAULT_TITLE_KEY[type]),
        message,
        type,
        actions: [
          {
            label: t('alertDialog.ok'),
            onClick: close,
            variant: 'primary',
          },
        ],
      })
    },
    [close, t]
  )

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        setConfig({
          open: true,
          title: options?.title || t('alertDialog.confirmTitle'),
          message,
          type: 'warning',
          actions: [
            {
              label: options?.cancelLabel || t('alertDialog.cancel'),
              onClick: () => {
                close()
                resolveRef.current?.(false)
                resolveRef.current = null
              },
              variant: 'ghost',
            },
            {
              label: options?.confirmLabel || t('alertDialog.confirm'),
              onClick: () => {
                close()
                resolveRef.current?.(true)
                resolveRef.current = null
              },
              variant: 'danger',
            },
          ],
        })
      })
    },
    [close, t]
  )

  const handleOverlayClick = useCallback(() => {
    if (config.actions.length === 1) {
      config.actions[0].onClick()
    }
  }, [config.actions])

  const Icon = ICONS[config.type]

  return (
    <AlertContext.Provider value={{ alert, confirm }}>
      {children}
      {config.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={handleOverlayClick}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 mt-0.5 ${ICON_COLORS[config.type]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
                  <button
                    onClick={close}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{config.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              {config.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={
                    action.variant === 'danger'
                      ? 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors'
                      : action.variant === 'ghost'
                        ? 'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors'
                        : 'px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors'
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}
