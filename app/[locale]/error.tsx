'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to Sentry or console in production
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">😔</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Что-то пошло не так</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Мы уже знаем о проблеме и работаем над её устранением.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs text-gray-400">ID: {error.digest}</span>
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  )
}
