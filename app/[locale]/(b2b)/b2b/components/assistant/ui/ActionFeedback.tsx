'use client'

import { CheckCircle, XCircle } from 'lucide-react'

interface ActionFeedbackProps {
  type: 'success' | 'error'
  message: string
}

export function ActionFeedback({ type, message }: ActionFeedbackProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm whitespace-pre-line border ${
        type === 'success'
          ? 'bg-green-50 text-green-800 border-green-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  )
}
