'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import { BookOpen, Loader2, ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default function NewCoursePage() {
  const router = useRouter()
  const { orgId, isAdmin } = usePageAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [visibility, setVisibility] = useState<'org_only' | 'marketplace'>('org_only')
  const [tags, setTags] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        Только администраторы могут создавать курсы.
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setSaving(true)
    setError(null)

    try {
      const res = await apiClient.createCourse(orgId, {
        title,
        description,
        price: parseFloat(price) || 0,
        visibility,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        coverImageUrl: coverImageUrl || undefined,
        ageRange: ageRange || undefined,
      })
      router.push(`/b2b/courses/${res.course.id}?orgId=${orgId}`)
    } catch (e: any) {
      setError(e.message || 'Ошибка при создании курса')
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <BookOpen className="w-5 h-5 text-primary-600" />
        <h1 className="text-xl font-bold text-gray-900">Новый курс</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-100 p-6 space-y-5"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Развитие речи для детей 3–5 лет"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Описание <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Что узнает родитель из этого курса? Что получит ребёнок?"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Цена (KGS)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-xs text-gray-400 mt-1">0 = бесплатно</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Видимость</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'org_only' | 'marketplace')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="org_only">Только для организации</option>
              <option value="marketplace">Маркетплейс (публично)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Возраст детей</label>
          <input
            type="text"
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            placeholder="Например: 3–7 лет"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Теги (через запятую)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="речь, аутизм, моторика"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL обложки (необязательно)
          </label>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Создать курс
          </button>
        </div>
      </form>
    </div>
  )
}
