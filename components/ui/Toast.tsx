import type { ToastMsg } from '@/hooks/useToast'

const TOAST_COLORS: Record<string, string> = {
  error: 'bg-red-600',
  success: 'bg-green-600',
  warn: 'bg-yellow-500',
}

export function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${TOAST_COLORS[t.kind]} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-2 duration-200`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
