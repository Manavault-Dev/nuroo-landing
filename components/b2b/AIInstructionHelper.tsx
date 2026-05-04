'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Sparkles, Loader2, ChevronDown, ChevronUp, Check, RotateCcw } from 'lucide-react'
import { apiClient } from '@/lib/b2b/api'

export interface AIResult {
  title: string
  description: string
  instructions: string[]
  parentTip: string
  expectedResult: string
}

interface AIInstructionHelperProps {
  initialText?: string
  initialResult?: Partial<AIResult>
  context?: { title?: string; category?: string; ageMin?: number; ageMax?: number }
  onApply: (result: AIResult) => void
}

export function AIInstructionHelper({
  initialText = '',
  initialResult,
  context,
  onApply,
}: AIInstructionHelperProps) {
  const t = useTranslations('b2b.pages.assignments')
  const locale = useLocale()

  const [roughText, setRoughText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIResult | null>(
    initialResult
      ? {
          title: initialResult.title || '',
          description: initialResult.description || '',
          instructions: initialResult.instructions || [],
          parentTip: initialResult.parentTip || '',
          expectedResult: initialResult.expectedResult || '',
        }
      : null
  )
  const [expanded, setExpanded] = useState(true)
  const [applied, setApplied] = useState(false)

  // Editable fields within the result view
  const [editedTitle, setEditedTitle] = useState(initialResult?.title || '')
  const [editedDescription, setEditedDescription] = useState(initialResult?.description || '')
  const [editedInstructions, setEditedInstructions] = useState<string[]>(
    initialResult?.instructions || []
  )
  const [editedParentTip, setEditedParentTip] = useState(initialResult?.parentTip || '')
  const [editedExpectedResult, setEditedExpectedResult] = useState(
    initialResult?.expectedResult || ''
  )

  const language = locale === 'en' ? 'en' : locale === 'ky' ? 'ky' : 'ru'

  const handleImprove = async () => {
    if (!roughText.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(false)
    try {
      const res = await apiClient.improveInstruction({
        roughText: roughText.trim(),
        language,
        context,
      })
      setResult(res.result)
      setEditedTitle(res.result.title)
      setEditedDescription(res.result.description)
      setEditedInstructions(res.result.instructions)
      setEditedParentTip(res.result.parentTip)
      setEditedExpectedResult(res.result.expectedResult)
      setExpanded(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('aiHelperError'))
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    onApply({
      title: editedTitle.trim() || result.title,
      description: editedDescription.trim() || result.description,
      instructions: editedInstructions.filter((s) => s.trim()),
      parentTip: editedParentTip.trim(),
      expectedResult: editedExpectedResult.trim(),
    })
    setApplied(true)
  }

  const handleReset = () => {
    setResult(null)
    setApplied(false)
    setError(null)
    setEditedTitle('')
    setEditedDescription('')
    setEditedInstructions([])
    setEditedParentTip('')
    setEditedExpectedResult('')
  }

  return (
    <div className="border border-primary-200 rounded-xl bg-gradient-to-br from-primary-50/60 to-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-primary-100">
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-800">{t('aiHelperTitle')}</p>
          <p className="text-xs text-primary-500 leading-tight">{t('aiHelperSubtitle')}</p>
        </div>
        {result && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 text-primary-400 hover:text-primary-600 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {!result && (
          <>
            <textarea
              value={roughText}
              onChange={(e) => setRoughText(e.target.value)}
              placeholder={t('aiHelperPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none placeholder:text-gray-400"
            />
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="button"
              onClick={handleImprove}
              disabled={loading || !roughText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('aiHelperGenerating')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t('aiHelperGenerate')}</span>
                </>
              )}
            </button>
          </>
        )}

        {result && expanded && (
          <div className="space-y-3">
            {/* Editable title */}
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

            {/* Editable description */}
            <div className="bg-white rounded-lg border border-gray-100 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                {t('aiHelperResultDescription')}
              </p>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={3}
                className="w-full text-sm text-gray-700 leading-relaxed bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:ring-0 resize-none transition-colors px-0 py-0.5"
                placeholder={t('enterDescription')}
              />
            </div>

            {/* Editable instructions — one input per step */}
            <div className="bg-white rounded-lg border border-gray-100 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {t('aiHelperResultSteps')}
              </p>
              <ol className="space-y-2">
                {editedInstructions.map((step, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-1.5">
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

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleApply}
                disabled={applied}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${applied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
              >
                <Check className="w-4 h-4" />
                <span>{applied ? t('aiHelperApplied') : t('aiHelperApply')}</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title={t('aiHelperReset')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
