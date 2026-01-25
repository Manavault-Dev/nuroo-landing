'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type ChildDetail, type SpecialistNote, type TimelineResponse, type ParentInfo } from '@/lib/b2b/api'
import { ArrowLeft, MessageSquare, Send, Calendar, CheckCircle, Clock, AlertCircle, Smile, Meh, Frown, User, Mail, Link2 } from 'lucide-react'

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
  const [error, setError] = useState('')

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

        const [detailData, notesData, timelineData] = await Promise.all([
          apiClient.getChildDetail(orgId, childId),
          apiClient.getNotes(orgId, childId),
          apiClient.getTimeline(orgId, childId, 30),
        ])

        setChildDetail(detailData)
        setNotes(notesData)
        setTimeline(timelineData)
      } catch (error: any) {
        console.error('Error loading child profile:', error)
        setError(error.message || 'Failed to load child profile')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, childId, orgId])

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

      const newNote = await apiClient.createNote(orgId, childId, noteContent.trim(), undefined, visibleToParent)
      const updatedNotes = await apiClient.getNotes(orgId, childId)
      setNotes(updatedNotes)
      setNoteContent('')
      setVisibleToParent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to save note. Please try again.')
    } finally {
      setSubmittingNote(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading child profile...</p>
        </div>
      </div>
    )
  }

  if (!childDetail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Child not found</h3>
          <p className="text-gray-600 mb-4">{error || "The child profile you're looking for doesn't exist."}</p>
          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Children
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="p-8">
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
              <p className="text-sm text-gray-600 mt-1">Age {childDetail.age}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {childDetail.completedTasksCount}
                  </p>
                </div>
                {childDetail.speechStepNumber && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Roadmap Step</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {childDetail.speechStepNumber}
                    </p>
                  </div>
                )}
                {childDetail.lastActiveDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Last Active</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {new Date(childDetail.lastActiveDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Progress Timeline</h2>
              </div>
              {timeline && timeline.days.length > 0 ? (
                <div className="space-y-4">
                  {timeline.days
                    .filter(day => day.tasksAttempted > 0 || day.feedback)
                    .map((day) => (
                      <div
                        key={day.date}
                        className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900">{formatDate(day.date)}</p>
                          {day.feedback && (
                            <div className="flex items-center space-x-1">
                              {getFeedbackIcon(day.feedback.mood)}
                              <span className="text-xs text-gray-500 capitalize">{day.feedback.mood}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            {day.tasksCompleted} of {day.tasksAttempted} tasks completed
                          </p>
                          {day.feedback?.comment && (
                            <p className="text-sm text-gray-700 italic mt-2 pl-2 border-l-2 border-gray-200">
                              "{day.feedback.comment}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  {timeline.days.filter(day => day.tasksAttempted > 0 || day.feedback).length === 0 && (
                    <p className="text-gray-600 text-sm py-4">No activity in the last 30 days.</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-sm py-4">Loading timeline...</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h2>
              {childDetail.recentTasks.length === 0 ? (
                <p className="text-gray-600 text-sm">No recent tasks available.</p>
              ) : (
                <div className="space-y-3">
                  {childDetail.recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getTaskStatusIcon(task.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          {task.completedAt && (
                            <p className="text-xs text-gray-500">
                              Completed {new Date(task.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          task.status === 'completed'
                            ? 'bg-success-100 text-success-700'
                            : task.status === 'in-progress'
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Parent Info Section */}
            {childDetail.parentInfo && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <User className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Parent Information</h2>
                </div>
                <div className="space-y-3">
                  {childDetail.parentInfo.displayName && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {childDetail.parentInfo.displayName}
                      </span>
                    </div>
                  )}
                  {childDetail.parentInfo.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Email:</span>
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
                      <span className="text-sm text-gray-600">Connected:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(childDetail.parentInfo.linkedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Parent connected via mobile app invite code
                  </p>
                </div>
              </div>
            )}

            {/* Show placeholder if no parent linked */}
            {!childDetail.parentInfo && (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-500">Parent Not Connected</h2>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  This child's parent hasn't connected via the mobile app yet.
                </p>
                <p className="text-xs text-gray-400">
                  Share your invite code with the parent to enable communication and note sharing.
                </p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Note</h2>
              <form onSubmit={handleSubmitNote} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write a note or recommendation for the parent..."
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
                  <span className="text-sm text-gray-700">Visible to parent</span>
                  {visibleToParent && childDetail?.parentInfo && (
                    <span className="text-xs text-green-600">(Parent will see this note)</span>
                  )}
                  {visibleToParent && !childDetail?.parentInfo && (
                    <span className="text-xs text-gray-500">(No parent connected yet)</span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={submittingNote || !noteContent.trim()}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingNote ? 'Saving...' : 'Send Note'}</span>
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes & Recommendations</h2>
              {notes.length === 0 ? (
                <p className="text-gray-600 text-sm">No notes yet.</p>
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
                          <p className="text-sm font-semibold text-gray-900">{note.specialistName}</p>
                          {note.visibleToParent === false && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(note.createdAt).toLocaleDateString()}{' '}
                          {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
