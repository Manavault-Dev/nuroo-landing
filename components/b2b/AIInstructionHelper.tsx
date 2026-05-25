'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { apiClient } from '@/lib/b2b/api'

// ── Constants ──────────────────────────────────────────────────────────────────

const AI_CHAR_LIMIT = 600
const AI_CHAR_WARN = 480 // 80% — start showing amber

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AIResult {
  title: string
  description: string
  instructions: string[]
  parentTip: string
  expectedResult: string
}

type PanelState = 'closed' | 'input' | 'loading' | 'result'

interface AIInstructionHelperProps {
  initialText?: string
  initialResult?: Partial<AIResult>
  context?: { title?: string; category?: string; ageMin?: number; ageMax?: number }
  onApply: (result: AIResult) => void
}

// ── Loading dots animation ─────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AIInstructionHelper({
  initialText = '',
  initialResult,
  context,
  onApply,
}: AIInstructionHelperProps) {
  const t = useTranslations('b2b.pages.assignments')
  const locale = useLocale()
  const language = locale === 'en' ? 'en' : locale === 'ky' ? 'ky' : 'ru'

  const [panelState, setPanelState] = useState<PanelState>(
    initialResult?.title ? 'result' : 'closed'
  )
  const [roughText, setRoughText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [resultExpanded, setResultExpanded] = useState(true)
  const [applied, setApplied] = useState(false)

  // Editable result fields
  const [editedTitle, setEditedTitle] = useState(initialResult?.title || '')
  const [editedDescription, setEditedDescription] = useState(initialResult?.description || '')
  const [editedInstructions, setEditedInstructions] = useState<string[]>(
    initialResult?.instructions || []
  )
  const [editedParentTip, setEditedParentTip] = useState(initialResult?.parentTip || '')
  const [editedExpectedResult, setEditedExpectedResult] = useState(
    initialResult?.expectedResult || ''
  )

  // ── Char counter state ─────────────────────────────────────────────────────
  const charCount = roughText.length
  const isOverLimit = charCount > AI_CHAR_LIMIT
  const isNearLimit = charCount >= AI_CHAR_WARN
  const charCountColor = isOverLimit
    ? 'text-red-600 font-semibold'
    : isNearLimit
      ? 'text-amber-600'
      : 'text-gray-400'

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpen = () => {
    setError(null)
    setPanelState('input')
  }

  const handleClose = () => {
    setPanelState('closed')
    setError(null)
  }

  const handleGenerate = async () => {
    const trimmed = roughText.trim()

    // Client-side validation — clear errors before API call
    if (!trimmed) {
      setError(t('aiValidationEmpty'))
      return
    }
    if (trimmed.length < 10) {
      setError(t('aiValidationTooShort'))
      return
    }
    if (charCount > AI_CHAR_LIMIT) {
      setError(t('aiValidationTooLong', { max: AI_CHAR_LIMIT }))
      return
    }

    setError(null)
    setPanelState('loading')

    try {
      const res = await apiClient.improveInstruction({
        roughText: trimmed,
        language,
        context,
      })

      const r = res.result
      setEditedTitle(r.title)
      setEditedDescription(r.description)
      setEditedInstructions(r.instructions)
      setEditedParentTip(r.parentTip)
      setEditedExpectedResult(r.expectedResult)
      setApplied(false)
      setResultExpanded(true)
      setPanelState('result')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('aiHelperError')
      setError(msg)
      setPanelState('input')
    }
  }

  const handleApply = () => {
    onApply({
      title: editedTitle.trim(),
      description: editedDescription.trim(),
      instructions: editedInstructions.filter((s) => s.trim()),
      parentTip: editedParentTip.trim(),
      expectedResult: editedExpectedResult.trim(),
    })
    setApplied(true)
    // Collapse panel after apply so user sees the filled-in manual form
    setTimeout(() => setPanelState('closed'), 600)
  }

  const handleReset = () => {
    setApplied(false)
    setError(null)
    setResultExpanded(true)
    setPanelState('input')
  }

  const handleRetry = () => {
    setError(null)
    handleGenerate()
  }

  // ── Closed state — just a button ──────────────────────────────────────────

  if (panelState === 'closed') {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4 text-primary-500" />
        {t('aiAssistButton')}
      </button>
    )
  }

  // ── Shared panel wrapper ────────────────────────────────────────────────────

  return (
    <div className="border border-primary-200 rounded-xl bg-gradient-to-br from-primary-50/40 to-white overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-primary-100">
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-800">{t('aiHelperTitle')}</p>
          <p className="text-xs text-primary-500 leading-tight">{t('aiHelperSubtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          {panelState === 'result' && (
            <button
              type="button"
              onClick={() => setResultExpanded((v) => !v)}
              className="p-1 text-primary-400 hover:text-primary-600 transition-colors"
              aria-label="Toggle result"
            >
              {resultExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          {panelState !== 'loading' && (
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={t('aiHelperClose')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── INPUT STATE ─────────────────────────────────────────────────────── */}
      {panelState === 'input' && (
        <div className="px-4 py-4 space-y-3">
          {/* Guidance hint */}
          <div className="flex gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">{t('aiInputHint')}</p>
          </div>

          {/* Textarea + counter */}
          <div className="relative">
            <textarea
              value={roughText}
              onChange={(e) => {
                setRoughText(e.target.value)
                if (error) setError(null)
              }}
              placeholder={t('aiInputPlaceholder')}
              rows={4}
              maxLength={AI_CHAR_LIMIT + 50} // allow slight over so they see the counter turn red
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none placeholder:text-gray-400 transition-colors ${
                isOverLimit ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
              }`}
            />
            {/* Character counter */}
            <div className={`text-right text-xs mt-1 tabular-nums ${charCountColor}`}>
              {charCount} / {AI_CHAR_LIMIT}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1 leading-relaxed">{error}</p>
              {/* Retry if it was a network/API error (not a validation error) */}
              {!error.includes('символов') &&
                !error.includes('characters') &&
                !error.includes('words') && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2 whitespace-nowrap"
                  >
                    {t('aiRetry')}
                  </button>
                )}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!roughText.trim() || isOverLimit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {t('aiHelperGenerate')}
          </button>
        </div>
      )}

      {/* ── LOADING STATE ───────────────────────────────────────────────────── */}
      {panelState === 'loading' && (
        <div className="px-4 py-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">{t('aiGenerating')}</p>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
              {t('aiGeneratingHint')} <LoadingDots />
            </p>
          </div>
          <p className="text-[11px] text-gray-400 max-w-xs">{t('aiGeneratingNote')}</p>
        </div>
      )}

      {/* ── RESULT STATE ────────────────────────────────────────────────────── */}
      {panelState === 'result' && (
        <div className="px-4 py-4 space-y-3">
          {/* Success banner */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-700 flex-1">{t('aiResultReady')}</p>
          </div>

          {resultExpanded && (
            <div className="space-y-3">
              {/* Title */}
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {t('aiHelperResultTitle')}
                </p>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:ring-0 transition-colors px-0 py-0.5"
                  placeholder={t('enterTaskTitle')}
                />
              </div>

              {/* Description */}
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {t('aiHelperResultDescription')}
                </p>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm text-gray-700 leading-relaxed bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:ring-0 resize-none transition-colors px-0 py-0.5"
                  placeholder={t('enterDescription')}
                />
              </div>

              {/* Steps */}
              {editedInstructions.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {t('aiHelperResultSteps')} ({editedInstructions.length})
                  </p>
                  <ol className="space-y-2">
                    {editedInstructions.map((step, i) => (
                      <li key={i} className="flex gap-2.5 items-start">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-1">
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => {
                            const next = [...editedInstructions]
                            next[i] = e.target.value
                            setEditedInstructions(next)
                          }}
                          className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:ring-2 focus:ring-primary-400 focus:border-transparent focus:outline-none"
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Parent tip */}
              {editedParentTip && (
                <div className="bg-amber-50 rounded-lg border border-amber-100 p-3">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
                    {t('aiHelperResultParentTip')}
                  </p>
                  <textarea
                    value={editedParentTip}
                    onChange={(e) => setEditedParentTip(e.target.value)}
                    rows={2}
                    className="w-full text-sm text-amber-800 leading-relaxed bg-amber-50/80 border border-amber-200 rounded-md px-2 py-1 focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Expected result */}
              {editedExpectedResult && (
                <div className="bg-green-50 rounded-lg border border-green-100 p-3">
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1.5">
                    {t('aiHelperResultExpected')}
                  </p>
                  <textarea
                    value={editedExpectedResult}
                    onChange={(e) => setEditedExpectedResult(e.target.value)}
                    rows={2}
                    className="w-full text-sm text-green-800 leading-relaxed bg-green-50/80 border border-green-200 rounded-md px-2 py-1 focus:ring-2 focus:ring-green-400 focus:border-transparent focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applied}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    applied
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {applied ? t('aiHelperApplied') : t('aiHelperApply')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  title={t('aiHelperReset')}
                  className="px-3 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('aiRetry')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
