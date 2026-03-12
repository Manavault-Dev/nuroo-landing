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
} from '@/lib/b2b/api'
import {
  ArrowLeft,
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
} from 'lucide-react'

export default function ChildDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const childId = params.childId as string
  const orgId = searchParams.get('orgId') || 'default-org'

  const [childDetail, setChildDetail] = useState<ChildDetail | null>(null)
  const [notes, setNotes] = useState<SpecialistNote[]>([])
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteContent, setNoteContent] = useState('')
  const [visibleToParent, setVisibleToParent] = useState(true)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [tasks, setTasks] = useState<ChildTask[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('b2b.pages.childDetail')
  const locale = useLocale()
  const dateLocale =
    locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : locale

  useEffect(() => {
    const loadData = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken()
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        const [detailData, notesData, timelineData, tasksRes] = await Promise.all([
          apiClient.getChildDetail(orgId, childId),
          apiClient.getNotes(orgId, childId),
          apiClient.getTimeline(orgId, childId, 30),
          apiClient.getChildTasks(orgId, childId),
        ])

        setChildDetail(detailData)
        setNotes(notesData)
        setTimeline(timelineData)
        setTasks(tasksRes.tasks)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : t('failedToLoad')
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, childId, orgId, t])

  const handleSubmitNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim() || !childDetail) return

    setError('')
    setSubmittingNote(true)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }
      apiClient.setToken(idToken)

      await apiClient.createNote(orgId, childId, noteContent.trim(), undefined, visibleToParent)
      const updatedNotes = await apiClient.getNotes(orgId, childId)
      setNotes(updatedNotes)
      setNoteContent('')
      setVisibleToParent(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('failedToSaveNote')
      setError(errorMessage)
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim() || !childDetail) return

    setError('')
    setSubmittingTask(true)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }
      apiClient.setToken(idToken)

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('failedToCreateTask')
      setError(msg)
    } finally {
      setSubmittingTask(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loadingProfile')}</p>
        </div>
      </div>
    )
  }

  if (!childDetail) {
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
  }

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success-500" />
      case 'in-progress':
        return <Clock className="w-4 h-4 text-primary-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getFeedbackIcon = (mood: 'good' | 'ok' | 'hard') => {
    switch (mood) {
      case 'good':
        return <Smile className="w-5 h-5 text-green-500" />
      case 'ok':
        return <Meh className="w-5 h-5 text-yellow-500" />
      case 'hard':
        return <Frown className="w-5 h-5 text-red-500" />
    }
  }

  const getTaskStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return t('statusCompleted')
      case 'in-progress':
        return t('statusInProgress')
      default:
        return t('statusPending')
    }
  }

  const getFeedbackLabel = (mood: 'good' | 'ok' | 'hard') => {
    switch (mood) {
      case 'good':
        return t('moodGood')
      case 'ok':
        return t('moodOk')
      case 'hard':
        return t('moodHard')
    }
  }

  const formatShortDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(dateLocale)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return t('today')
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday')
    } else {
      return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-2">
          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{childDetail.name}</h2>
            {childDetail.age && (
              <p className="text-sm text-gray-600 mt-1">
                {t('ageLabel', { age: childDetail.age })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('progressSummary')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t('tasksCompleted')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {childDetail.completedTasksCount}
                  </p>
                </div>
                {childDetail.speechStepNumber && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('roadmapStep')}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {childDetail.speechStepNumber}
                    </p>
                  </div>
                )}
                {childDetail.lastActiveDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('lastActive')}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatShortDate(childDetail.lastActiveDate)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">{t('progressTimeline')}</h2>
              </div>
              {timeline && timeline.days.length > 0 ? (
                <div className="space-y-4">
                  {timeline.days
                    .filter((day) => day.tasksAttempted > 0 || day.feedback)
                    .map((day) => (
                      <div
                        key={day.date}
                        className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(day.date)}
                          </p>
                          {day.feedback && (
                            <div className="flex items-center space-x-1">
                              {getFeedbackIcon(day.feedback.mood)}
                              <span className="text-xs text-gray-500 capitalize">
                                {getFeedbackLabel(day.feedback.mood)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            {t('timelineSummary', {
                              completed: day.tasksCompleted,
                              attempted: day.tasksAttempted,
                            })}
                          </p>
                          {day.feedback?.comment && (
                            <p className="text-sm text-gray-700 italic mt-2 pl-2 border-l-2 border-gray-200">
                              "{day.feedback.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  {timeline.days.filter((day) => day.tasksAttempted > 0 || day.feedback).length ===
                    0 && <p className="text-gray-600 text-sm py-4">{t('noActivityLast30Days')}</p>}
                </div>
              ) : (
                <p className="text-gray-600 text-sm py-4">{t('loadingTimeline')}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {t('assignmentsForParent')}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{t('assignmentsDescription')}</p>
              <form onSubmit={handleCreateTask} className="space-y-3 mb-6">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={t('taskTitlePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder={t('taskDescriptionPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingTask || !taskTitle.trim()}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingTask ? t('creatingAssignment') : t('createAssignment')}</span>
                </button>
              </form>
              {tasks.length === 0 ? (
                <p className="text-gray-600 text-sm">{t('noAssignmentsYet')}</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getTaskStatusIcon(task.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-gray-600 mt-0.5">{task.description}</p>
                          )}
                          {task.submissionText && (
                            <p className="text-xs text-gray-700 mt-1 italic">
                              &ldquo;{task.submissionText}&rdquo;
                            </p>
                          )}
                          {task.fileUrl && (
                            <a
                              href={task.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:text-primary-700 underline mt-1 block truncate"
                            >
                              {t('viewAttachment')}
                            </a>
                          )}
                          {task.submittedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {t('submittedOn', { date: formatShortDate(task.submittedAt) })}
                            </p>
                          )}
                          {task.completedAt && !task.submittedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {t('completedOn', { date: formatShortDate(task.completedAt) })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          task.status === 'completed'
                            ? 'bg-success-100 text-success-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {childDetail.parentInfo && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <User className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{t('parentInformation')}</h2>
                </div>
                <div className="space-y-3">
                  {childDetail.parentInfo.displayName && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{t('parentName')}:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {childDetail.parentInfo.displayName}
                      </span>
                    </div>
                  )}
                  {childDetail.parentInfo.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{t('parentEmail')}:</span>
                      <a
                        href={`mailto:${childDetail.parentInfo.email}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {childDetail.parentInfo.email}
                      </a>
                    </div>
                  )}
                  {childDetail.parentInfo.linkedAt && (
                    <div className="flex items-center space-x-2">
                      <Link2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{t('connectedSince')}:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatShortDate(childDetail.parentInfo.linkedAt)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">{t('parentConnectedViaInvite')}</p>
                </div>
              </div>
            )}

            {!childDetail.parentInfo && (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-500">{t('parentNotConnected')}</h2>
                </div>
                <p className="text-sm text-gray-500 mb-3">{t('parentNotConnectedDescription')}</p>
                <p className="text-xs text-gray-400">{t('parentNotConnectedHint')}</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('addNote')}</h2>
              <form onSubmit={handleSubmitNote} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={t('notePlaceholder')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  required
                />
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleToParent}
                    onChange={(e) => setVisibleToParent(e.target.checked)}
                    className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{t('visibleToParent')}</span>
                  {visibleToParent && childDetail?.parentInfo && (
                    <span className="text-xs text-green-600">{t('parentWillSeeNote')}</span>
                  )}
                  {visibleToParent && !childDetail?.parentInfo && (
                    <span className="text-xs text-gray-500">{t('noParentConnectedYet')}</span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={submittingNote || !noteContent.trim()}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingNote ? t('savingNote') : t('sendNote')}</span>
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('notesRecommendations')}
              </h2>
              {notes.length === 0 ? (
                <p className="text-gray-600 text-sm">{t('noNotesYet')}</p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={`border rounded-lg p-4 space-y-2 ${
                        note.visibleToParent === false
                          ? 'border-gray-300 bg-gray-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {note.specialistName}
                          </p>
                          {note.visibleToParent === false && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                              {t('privateNote')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(note.createdAt).toLocaleDateString()}{' '}
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
          </div>
        </div>
      </div>
    </div>
  )
}
