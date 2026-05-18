import { useEffect, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
}

export function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium text-white ${type === 'success' ? 'bg-gray-900' : 'bg-red-500'}`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function Modal({
  children,
  onClose,
  maxWidth = 'max-w-md',
  zIndex = 'z-50',
}: {
  children: ReactNode
  onClose: () => void
  maxWidth?: string
  zIndex?: string
}) {
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  )
}
