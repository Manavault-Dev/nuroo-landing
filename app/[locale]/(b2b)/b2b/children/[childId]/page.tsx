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
} from 'lucide-react'

type Tab = 'overview' | 'guardians' | 'progress' | 'notes' | 'timeline'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-600',
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
    if (!confirm('Remove this guardian?')) return
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
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Profile Information</h2>
                <button
                  onClick={() => setEditingProfile(!editingProfile)}
                  className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {editingProfile ? 'Cancel' : 'Edit'}
                  {editingProfile ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {editingProfile ? (
                <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'First name', key: 'firstName' },
                      { label: 'Last name', key: 'lastName' },
                      { label: 'Date of birth (YYYY-MM-DD)', key: 'dateOfBirth' },
                      { label: 'Internal code', key: 'internalCode' },
                      { label: 'Primary concern', key: 'primaryConcern' },
                      { label: 'Diagnosis', key: 'diagnosis' },
                      { label: 'Communication level', key: 'communicationLevel' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {label}
                        </label>
                        <input
                          value={(profileDraft as Record<string, string>)[key] || ''}
                          onChange={(e) =>
                            setProfileDraft((d) => ({ ...d, [key]: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                      <select
                        value={profileDraft.gender || ''}
                        onChange={(e) =>
                          setProfileDraft((d) => ({
                            ...d,
                            gender: e.target.value as 'male' | 'female' | 'other',
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Not specified</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select
                        value={profileDraft.status || 'active'}
                        onChange={(e) =>
                          setProfileDraft((d) => ({
                            ...d,
                            status: e.target.value as ChildProfileData['status'],
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="active">{t('statusActive')}</option>
                        <option value="paused">{t('statusPaused')}</option>
                        <option value="completed">{t('statusCompleted')}</option>
                        <option value="archived">{t('statusArchived')}</option>
                      </select>
                    </div>
                  </div>
                  {[
                    { label: t('developmentalNotesLabel'), key: 'developmentalNotes', rows: 3 },
                    { label: 'Therapy goals', key: 'therapyGoals', rows: 3 },
                    { label: 'Contraindications', key: 'contraindications', rows: 2 },
                    { label: t('importantNotesLabel'), key: 'importantNotes', rows: 2 },
                  ].map(({ label, key, rows }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {label}
                      </label>
                      <textarea
                        value={(profileDraft as Record<string, string>)[key] || ''}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, [key]: e.target.value }))}
                        rows={rows}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    {savingProfile ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      {
                        label: 'Date of birth',
                        value: profile?.dateOfBirth ? fmtShort(profile.dateOfBirth) : undefined,
                      },
                      { label: 'Gender', value: profile?.gender },
                      { label: 'Internal code', value: profile?.internalCode },
                      {
                        label: 'Start date',
                        value: profile?.startDate ? fmtShort(profile.startDate) : undefined,
                      },
                      { label: 'Communication', value: profile?.communicationLevel },
                      { label: 'Diagnosis', value: profile?.diagnosis },
                    ].map(({ label, value }) =>
                      value ? (
                        <div key={label} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-gray-900">{value}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                  {profile?.primaryConcern && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">
                        Primary concern
                      </p>
                      <p className="text-sm text-gray-800">{profile.primaryConcern}</p>
                    </div>
                  )}
                  {profile?.therapyGoals && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                        Therapy goals
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {profile.therapyGoals}
                      </p>
                    </div>
                  )}
                  {profile?.developmentalNotes && (
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                        {t('developmentalNotesLabel')}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {profile.developmentalNotes}
                      </p>
                    </div>
                  )}
                  {profile?.contraindications && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">
                        Contraindications
                      </p>
                      <p className="text-sm text-gray-800">{profile.contraindications}</p>
                    </div>
                  )}
                  {profile?.importantNotes && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wide">
                        {t('importantNotesLabel')}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {profile.importantNotes}
                      </p>
                    </div>
                  )}
                  {!profile?.primaryConcern &&
                    !profile?.therapyGoals &&
                    !profile?.developmentalNotes &&
                    !profile?.dateOfBirth && (
                      <p className="text-sm text-gray-400 py-4">
                        No profile details yet. Click Edit to add information.
                      </p>
                    )}
                </div>
              )}

              {/* Parent info */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Parent / App Connection
                </h3>
                {childDetail.parentInfo ? (
                  <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
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
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-500">
                    {t('parentNotConnectedDescription')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GUARDIANS TAB */}
          {activeTab === 'guardians' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">
                  {t('guardiansContactsTitle')}
                </h2>
                <button
                  onClick={() => setShowAddGuardian(!showAddGuardian)}
                  className="flex items-center gap-1.5 text-sm bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add guardian
                </button>
              </div>

              {showAddGuardian && (
                <form
                  onSubmit={handleAddGuardian}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-5 space-y-4"
                >
                  <h3 className="text-sm font-semibold text-gray-800">New guardian</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Full name *
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Relationship
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
                        <option value="mother">Mother</option>
                        <option value="father">Father</option>
                        <option value="guardian">Guardian</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input
                        value={guardianForm.phone}
                        onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={guardianForm.email}
                        onChange={(e) => setGuardianForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Preferred contact
                      </label>
                      <select
                        value={guardianForm.preferredContactMethod}
                        onChange={(e) =>
                          setGuardianForm((f) => ({
                            ...f,
                            preferredContactMethod: e.target
                              .value as Guardian['preferredContactMethod'],
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="phone">Phone</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardianForm.isPrimaryContact}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, isPrimaryContact: e.target.checked }))
                        }
                        className="w-4 h-4 text-primary-500 rounded"
                      />
                      Primary contact
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardianForm.isEmergencyContact}
                        onChange={(e) =>
                          setGuardianForm((f) => ({ ...f, isEmergencyContact: e.target.checked }))
                        }
                        className="w-4 h-4 text-primary-500 rounded"
                      />
                      Emergency contact
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingGuardian}
                      className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {savingGuardian ? 'Saving...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddGuardian(false)}
                      className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {guardians.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No guardians added yet.</p>
              ) : (
                <div className="space-y-3">
                  {guardians.map((g) => (
                    <div key={g.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{g.fullName}</p>
                              <span className="text-xs text-gray-500 capitalize">
                                {g.relationship}
                              </span>
                              {g.isPrimaryContact && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                                  <Star className="w-3 h-3 fill-amber-400 stroke-amber-500" />{' '}
                                  Primary
                                </span>
                              )}
                              {g.isEmergencyContact && (
                                <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                                  <Shield className="w-3 h-3" /> Emergency
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                              {g.phone && (
                                <a
                                  href={`tel:${g.phone}`}
                                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-600"
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
                                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-600"
                                >
                                  <Mail className="w-3 h-3" />
                                  {g.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteGuardian(g.id)}
                          disabled={deletingGuardianId === g.id}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
