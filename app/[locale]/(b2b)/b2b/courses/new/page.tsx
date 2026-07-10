'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import { Select } from '@/components/ui/Select'
import { BookOpen, Loader2, ArrowLeft, Upload, Image as ImageIcon, X } from 'lucide-react'
import { Link } from '@/i18n/navigation'

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Только для организации' },
  { value: 'PUBLIC', label: 'Маркетплейс (публично)' },
]

const ACCESS_POLICY_OPTIONS = [
  { value: 'FREE', label: 'Бесплатно для всех' },
  { value: 'PAID', label: 'Платно для всех' },
  {
    value: 'VERIFIED_SPECIAL_NEEDS',
    label: 'Бесплатно для подтвержденных детей, остальные платят',
  },
  { value: 'INVITATION_ONLY', label: 'Только по приглашению' },
]

export default function NewCoursePage() {
  const router = useRouter()
  const { orgId, isAdmin, isLoading: authLoading } = usePageAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE')
  const [accessPolicy, setAccessPolicy] = useState<
    'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
  >('FREE')
  const [tags, setTags] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

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
        price: accessPolicy === 'FREE' ? 0 : parseFloat(price) || 0,
        visibility,
        accessPolicy,
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

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !orgId) return

    setUploadingCover(true)
    setError(null)

    try {
      const { url } = await apiClient.uploadCourseCoverImage(orgId, file)
      setCoverImageUrl(url)
    } catch (e: any) {
      setError(e.message || 'Ошибка при загрузке обложки')
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
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
            <Select
              value={visibility}
              onChange={(value) => setVisibility(value as 'PRIVATE' | 'PUBLIC')}
              options={VISIBILITY_OPTIONS}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Доступ</label>
          <Select
            value={accessPolicy}
            onChange={(value) =>
              setAccessPolicy(
                value as 'FREE' | 'PAID' | 'VERIFIED_SPECIAL_NEEDS' | 'INVITATION_ONLY'
              )
            }
            options={ACCESS_POLICY_OPTIONS}
          />
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
            Обложка курса (необязательно)
          </label>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            {coverImageUrl ? (
              <div className="relative aspect-[16/9] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl('')}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm hover:bg-white"
                  aria-label="Удалить обложку"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex aspect-[16/9] flex-col items-center justify-center gap-3 text-gray-400">
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm">Загрузите изображение или вставьте URL ниже</span>
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-gray-200 bg-white p-3 sm:flex-row">
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover || saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {uploadingCover ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadingCover ? 'Загрузка...' : 'Загрузить'}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
              />
            </div>
          </div>
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
            disabled={saving || uploadingCover}
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
