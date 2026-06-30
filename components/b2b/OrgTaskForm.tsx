'use client'

import { useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import { AIInstructionHelper } from './AIInstructionHelper'

interface Props {
  formData: Record<string, unknown>
  mediaFile: File | null
  onFieldChange: (field: string, value: unknown) => void
  onMediaFileChange: (file: File | null) => void
}

export function OrgTaskForm({ formData, mediaFile, onFieldChange, onMediaFileChange }: Props) {
  const t = useTranslations('b2b.pages.assignments')

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('taskTitle')} *</label>
          <input
            type="text"
            value={(formData.title as string) || ''}
            onChange={(e) => onFieldChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={t('enterTaskTitle')}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('taskDescription')}
          </label>
          <textarea
            value={(formData.description as string) || ''}
            onChange={(e) => onFieldChange('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={t('enterDescription')}
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-gray-500">{t('aiAssistOptional')}</p>
        <AIInstructionHelper
          context={{
            title: (formData.title as string) || undefined,
            category: (formData.category as string) || undefined,
            ageMin: (formData.ageRange as { min: number; max: number } | undefined)?.min,
            ageMax: (formData.ageRange as { min: number; max: number } | undefined)?.max,
          }}
          onApply={(result) => {
            if (result.title) onFieldChange('title', result.title)
            if (result.description) onFieldChange('description', result.description)
            if (result.instructions?.length) onFieldChange('instructions', result.instructions)
            if (result.parentTip) onFieldChange('parentTip', result.parentTip)
            if (result.expectedResult) onFieldChange('expectedResult', result.expectedResult)
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('instructions')}
          {((formData.instructions as string[]) || []).length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({((formData.instructions as string[]) || []).length})
            </span>
          )}
        </label>
        <div className="space-y-2">
          {(((formData.instructions as string[]) || []).length > 0
            ? (formData.instructions as string[])
            : ['']
          ).map((step: string, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-2">
                {i + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={(e) => {
                  const steps = [...((formData.instructions as string[]) || [])]
                  if (steps.length === 0) steps.push('')
                  steps[i] = e.target.value
                  onFieldChange('instructions', steps)
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('instructionStepPlaceholder', { num: i + 1 })}
              />
              <button
                type="button"
                onClick={() => {
                  const steps = ((formData.instructions as string[]) || []).filter(
                    (_: string, idx: number) => idx !== i
                  )
                  onFieldChange('instructions', steps)
                }}
                className="mt-2 p-1 text-gray-300 hover:text-red-400 transition-colors"
                title={t('remove')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const steps = [...((formData.instructions as string[]) || []), '']
            onFieldChange('instructions', steps)
          }}
          className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('addStep')}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('parentTip')}</label>
        <textarea
          value={(formData.parentTip as string) || ''}
          onChange={(e) => onFieldChange('parentTip', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-amber-200 bg-amber-50/40 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
          placeholder={t('parentTipPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('expectedResult')}
        </label>
        <textarea
          value={(formData.expectedResult as string) || ''}
          onChange={(e) => onFieldChange('expectedResult', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-green-200 bg-green-50/40 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent placeholder:text-gray-400"
          placeholder={t('expectedResultPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('category')}</label>
        <input
          type="text"
          value={(formData.category as string) || ''}
          onChange={(e) => onFieldChange('category', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder={t('enterCategory')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('difficulty')}</label>
        <select
          value={(formData.difficulty as string) || ''}
          onChange={(e) => onFieldChange('difficulty', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">{t('selectDifficulty')}</option>
          <option value="easy">{t('difficultyEasy')}</option>
          <option value="medium">{t('difficultyMedium')}</option>
          <option value="hard">{t('difficultyHard')}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('estimatedDuration')}
        </label>
        <input
          type="number"
          value={(formData.estimatedDuration as number) || ''}
          onChange={(e) =>
            onFieldChange('estimatedDuration', parseInt(e.target.value) || undefined)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder={t('enterDuration')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('videoUrl')}</label>
        <input
          type="url"
          value={(formData.videoUrl as string) || ''}
          onChange={(e) => onFieldChange('videoUrl', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('imageUrl')}</label>
        <input
          type="url"
          value={(formData.imageUrl as string) || ''}
          onChange={(e) => onFieldChange('imageUrl', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('uploadMediaFile')}
        </label>
        <input
          type="file"
          accept="video/*,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onMediaFileChange(file)
              if (!formData.title) onFieldChange('title', file.name.replace(/\.[^/.]+$/, ''))
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {mediaFile && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
            <button
              type="button"
              onClick={() => onMediaFileChange(null)}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              {t('remove')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
