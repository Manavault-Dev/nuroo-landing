'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useParams, useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import {
  apiClient,
  type ChildDetail,
  type SpecialistNote,
  type TimelineResponse,
  type ChildTask,
  type Guardian,
  type ChildProfileData,
  type ActivityEvent,
} from '@/lib/b2b/api'
import { useAlert } from '@/components/ui/AlertDialog'
import {
  Send,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Smile,
  Meh,
  Frown,
  User,
  Mail,
  Link2,
  Phone,
  MessageCircle,
  Shield,
  Star,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  FileText,
  Users,
  BarChart2,
  X,
  Info,
  Save,
} from 'lucide-react'

type Tab = 'overview' | 'info' | 'guardians' | 'progress' | 'notes' | 'timeline'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-600',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Мужской',
  female: 'Женский',
  other: 'Другой',
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  mother: 'Мама',
  father: 'Папа',
  guardian: 'Опекун',
  other: 'Другое',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  paused: 'На паузе',
  completed: 'Завершён',
  archived: 'В архиве',
}

// ─── InfoTab component ────────────────────────────────────────────────────────
function InfoTab({
  profile,
  orgId,
  childId,
  onSaved,
}: {
  profile: Partial<ChildProfileData> | null
  orgId: string
  childId: string
  onSaved: (data: Partial<ChildProfileData>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Partial<ChildProfileData>>(profile || {})

  const inp =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'
  const ta = `${inp} resize-none`
  const lbl = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
  const val = (v: string | null | undefined) => v || <span className="text-gray-400 italic">—</span>

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await apiClient.updateChildProfile(orgId, childId, form)
      onSaved(form)
      setEditing(false)
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Информация о ребёнке
        </h2>
        {!editing ? (
          <button
            onClick={() => {
              setForm(profile || {})
              setEditing(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Редактировать
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Основная информация */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">
          Основная информация
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {editing ? (
            <>
              <div>
                <label className={lbl}>Имя</label>
                <input
                  className={inp}
                  value={form.firstName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Фамилия</label>
                <input
                  className={inp}
                  value={form.lastName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Дата рождения</label>
                <input
                  type="date"
                  className={inp}
                  value={form.dateOfBirth || ''}
                  onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Пол</label>
                <select
                  className={inp}
                  value={form.gender || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      gender: e.target.value as 'male' | 'female' | 'other',
                    }))
                  }
                >
                  <option value="">—</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Другой</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Внутренний код</label>
                <input
                  className={inp}
                  value={form.internalCode || ''}
                  onChange={(e) => setForm((p) => ({ ...p, internalCode: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Статус</label>
                <select
                  className={inp}
                  value={form.status || 'active'}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value as ChildProfileData['status'] }))
                  }
                >
                  <option value="active">Активен</option>
                  <option value="paused">На паузе</option>
                  <option value="completed">Завершён</option>
                  <option value="archived">В архиве</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Дата начала</label>
                <input
                  type="date"
                  className={inp}
                  value={form.startDate || ''}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={lbl}>Имя</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.firstName)}
                </p>
              </div>
              <div>
                <p className={lbl}>Фамилия</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">{val(profile?.lastName)}</p>
              </div>
              <div>
                <p className={lbl}>Дата рождения</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.dateOfBirth)}
                </p>
              </div>
              <div>
                <p className={lbl}>Пол</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {profile?.gender ? (
                    GENDER_LABELS[profile.gender]
                  ) : (
                    <span className="text-gray-400 italic">—</span>
                  )}
                </p>
              </div>
              <div>
                <p className={lbl}>Внутренний код</p>
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {val(profile?.internalCode)}
                </p>
              </div>
              <div>
                <p className={lbl}>Статус</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[profile?.status || 'active']}`}
                >
                  {STATUS_LABELS[profile?.status || 'active']}
                </span>
              </div>
              <div>
                <p className={lbl}>Дата начала</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.startDate)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Клиническая информация */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">
          Клиническая информация
        </h3>
        <div className="space-y-3">
          {editing ? (
            <>
              <div>
                <label className={lbl}>Основная проблема</label>
                <input
                  className={inp}
                  value={form.primaryConcern || ''}
                  onChange={(e) => setForm((p) => ({ ...p, primaryConcern: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Диагноз</label>
                <input
                  className={inp}
                  value={form.diagnosis || ''}
                  onChange={(e) => setForm((p) => ({ ...p, diagnosis: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Уровень коммуникации</label>
                <input
                  className={inp}
                  value={form.communicationLevel || ''}
                  onChange={(e) => setForm((p) => ({ ...p, communicationLevel: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Цели терапии</label>
                <textarea
                  rows={3}
                  className={ta}
                  value={form.therapyGoals || ''}
                  onChange={(e) => setForm((p) => ({ ...p, therapyGoals: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Заметки о развитии</label>
                <textarea
                  rows={3}
                  className={ta}
                  value={form.developmentalNotes || ''}
                  onChange={(e) => setForm((p) => ({ ...p, developmentalNotes: e.target.value }))}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={lbl}>Основная проблема</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.primaryConcern)}
                </p>
              </div>
              <div>
                <p className={lbl}>Диагноз</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.diagnosis)}
                </p>
              </div>
              <div>
                <p className={lbl}>Уровень коммуникации</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {val(profile?.communicationLevel)}
                </p>
              </div>
              <div>
                <p className={lbl}>Цели терапии</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {val(profile?.therapyGoals)}
                </p>
              </div>
              <div>
                <p className={lbl}>Заметки о развитии</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {val(profile?.developmentalNotes)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Дополнительно */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">
          Дополнительно
        </h3>
        <div className="space-y-3">
          {editing ? (
            <>
              <div>
                <label className={lbl}>Противопоказания</label>
                <textarea
                  rows={2}
                  className={ta}
                  value={form.contraindications || ''}
                  onChange={(e) => setForm((p) => ({ ...p, contraindications: e.target.value }))}
                />
              </div>
              <div>
                <label className={lbl}>Важные заметки</label>
                <textarea
                  rows={2}
                  className={ta}
                  value={form.importantNotes || ''}
                  onChange={(e) => setForm((p) => ({ ...p, importantNotes: e.target.value }))}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={lbl}>Противопоказания</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {val(profile?.contraindications)}
                </p>
              </div>
              <div>
                <p className={lbl}>Важные заметки</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {val(profile?.importantNotes)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChildDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const childId = params.childId as string
  const orgId = searchParams.get('orgId') || 'default-org'

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [childDetail, setChildDetail] = useState<ChildDetail | null>(null)
  const [profile, setProfile] = useState<Partial<ChildProfileData> | null>(null)
  const [notes, setNotes] = useState<SpecialistNote[]>([])
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [tasks, setTasks] = useState<ChildTask[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { confirm } = useAlert()

  const [noteContent, setNoteContent] = useState('')
  const [visibleToParent, setVisibleToParent] = useState(true)
  const [submittingNote, setSubmittingNote] = useState(false)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<Partial<ChildProfileData>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [showAddGuardian, setShowAddGuardian] = useState(false)
  const [guardianForm, setGuardianForm] = useState({
    fullName: '',
    relationship: 'mother' as Guardian['relationship'],
    phone: '',
    whatsapp: '',
    email: '',
    preferredContactMethod: 'phone' as Guardian['preferredContactMethod'],
    isPrimaryContact: false,
    isEmergencyContact: false,
  })
  const [savingGuardian, setSavingGuardian] = useState(false)
  const [deletingGuardianId, setDeletingGuardianId] = useState<string | null>(null)

  const t = useTranslations('b2b.pages.childDetail')
  const locale = useLocale()
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : 'en-US'

  const ensureToken = async () => {
    const idToken = await getIdToken()
    if (!idToken) {
      router.push('/b2b/login')
      return null
    }
    apiClient.setToken(idToken)
    return idToken
  }

  useEffect(() => {
    const load = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }
      if (!(await ensureToken())) return

      try {
        const [detailData, notesData, timelineData, tasksRes, guardiansRes, eventsRes, profileRes] =
          await Promise.all([
            apiClient.getChildDetail(orgId, childId),
            apiClient.getNotes(orgId, childId),
            apiClient.getTimeline(orgId, childId, 30),
            apiClient.getChildTasks(orgId, childId),
            apiClient.getGuardians(orgId, childId).catch(() => ({ guardians: [] })),
            apiClient.getActivityEvents(orgId, childId).catch(() => ({ events: [] })),
            apiClient.getChildProfile(orgId, childId).catch(() => ({ profile: {} })),
          ])

        setChildDetail(detailData)
        setNotes(notesData)
        setTimeline(timelineData)
        setTasks(tasksRes.tasks)
        setGuardians(guardiansRes.guardians)
        setActivityEvents(eventsRes.events)
        setProfile(profileRes.profile)
        setProfileDraft(profileRes.profile)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [childId, orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    setSubmittingNote(true)
    setError('')
    try {
      if (!(await ensureToken())) return
      await apiClient.createNote(orgId, childId, noteContent.trim(), undefined, visibleToParent)
      setNotes(await apiClient.getNotes(orgId, childId))
      setNoteContent('')
      setVisibleToParent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('failedToSaveNote'))
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setSubmittingTask(true)
    setError('')
    try {
      if (!(await ensureToken())) return
      await apiClient.createChildTask(orgId, childId, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
      })
      const [updatedDetail, tasksRes] = await Promise.all([
        apiClient.getChildDetail(orgId, childId),
        apiClient.getChildTasks(orgId, childId),
      ])
      setChildDetail(updatedDetail)
      setTasks(tasksRes.tasks)
      setTaskTitle('')
      setTaskDescription('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('failedToCreateTask'))
    } finally {
      setSubmittingTask(false)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      if (!(await ensureToken())) return
      await apiClient.updateChildProfile(orgId, childId, profileDraft)
      setProfile({ ...profile, ...profileDraft })
      setEditingProfile(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAddGuardian = async (e: FormEvent) => {
    e.preventDefault()
    setSavingGuardian(true)
    try {
      if (!(await ensureToken())) return
      await apiClient.createGuardian(orgId, childId, {
        ...guardianForm,
        phone: guardianForm.phone || undefined,
        whatsapp: guardianForm.whatsapp || undefined,
        email: guardianForm.email || undefined,
      })
      setGuardians((await apiClient.getGuardians(orgId, childId)).guardians)
      setShowAddGuardian(false)
      setGuardianForm({
        fullName: '',
        relationship: 'mother',
        phone: '',
        whatsapp: '',
        email: '',
        preferredContactMethod: 'phone',
        isPrimaryContact: false,
        isEmergencyContact: false,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add guardian')
    } finally {
      setSavingGuardian(false)
    }
  }

  const handleDeleteGuardian = async (guardianId: string) => {
    const ok = await confirm('Remove this guardian?')
    if (!ok) return
    setDeletingGuardianId(guardianId)
    try {
      if (!(await ensureToken())) return
      await apiClient.deleteGuardian(orgId, childId, guardianId)
      setGuardians((g) => g.filter((x) => x.id !== guardianId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete guardian')
    } finally {
      setDeletingGuardianId(null)
    }
  }

  const fmtShort = (d: string | Date) => new Date(d).toLocaleDateString(dateLocale)
  const fmtRelative = (d: string | Date) => {
    const date = new Date(d)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return t('today')
    if (date.toDateString() === yesterday.toDateString()) return t('yesterday')
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
  }

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
          <p className="mt-4 text-gray-600">{t('loadingProfile')}</p>
        </div>
      </div>
    )

  if (!childDetail)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('notFoundTitle')}</h3>
          <p className="text-gray-600 mb-4">{error || t('notFoundDescription')}</p>
          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {t('backToChildren')}
          </Link>
        </div>
      </div>
    )

  const status = (profile?.status || childDetail.status || 'active') as string
  const profileStatusLabel =
    status === 'active'
      ? t('statusActive')
      : status === 'paused'
        ? t('statusPaused')
        : status === 'archived'
          ? t('statusArchived')
          : t('statusCompleted')
  const fullName = childDetail.name
  const initials = fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('tabOverview'), icon: <User className="w-4 h-4" /> },
    { id: 'info', label: 'Информация', icon: <Info className="w-4 h-4" /> },
    {
      id: 'guardians',
      label: `${t('tabGuardians')} (${guardians.length})`,
      icon: <Users className="w-4 h-4" />,
    },
    { id: 'progress', label: t('tabProgress'), icon: <BarChart2 className="w-4 h-4" /> },
    {
      id: 'notes',
      label: `${t('tabNotes')} (${notes.length})`,
      icon: <FileText className="w-4 h-4" />,
    },
    { id: 'timeline', label: t('tabTimeline'), icon: <Activity className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/b2b/children?orgId=${orgId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          {t('backToChildren')}
        </Link>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold flex-shrink-0">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={fullName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.active}`}
                >
                  {profileStatusLabel}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                {childDetail.age && <span>{t('ageLabel', { age: childDetail.age })}</span>}
                {childDetail.assignedSpecialistName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {childDetail.assignedSpecialistName}
                  </span>
                )}
                {childDetail.groupName && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {childDetail.groupName}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div className="text-2xl font-bold text-gray-900">
                {childDetail.completedTasksCount}
              </div>
              <div>{t('tasksCompleted')}</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* ── Quick stats ───────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Задач выполнено',
                    value: childDetail.completedTasksCount,
                    color: 'text-primary-600',
                    bg: 'bg-primary-50',
                  },
                  {
                    label: 'Возраст',
                    value: childDetail.age ? `${childDetail.age} лет` : '—',
                    color: 'text-gray-700',
                    bg: 'bg-gray-50',
                  },
                  {
                    label: 'Статус',
                    value: STATUS_LABELS[profile?.status || 'active'] || '—',
                    color: 'text-green-600',
                    bg: 'bg-green-50',
                  },
                  {
                    label: 'Диагноз',
                    value: profile?.diagnosis || '—',
                    color: 'text-gray-700',
                    bg: 'bg-gray-50',
                  },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3`}>
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-sm font-semibold ${color} truncate`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Key clinical highlights (read-only) ──────────────── */}
              {(profile?.primaryConcern ||
                profile?.therapyGoals ||
                profile?.communicationLevel ||
                profile?.contraindications ||
                profile?.importantNotes) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Ключевые данные</h3>
                    <button
                      onClick={() => setActiveTab('info')}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      <Edit2 className="w-3 h-3" /> Редактировать
                    </button>
                  </div>
                  {profile?.primaryConcern && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">
                        Основная проблема
                      </p>
                      <p className="text-sm text-gray-800">{profile.primaryConcern}</p>
                    </div>
                  )}
                  {profile?.therapyGoals && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                        Цели терапии
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">
                        {profile.therapyGoals}
                      </p>
                    </div>
                  )}
                  {profile?.communicationLevel && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                        Уровень коммуникации
                      </p>
                      <p className="text-sm text-gray-800">{profile.communicationLevel}</p>
                    </div>
                  )}
                  {profile?.contraindications && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">
                        Противопоказания
                      </p>
                      <p className="text-sm text-gray-800">{profile.contraindications}</p>
                    </div>
                  )}
                  {profile?.importantNotes && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wide">
                        {t('importantNotesLabel')}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">
                        {profile.importantNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!profile?.primaryConcern &&
                !profile?.therapyGoals &&
                !profile?.diagnosis &&
                !profile?.dateOfBirth && (
                  <button
                    onClick={() => setActiveTab('info')}
                    className="w-full border border-dashed border-gray-300 rounded-xl p-4 text-sm text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors text-center"
                  >
                    <Info className="w-4 h-4 inline mr-1.5" />
                    Профиль ещё не заполнен — перейдите во вкладку «Информация»
                  </button>
                )}

              {/* ── Parent / App Connection ───────────────────────────── */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-gray-400" />
                  {t('parentAppConnectionTitle', { defaultValue: 'Подключение через приложение' })}
                </h3>
                {childDetail.parentInfo ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                          Родитель подключён
                        </p>
                        {childDetail.parentInfo.displayName && (
                          <p className="text-sm font-semibold text-gray-900">
                            {childDetail.parentInfo.displayName}
                          </p>
                        )}
                        {childDetail.parentInfo.email && (
                          <a
                            href={`mailto:${childDetail.parentInfo.email}`}
                            className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Mail className="w-3 h-3" />
                            {childDetail.parentInfo.email}
                          </a>
                        )}
                        {childDetail.parentInfo.linkedAt && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {t('connectedSince')}: {fmtShort(childDetail.parentInfo.linkedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Contact details filled by parent from mobile app */}
                    {(childDetail.parentInfo.phone ||
                      childDetail.parentInfo.whatsapp ||
                      childDetail.parentInfo.address) && (
                      <div className="border-t border-green-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {childDetail.parentInfo.phone && (
                          <a
                            href={`tel:${childDetail.parentInfo.phone}`}
                            className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{childDetail.parentInfo.phone}</span>
                          </a>
                        )}
                        {childDetail.parentInfo.whatsapp && (
                          <a
                            href={`https://wa.me/${childDetail.parentInfo.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>WhatsApp: {childDetail.parentInfo.whatsapp}</span>
                          </a>
                        )}
                        {childDetail.parentInfo.address && (
                          <p className="flex items-start gap-2 text-sm text-gray-700 sm:col-span-2">
                            <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span>{childDetail.parentInfo.address}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {!childDetail.parentInfo.phone &&
                      !childDetail.parentInfo.whatsapp &&
                      !childDetail.parentInfo.address && (
                        <p className="text-xs text-gray-400 border-t border-green-200 pt-2">
                          Контактные данные не заполнены — родитель может добавить их в приложении
                        </p>
                      )}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center text-sm text-gray-500">
                    {t('parentNotConnectedDescription')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && (
            <InfoTab
              profile={profile}
              orgId={orgId}
              childId={childId}
              onSaved={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
            />
          )}

          {/* GUARDIANS TAB */}
          {activeTab === 'guardians' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t('guardiansContactsTitle')}
                </h2>
                <button
                  onClick={() => setShowAddGuardian(!showAddGuardian)}
                  className="flex items-center gap-1.5 text-sm bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить контакт
                </button>
              </div>

              {showAddGuardian && (
                <form
                  onSubmit={handleAddGuardian}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4"
                >
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Новый контакт
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Полное имя *
                      </label>
                      <input
                        required
                        value={guardianForm.fullName}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, fullName: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Тип
                      </label>
                      <select
                        value={guardianForm.relationship}
                        onChange={(e) =>
                          setGuardianForm((f) => ({
                            ...f,
                            relationship: e.target.value as Guardian['relationship'],
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="mother">Мама</option>
                        <option value="father">Папа</option>
                        <option value="guardian">Опекун</option>
                        <option value="other">Другое</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Телефон
                      </label>
                      <input
                        value={guardianForm.phone}
                        onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        WhatsApp
                      </label>
                      <input
                        value={guardianForm.whatsapp}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, whatsapp: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={guardianForm.email}
                        onChange={(e) => setGuardianForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Предпочтительный способ связи
                      </label>
                      <select
                        value={guardianForm.preferredContactMethod ?? 'phone'}
                        onChange={(e) =>
                          setGuardianForm((f) => ({
                            ...f,
                            preferredContactMethod: e.target
                              .value as Guardian['preferredContactMethod'],
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="phone">Телефон</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardianForm.isPrimaryContact}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, isPrimaryContact: e.target.checked }))
                        }
                        className="w-4 h-4 text-primary-500 rounded"
                      />
                      Основной контакт
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardianForm.isEmergencyContact}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, isEmergencyContact: e.target.checked }))
                        }
                        className="w-4 h-4 text-primary-500 rounded"
                      />
                      Экстренный контакт
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingGuardian}
                      className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {savingGuardian ? 'Сохранение...' : 'Добавить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddGuardian(false)}
                      className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              {guardians.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500 mb-1">Контакты не добавлены</p>
                  <p className="text-xs text-gray-400">
                    Родитель может добавить данные через мобильное приложение, или добавьте вручную
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {guardians.map((g) => (
                    <div
                      key={g.id}
                      className={`border rounded-xl p-4 ${
                        g.fromApp
                          ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
                          : 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              g.fromApp ? 'bg-green-100' : 'bg-primary-50'
                            }`}
                          >
                            <User
                              className={`w-5 h-5 ${g.fromApp ? 'text-green-600' : 'text-primary-500'}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {g.fullName}
                              </p>
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                {RELATIONSHIP_LABELS[g.relationship] || g.relationship}
                              </span>
                              {g.fromApp && (
                                <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                  <CheckCircle className="w-3 h-3" /> из приложения
                                </span>
                              )}
                              {g.isPrimaryContact && !g.fromApp && (
                                <span className="flex items-center gap-0.5 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                                  <Star className="w-3 h-3 fill-amber-400 stroke-amber-500" />{' '}
                                  Основной
                                </span>
                              )}
                              {g.isEmergencyContact && (
                                <span className="flex items-center gap-0.5 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                                  <Shield className="w-3 h-3" /> Экстренный
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {g.phone && (
                                <a
                                  href={`tel:${g.phone}`}
                                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-600 dark:text-gray-400"
                                >
                                  <Phone className="w-3 h-3" />
                                  {g.phone}
                                </a>
                              )}
                              {g.whatsapp && (
                                <a
                                  href={`https://wa.me/${g.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  {g.whatsapp}
                                </a>
                              )}
                              {g.email && (
                                <a
                                  href={`mailto:${g.email}`}
                                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-600 dark:text-gray-400"
                                >
                                  <Mail className="w-3 h-3" />
                                  {g.email}
                                </a>
                              )}
                              {g.address && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Shield className="w-3 h-3" />
                                  {g.address}
                                </span>
                              )}
                            </div>
                            {g.fromApp && !g.phone && !g.whatsapp && !g.email && (
                              <p className="text-xs text-gray-400 mt-1 italic">
                                Контактные данные не заполнены в приложении
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Only show delete for manually-added guardians */}
                        {!g.fromApp && (
                          <button
                            onClick={() => handleDeleteGuardian(g.id)}
                            disabled={deletingGuardianId === g.id}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROGRESS TAB */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-primary-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-700">
                    {childDetail.completedTasksCount}
                  </div>
                  <div className="text-xs text-primary-600 mt-0.5">{t('tasksCompleted')}</div>
                </div>
                {childDetail.speechStepNumber && (
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-700">
                      {childDetail.speechStepNumber}
                    </div>
                    <div className="text-xs text-purple-600 mt-0.5">{t('roadmapStep')}</div>
                  </div>
                )}
                {childDetail.lastActiveDate && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-sm font-bold text-gray-700">
                      {fmtShort(childDetail.lastActiveDate)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{t('lastActive')}</div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('assignmentsForParent')}
                </h3>
                <p className="text-xs text-gray-500 mb-3">{t('assignmentsDescription')}</p>
                <form onSubmit={handleCreateTask} className="flex gap-2 mb-4">
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={t('taskTitlePlaceholder')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingTask || !taskTitle.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingTask ? t('creatingAssignment') : t('createAssignment')}
                  </button>
                </form>
                {tasks.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">{t('noAssignmentsYet')}</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {task.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {task.title}
                            </p>
                            {task.submissionText && (
                              <p className="text-xs text-gray-600 italic mt-0.5">
                                "{task.submissionText}"
                              </p>
                            )}
                            {task.submittedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {t('submittedOn', { date: fmtShort(task.submittedAt) })}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${task.status === 'completed' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {task.status === 'completed' ? t('statusCompleted') : t('statusPending')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t('progressTimeline')}
                </h3>
                {timeline?.days
                  .filter((d) => d.tasksAttempted > 0 || d.feedback)
                  .map((day) => (
                    <div
                      key={day.date}
                      className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0 mb-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{fmtRelative(day.date)}</p>
                        {day.feedback && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            {day.feedback.mood === 'good' ? (
                              <Smile className="w-4 h-4 text-green-500" />
                            ) : day.feedback.mood === 'ok' ? (
                              <Meh className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <Frown className="w-4 h-4 text-red-500" />
                            )}
                            {t(
                              `mood${day.feedback.mood.charAt(0).toUpperCase() + day.feedback.mood.slice(1)}` as 'moodGood'
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {t('timelineSummary', {
                          completed: day.tasksCompleted,
                          attempted: day.tasksAttempted,
                        })}
                      </p>
                      {day.feedback?.comment && (
                        <p className="text-xs text-gray-600 italic mt-1 pl-2 border-l-2 border-gray-200">
                          "{day.feedback.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                {!timeline?.days.some((d) => d.tasksAttempted > 0 || d.feedback) && (
                  <p className="text-sm text-gray-400">{t('noActivityLast30Days')}</p>
                )}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              <form
                onSubmit={handleSubmitNote}
                className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3"
              >
                <h3 className="text-sm font-semibold text-gray-800">{t('addNote')}</h3>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={t('notePlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleToParent}
                      onChange={(e) => setVisibleToParent(e.target.checked)}
                      className="w-4 h-4 text-primary-500 rounded"
                    />
                    {t('visibleToParent')}
                    {visibleToParent && childDetail.parentInfo && (
                      <span className="text-xs text-green-600">{t('parentWillSeeNote')}</span>
                    )}
                  </label>
                  <button
                    type="submit"
                    disabled={submittingNote || !noteContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingNote ? t('savingNote') : t('sendNote')}
                  </button>
                </div>
              </form>

              {notes.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">{t('noNotesYet')}</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={`border rounded-lg p-4 space-y-2 ${note.visibleToParent === false ? 'border-gray-200 bg-gray-50' : 'border-primary-100 bg-white'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {note.specialistName}
                          </p>
                          {note.visibleToParent === false && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                              {t('privateNote')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString(dateLocale)}{' '}
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Activity log</h2>
              {activityEvents.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No activity recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-4">
                    {activityEvents.map((event) => (
                      <div key={event.id} className="relative pl-10">
                        <div className="absolute left-3 top-1.5 w-2 h-2 rounded-full bg-primary-400 ring-2 ring-white" />
                        <div className="bg-white border border-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-800 capitalize">
                              {event.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(event.createdAt).toLocaleDateString(dateLocale, {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              {new Date(event.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {event.actorName && (
                            <p className="text-xs text-gray-500 mt-0.5">by {event.actorName}</p>
                          )}
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {Object.entries(event.metadata).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                                >
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
