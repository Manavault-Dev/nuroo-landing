'use client'

import { useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'
import { ArrowLeft, ImagePlus, Loader2, BookOpen, X, Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface FormData {
  title: string
  description: string
  category: string
  format: 'online' | 'offline'
  targetAudience: 'children' | 'parents' | 'specialists' | 'all'
  startDate: string
  endDate: string
  price: string
  currency: string
  maxParticipants: string
  ageMin: string
  ageMax: string
  scheduleType: 'manual' | 'recurring'
  // Recurring template
  weekdays: number[]
  recStartTime: string
  recEndTime: string
  repeatUntil: string
}

const WEEKDAYS = [
  { n: 1, short: 'Пн' },
  { n: 2, short: 'Вт' },
  { n: 3, short: 'Ср' },
  { n: 4, short: 'Чт' },
  { n: 5, short: 'Пт' },
  { n: 6, short: 'Сб' },
  { n: 0, short: 'Вс' },
]

export default function NewCohortPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId') ?? ''
  const router = useRouter()
  const { isAdmin, isSpecialist, isLoading: authLoading } = usePageAuth()

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    format: 'offline',
    targetAudience: 'children',
    startDate: '',
    endDate: '',
    price: '0',
    currency: 'KGS',
    maxParticipants: '20',
    ageMin: '',
    ageMax: '',
    scheduleType: 'manual',
    weekdays: [1, 3, 5],
    recStartTime: '09:00',
    recEndTime: '10:00',
    repeatUntil: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Только изображения: JPG, PNG, WebP')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 8 МБ')
      return
    }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const removeCover = () => {
    setCoverFile(null)
    setCoverPreview(null)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const set =
    (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const toggleWeekday = (n: number) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(n)
        ? prev.weekdays.filter((d) => d !== n)
        : [...prev.weekdays, n],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setError(null)
    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || null,
        format: form.format,
        targetAudience: form.targetAudience,
        startDate: form.startDate,
        endDate: form.endDate,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        maxParticipants: parseInt(form.maxParticipants) || 20,
        ageMin: form.ageMin ? parseInt(form.ageMin) : null,
        ageMax: form.ageMax ? parseInt(form.ageMax) : null,
        scheduleType: form.scheduleType,
      }

      if (form.scheduleType === 'recurring') {
        if (form.weekdays.length === 0) {
          setError('Выберите хотя бы один день недели')
          setSaving(false)
          return
        }
        if (!form.repeatUntil) {
          setError('Укажите дату окончания расписания')
          setSaving(false)
          return
        }
        body.recurringTemplate = {
          weekdays: form.weekdays,
          startTime: form.recStartTime,
          endTime: form.recEndTime,
          repeatUntil: form.repeatUntil,
        }
      }

      const res = await apiClient.createCohort(orgId, body)
      const cohortId = res.cohort.id

      // Upload cover image if selected
      if (coverFile) {
        try {
          await apiClient.uploadCohortCover(orgId, cohortId, coverFile)
        } catch {
          // Non-fatal: cohort created, cover failed — redirect anyway
        }
      }

      router.push(`/b2b/courses/${cohortId}?orgId=${orgId}`)
    } catch (e: any) {
      setError(e.message || 'Не удалось создать группу')
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!isAdmin && !isSpecialist) {
    return (
      <div className="p-6 text-center text-gray-500">
        Только администраторы и специалисты могут создавать группы
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Все группы
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Новая группа (курс)</h1>
          <p className="text-sm text-gray-500">Создайте группу для записи детей</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover image */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Обложка группы
          </h2>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
          {coverPreview ? (
            <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverPreview} alt="Обложка" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg shadow text-xs font-medium text-gray-700 transition-colors"
              >
                Заменить
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
            >
              <ImagePlus className="w-7 h-7" />
              <span className="text-sm">Добавить обложку</span>
              <span className="text-xs">JPG, PNG, WebP — до 8 МБ</span>
            </button>
          )}
        </div>

        {/* Basic info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Основная информация
          </h2>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Название группы *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={set('title')}
              placeholder="Логопедия — группа A, осень 2025"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Описание</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Краткое описание для родителей..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Категория</label>
              <input
                type="text"
                value={form.category}
                onChange={set('category')}
                placeholder="Логопедия, АВА, ..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Формат</label>
              <select
                value={form.format}
                onChange={set('format')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="offline">Офлайн</option>
                <option value="online">Онлайн</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Для кого</label>
              <select
                value={form.targetAudience}
                onChange={set('targetAudience')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="children">Дети</option>
                <option value="parents">Родители</option>
                <option value="specialists">Специалисты</option>
                <option value="all">Все</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Возраст от</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.ageMin}
                onChange={set('ageMin')}
                placeholder="3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">до</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.ageMax}
                onChange={set('ageMax')}
                placeholder="7"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Dates & Capacity */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Сроки и вместимость
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Дата начала *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={set('startDate')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Дата окончания *
              </label>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={set('endDate')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Макс. участников
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={form.maxParticipants}
                onChange={set('maxParticipants')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Стоимость ({form.currency})
              </label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={set('price')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Расписание
          </h2>

          <div className="flex gap-3">
            {(['manual', 'recurring'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({ ...f, scheduleType: type }))}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
                  form.scheduleType === type
                    ? 'bg-primary-50 border-primary-400 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {type === 'manual' ? 'Вручную' : 'По расписанию'}
              </button>
            ))}
          </div>

          {form.scheduleType === 'manual' && (
            <p className="text-sm text-gray-500">
              Занятия добавляете по одному после создания группы.
            </p>
          )}

          {form.scheduleType === 'recurring' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Дни недели</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map(({ n, short }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleWeekday(n)}
                      className={`w-11 h-11 rounded-xl text-sm font-semibold border transition-colors ${
                        form.weekdays.includes(n)
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-primary-300'
                      }`}
                    >
                      {short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Начало</label>
                  <input
                    type="time"
                    value={form.recStartTime}
                    onChange={set('recStartTime')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Конец</label>
                  <input
                    type="time"
                    value={form.recEndTime}
                    onChange={set('recEndTime')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Создавать занятия до
                </label>
                <input
                  type="date"
                  value={form.repeatUntil}
                  onChange={set('repeatUntil')}
                  min={form.startDate || undefined}
                  max={form.endDate || undefined}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Система автоматически создаст занятия по выбранным дням
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/b2b/courses${orgId ? `?orgId=${orgId}` : ''}`}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 text-center transition-colors"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать группу
          </button>
        </div>
      </form>
    </div>
  )
}
