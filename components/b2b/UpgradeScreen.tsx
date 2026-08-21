'use client'

import { Lock } from 'lucide-react'
import { type BusinessFeature, FEATURE_LABELS } from '@/lib/b2b/planGate'

interface UpgradeScreenProps {
  feature: BusinessFeature
  upgradeHref?: string
  /** Compact banner mode for inline use */
  inline?: boolean
}

export function UpgradeScreen({
  feature,
  upgradeHref = '/b2b/billing',
  inline = false,
}: UpgradeScreenProps) {
  const { title, description } = FEATURE_LABELS[feature]

  if (inline) {
    return (
      <div className="flex items-center gap-4 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 truncate">{description}</p>
        </div>
        <a
          href={upgradeHref}
          className="flex-shrink-0 text-xs font-semibold text-purple-600 hover:text-purple-700 whitespace-nowrap"
        >
          Nuroo Business →
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-purple-400" />
      </div>

      <span className="inline-block text-xs font-bold uppercase tracking-wider text-purple-500 bg-purple-50 px-3 py-1 rounded-full mb-3">
        Nuroo Business
      </span>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 max-w-sm mb-8">{description}</p>

      <a
        href={upgradeHref}
        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors"
      >
        Попробовать Nuroo Business →
      </a>

      <p className="mt-4 text-xs text-gray-400">
        Включает все возможности Nuroo + инструменты для организации
      </p>
    </div>
  )
}
