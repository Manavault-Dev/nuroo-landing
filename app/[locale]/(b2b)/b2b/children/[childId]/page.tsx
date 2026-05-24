'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useParams, useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/lib/b2b/AuthContext'
import {
  apiClient,
  type ChildDetail,
  type TimelineResponse,
  type ChildTask,
  type SpecialistNote,
  type ChildIntakeForm,
  type Guardian,
  type GuardianInput,
} from '@/lib/b2b/api'
import { ActivityFeed } from '@/components/b2b/ActivityFeed'
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
  Activity,
  FileText,
  BookOpen,
  Users,
  LayoutGrid,
  Tag,
  Phone,
  ExternalLink,
  TrendingUp,
  Award,
  Target,
  ClipboardList,
  Baby,
  Heart,
  Stethoscope,
  School,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  MessageCircle,
  Star,
  ShieldCheck,
  X,
} from 'lucide-react'

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'activity' | 'assignments' | 'guardians'

const TABS: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'overview', labelKey: 'tabOverview', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'activity', labelKey: 'tabActivity', icon: <Activity className="w-4 h-4" /> },
  { id: 'assignments', labelKey: 'tabAssignments', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'guardians', labelKey: 'tabGuardians', icon: <Users className="w-4 h-4" /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'from-teal-400 to-teal-600',
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-rose-400 to-rose-500',
  'from-amber-400 to-amber-600',
]
function avatarGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function StatChip({
  icon,
  label,
  value,
  color = 'gray',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color?: string
}) {
  const colors: Record<string, string> = {
    teal: 'bg-teal-50  text-teal-700  border-teal-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    blue: 'bg-blue-50  text-blue-700  border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    gray: 'bg-gray-50  text-gray-700  border-gray-100',
  }
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${colors[color] ?? colors.gray}`}
    >
      {icon}
      <span className="text-xs text-current opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function formatValue(
  value: string | number | boolean | string[] | null | undefined,
  t: ReturnType<typeof useTranslations>
): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value ? t('yes') : t('no')
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function relationshipLabel(
  relationship: Guardian['relationship'] | ChildIntakeForm['filledBy'] | undefined,
  t: ReturnType<typeof useTranslations>,
  other?: string
): string | undefined {
  if (!relationship) return undefined
  if (relationship === 'other') return other || t('relationshipOther')
  return t(`relationship${relationship[0].toUpperCase()}${relationship.slice(1)}`)
}

function InfoRow({
  label,
  value,
  t,
}: {
  label: string
  value?: string | number | boolean | string[] | null
  t: ReturnType<typeof useTranslations>
}) {
  const display = formatValue(value, t)
  if (!display) return null
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 min-w-[160px] flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium break-words">{display}</span>
    </div>
  )
}

function OverviewCard({
  icon,
  title,
  children,
  accent = 'teal',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  accent?: string
}) {
  const border: Record<string, string> = {
    teal: 'border-l-teal-400',
    blue: 'border-l-blue-400',
    violet: 'border-l-violet-400',
    amber: 'border-l-amber-400',
    rose: 'border-l-rose-400',
  }
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 ${border[accent] ?? border.teal}`}
    >
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  )
}

function OverviewTab({
  orgId,
  childId,
  childDetail,
  timeline,
  formatDate,
  formatShortDate,
  getFeedbackIcon,
  getFeedbackLabel,
  t,
}: {
  orgId: string
  childId: string
  childDetail: ChildDetail
  timeline: TimelineResponse | null
  formatDate: (d: string) => string
  formatShortDate: (d: string) => string
  getFeedbackIcon: (m: 'good' | 'ok' | 'hard') => React.ReactNode
  getFeedbackLabel: (m: 'good' | 'ok' | 'hard') => string
  t: ReturnType<typeof useTranslations>
}) {
  const [intake, setIntake] = useState<ChildIntakeForm | null>(null)
  const [intakeLoading, setIntakeLoading] = useState(true)

  useEffect(() => {
    apiClient
      .getChildIntake(orgId, childId)
      .then(setIntake)
      .catch(() => {})
      .finally(() => setIntakeLoading(false))
  }, [orgId, childId])

  const activeTimeline = timeline?.days.filter((d) => d.tasksAttempted > 0 || d.feedback) ?? []
  const completionRate = timeline?.days.length
    ? Math.round(
        (timeline.days.reduce((s, d) => s + d.tasksCompleted, 0) /
          Math.max(
            1,
            timeline.days.reduce((s, d) => s + d.tasksAttempted, 0)
          )) *
          100
      )
    : 0

  const filledByLabel = relationshipLabel(intake?.filledBy, t, intake?.filledByOther)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* ── Left column: intake + progress ── */}
      <div className="xl:col-span-2 space-y-5">
        {/* ── Progress stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{childDetail.completedTasksCount}</p>
            <p className="text-xs text-gray-400 mt-1">{t('tasksCompleted')}</p>
          </div>
          {childDetail.speechStepNumber && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{childDetail.speechStepNumber}</p>
              <p className="text-xs text-gray-400 mt-1">{t('roadmapStep')}</p>
            </div>
          )}
          {completionRate > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{completionRate}%</p>
              <p className="text-xs text-gray-400 mt-1">{t('completion')}</p>
            </div>
          )}
          {childDetail.lastActiveDate && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-sm font-bold text-blue-600 mt-1">
                {formatShortDate(childDetail.lastActiveDate)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t('lastActive')}</p>
            </div>
          )}
        </div>

        {/* ── Intake: general info ── */}
        {intakeLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-gray-50 rounded" />
              ))}
            </div>
          </div>
        ) : intake ? (
          <>
            {/* General info */}
            <OverviewCard
              icon={<User className="w-4 h-4" />}
              title={t('intake.generalInfo')}
              accent="teal"
            >
              <InfoRow label={t('intake.childFullName')} value={intake.childFullName} t={t} />
              <InfoRow label={t('intake.dateOfBirth')} value={intake.dateOfBirth} t={t} />
              <InfoRow label={t('intake.ageText')} value={intake.ageText} t={t} />
              <InfoRow label={t('intake.homeAddress')} value={intake.homeAddress} t={t} />
              <InfoRow label={t('intake.contactPhone')} value={intake.contactPhone} t={t} />
              <InfoRow label={t('intake.filledBy')} value={filledByLabel} t={t} />
              {intake.updatedAt && (
                <p className="text-xs text-gray-300 pt-2">
                  {t('intake.updatedAt', { date: formatShortDate(intake.updatedAt) })}
                </p>
              )}
            </OverviewCard>

            {/* Complaints */}
            {(intake.mainConcerns ||
              intake.firstNoticedAt ||
              (intake.previousSpecialists ?? []).length > 0) && (
              <OverviewCard
                icon={<FileText className="w-4 h-4" />}
                title={t('intake.complaints')}
                accent="rose"
              >
                <InfoRow label={t('intake.mainConcerns')} value={intake.mainConcerns} t={t} />
                <InfoRow label={t('intake.firstNoticedAt')} value={intake.firstNoticedAt} t={t} />
                <InfoRow
                  label={t('intake.previousSpecialists')}
                  value={intake.previousSpecialists}
                  t={t}
                />
                {intake.previousSpecialistsOther && (
                  <InfoRow
                    label={t('intake.other')}
                    value={intake.previousSpecialistsOther}
                    t={t}
                  />
                )}
              </OverviewCard>
            )}

            {/* Development */}
            {(intake.heldHeadAt || intake.walkedAt || intake.firstWordsAt || intake.cooingAt) && (
              <OverviewCard
                icon={<TrendingUp className="w-4 h-4" />}
                title={t('intake.earlyDevelopment')}
                accent="violet"
              >
                {(intake.heldHeadAt || intake.walkedAt) && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      {t('intake.motorDevelopment')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                      <InfoRow label={t('intake.heldHeadAt')} value={intake.heldHeadAt} t={t} />
                      <InfoRow label={t('intake.crawledAt')} value={intake.crawledAt} t={t} />
                      <InfoRow label={t('intake.satAt')} value={intake.satAt} t={t} />
                      <InfoRow label={t('intake.stoodAt')} value={intake.stoodAt} t={t} />
                      <InfoRow label={t('intake.walkedAt')} value={intake.walkedAt} t={t} />
                    </div>
                    <InfoRow label={t('intake.toneIssues')} value={intake.toneIssues} t={t} />
                    <InfoRow
                      label={t('intake.neurologistBefore3')}
                      value={intake.neurologistBefore3}
                      t={t}
                    />
                  </div>
                )}
                {(intake.firstWordsAt || intake.cooingAt || intake.phraseSpeechAt) && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      {t('intake.speechDevelopment')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                      <InfoRow label={t('intake.cooingAt')} value={intake.cooingAt} t={t} />
                      <InfoRow label={t('intake.babblingAt')} value={intake.babblingAt} t={t} />
                      <InfoRow label={t('intake.firstWordsAt')} value={intake.firstWordsAt} t={t} />
                      <InfoRow
                        label={t('intake.phraseSpeechAt')}
                        value={intake.phraseSpeechAt}
                        t={t}
                      />
                    </div>
                    <InfoRow
                      label={t('intake.speechRegression')}
                      value={intake.speechRegression}
                      t={t}
                    />
                    <InfoRow
                      label={t('intake.understandsSpeech')}
                      value={intake.understandsSpeech}
                      t={t}
                    />
                    <InfoRow label={t('intake.usesGestures')} value={intake.usesGestures} t={t} />
                    <InfoRow label={t('intake.hasEcholalia')} value={intake.hasEcholalia} t={t} />
                    {(intake.speechFeatures ?? []).length > 0 && (
                      <InfoRow
                        label={t('intake.speechFeatures')}
                        value={intake.speechFeatures}
                        t={t}
                      />
                    )}
                  </div>
                )}
                {(intake.eyeContact || intake.respondsToName) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      {t('intake.socialDevelopment')}
                    </p>
                    <InfoRow label={t('intake.eyeContact')} value={intake.eyeContact} t={t} />
                    <InfoRow
                      label={t('intake.respondsToName')}
                      value={intake.respondsToName}
                      t={t}
                    />
                    <InfoRow
                      label={t('intake.likedCommunication')}
                      value={intake.likedCommunication}
                      t={t}
                    />
                    <InfoRow
                      label={t('intake.playedRoleGames')}
                      value={intake.playedRoleGames}
                      t={t}
                    />
                    {(intake.behaviorFeatures ?? []).length > 0 && (
                      <InfoRow
                        label={t('intake.behaviorFeatures')}
                        value={intake.behaviorFeatures}
                        t={t}
                      />
                    )}
                  </div>
                )}
              </OverviewCard>
            )}

            {/* Pregnancy + Birth */}
            {(intake.gestationWeeks ||
              intake.birthTypes ||
              intake.weightAtBirth ||
              intake.apgarScore) && (
              <OverviewCard
                icon={<Baby className="w-4 h-4" />}
                title={t('intake.pregnancyAndBirth')}
                accent="blue"
              >
                <div className="grid grid-cols-2 gap-x-6">
                  <InfoRow label={t('intake.gestationWeeks')} value={intake.gestationWeeks} t={t} />
                  <InfoRow label={t('intake.weightAtBirth')} value={intake.weightAtBirth} t={t} />
                  <InfoRow label={t('intake.heightAtBirth')} value={intake.heightAtBirth} t={t} />
                  <InfoRow label={t('intake.apgarScore')} value={intake.apgarScore} t={t} />
                </div>
                <InfoRow label={t('intake.birthTypes')} value={intake.birthTypes} t={t} />
                <InfoRow
                  label={t('intake.pregnancyComplications')}
                  value={intake.pregnancyComplications}
                  t={t}
                />
                <InfoRow
                  label={t('intake.pregnancyFactors')}
                  value={intake.pregnancyFactors}
                  t={t}
                />
                <InfoRow
                  label={t('intake.birthComplications')}
                  value={intake.birthComplications}
                  t={t}
                />
                <InfoRow label={t('intake.birthFactors')} value={intake.birthFactors} t={t} />
                <InfoRow
                  label={t('intake.neededResuscitation')}
                  value={intake.neededResuscitation}
                  t={t}
                />
                <InfoRow label={t('intake.inIncubator')} value={intake.inIncubator} t={t} />
              </OverviewCard>
            )}

            {/* Health */}
            {((intake.healthConditions ?? []).length > 0 ||
              intake.longTermMedications ||
              intake.hospitalizations) && (
              <OverviewCard
                icon={<Stethoscope className="w-4 h-4" />}
                title={t('intake.health')}
                accent="amber"
              >
                <InfoRow
                  label={t('intake.healthConditions')}
                  value={intake.healthConditions}
                  t={t}
                />
                {intake.healthConditionsOther && (
                  <InfoRow label={t('intake.other')} value={intake.healthConditionsOther} t={t} />
                )}
                <InfoRow
                  label={t('intake.hospitalizations')}
                  value={intake.hospitalizations}
                  t={t}
                />
                <InfoRow
                  label={t('intake.longTermMedications')}
                  value={intake.longTermMedications}
                  t={t}
                />
                <InfoRow label={t('intake.breastfed')} value={intake.breastfed} t={t} />
                <InfoRow label={t('intake.selectiveEating')} value={intake.selectiveEating} t={t} />
                <InfoRow label={t('intake.sleepDisorders')} value={intake.sleepDisorders} t={t} />
              </OverviewCard>
            )}

            {/* Family history */}
            {(intake.familyConditions ?? []).length > 0 && (
              <OverviewCard
                icon={<Users className="w-4 h-4" />}
                title={t('intake.familyHistory')}
                accent="violet"
              >
                <InfoRow
                  label={t('intake.familyConditions')}
                  value={intake.familyConditions}
                  t={t}
                />
                <InfoRow
                  label={t('intake.familyConditionsWho')}
                  value={intake.familyConditionsWho}
                  t={t}
                />
              </OverviewCard>
            )}

            {/* Self-care */}
            {(intake.selfCareSkills ?? []).length > 0 && (
              <OverviewCard
                icon={<Award className="w-4 h-4" />}
                title={t('intake.selfCare')}
                accent="teal"
              >
                <InfoRow label={t('intake.selfCareSkills')} value={intake.selfCareSkills} t={t} />
              </OverviewCard>
            )}

            {/* Additional */}
            {intake.additionalInfo && (
              <OverviewCard
                icon={<FileText className="w-4 h-4" />}
                title={t('intake.additionalInfo')}
                accent="blue"
              >
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {intake.additionalInfo}
                </p>
              </OverviewCard>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
            <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-600 mb-1">{t('intake.emptyTitle')}</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              {t('intake.emptyDescription')}
            </p>
          </div>
        )}
      </div>

      {/* ── Right column: timeline + tasks ── */}
      <div className="space-y-5">
        {/* Progress timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">{t('progressTimeline')}</h3>
            <span className="ml-auto text-xs text-gray-300">{t('last30Days')}</span>
          </div>
          {activeTimeline.length > 0 ? (
            <div className="space-y-0 max-h-[340px] overflow-y-auto">
              {activeTimeline.map((day, i) => (
                <div key={day.date} className="flex gap-3 group">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        day.tasksCompleted === day.tasksAttempted && day.tasksAttempted > 0
                          ? 'bg-green-400'
                          : day.tasksCompleted > 0
                            ? 'bg-teal-400'
                            : 'bg-gray-200'
                      }`}
                    />
                    {i < activeTimeline.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 my-1 min-h-[16px]" />
                    )}
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {formatDate(day.date)}
                      </p>
                      {day.feedback && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {getFeedbackIcon(day.feedback.mood)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {t('timelineSummary', {
                        completed: day.tasksCompleted,
                        attempted: day.tasksAttempted,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-7 h-7 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">{t('noActivityLast30Days')}</p>
            </div>
          )}
        </div>

        {/* Recent tasks */}
        {childDetail.recentTasks?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">{t('recentTasks')}</h3>
            </div>
            <div className="space-y-1">
              {childDetail.recentTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 py-1.5">
                  {task.status === 'completed' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-gray-300  flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                  >
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Assignments ──────────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-green-50  text-green-700  border-green-100',
  medium: 'bg-amber-50  text-amber-700  border-amber-100',
  hard: 'bg-red-50    text-red-700    border-red-100',
}
function AssignmentsTab({
  orgId,
  childId,
  t,
  formatShortDate,
}: {
  orgId: string
  childId: string
  t: ReturnType<typeof useTranslations>
  formatShortDate: (d: string) => string
}) {
  // Already-assigned child tasks
  const [assigned, setAssigned] = useState<ChildTask[]>([])
  // Full task library from the org
  const [library, setLibrary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null) // taskId being assigned
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [childRes, libRes] = await Promise.all([
        apiClient.getChildTasks(orgId, childId),
        apiClient.getOrgContentTasks(orgId),
      ])
      setAssigned(childRes.tasks)
      setLibrary(libRes.tasks ?? [])
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [orgId, childId])

  useEffect(() => {
    load()
  }, [load])

  // Tasks already assigned — keyed by title for dedup check
  const assignedTitles = new Set(assigned.map((t) => t.title.toLowerCase().trim()))

  // Filtered library (exclude already assigned, apply search)
  const filtered = library.filter((task) => {
    if (assignedTitles.has((task.title ?? '').toLowerCase().trim())) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (task.title ?? '').toLowerCase().includes(q) ||
        (task.description ?? '').toLowerCase().includes(q) ||
        (task.category ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleAssign = async (task: any) => {
    setAssigning(task.id)
    setError('')
    try {
      await apiClient.createChildTask(orgId, childId, {
        title: task.title,
        description: task.description ?? undefined,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateTask'))
    } finally {
      setAssigning(null)
    }
  }

  const pending = assigned.filter((t) => t.status !== 'completed')
  const completed = assigned.filter((t) => t.status === 'completed')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* ── Left: task library ── */}
      <div className="xl:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('taskLibrary')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t('taskLibraryDescription')}</p>
          </div>
          {library.length === 0 && !loading && (
            <Link
              href={`/b2b/assignments?orgId=${orgId}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {t('createTasks')}
            </Link>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Search */}
        {library.length > 0 && (
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchTasksPlaceholder')}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : library.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <BookOpen className="w-9 h-9 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 mb-1">{t('emptyTaskLibrary')}</p>
            <p className="text-xs text-gray-400 mb-4">{t('emptyTaskLibraryDescription')}</p>
            <Link
              href={`/b2b/assignments?orgId=${orgId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 text-white text-xs font-semibold rounded-xl hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {t('goToAssignments')}
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">
              {search ? t('noTaskSearchResults') : t('allTasksAssigned')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task: any) => {
              const isAssigning = assigning === task.id
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:border-gray-200 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      {task.difficulty && (
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded border ${DIFFICULTY_STYLES[task.difficulty] ?? DIFFICULTY_STYLES.medium}`}
                        >
                          {t(
                            `difficulty${String(task.difficulty)[0].toUpperCase()}${String(task.difficulty).slice(1)}`
                          )}
                        </span>
                      )}
                      {task.category && (
                        <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                          {task.category}
                        </span>
                      )}
                      {task.estimatedDuration && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {t('durationMinutes', { minutes: task.estimatedDuration })}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAssign(task)}
                    disabled={isAssigning}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 text-xs font-semibold hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-colors disabled:opacity-50"
                  >
                    {isAssigning ? (
                      <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {t('assign')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: assigned tasks ── */}
      <div className="xl:col-span-2 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t('assignedToChild')}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{t('assignedToChildDescription')}</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 bg-white rounded-xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : assigned.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
            <CheckCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">{t('noAssignmentsYet')}</p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-gray-500">
                    {t('pendingCount', { count: pending.length })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {pending.map((task) => (
                    <TaskRow key={task.id} task={task} formatShortDate={formatShortDate} t={t} />
                  ))}
                </div>
              </div>
            )}
            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-semibold text-gray-500">
                    {t('completedCount', { count: completed.length })}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {completed.map((task) => (
                    <TaskRow key={task.id} task={task} formatShortDate={formatShortDate} t={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TaskRow({
  task,
  formatShortDate,
  t,
}: {
  task: ChildTask
  formatShortDate: (d: string) => string
  t: ReturnType<typeof useTranslations>
}) {
  const done = task.status === 'completed'
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
        done ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100 shadow-sm'
      }`}
    >
      {done ? (
        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-gray-300  mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}
        >
          {task.title}
        </p>
        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
        {task.submissionText && (
          <p className="text-xs text-gray-600 mt-1.5 italic pl-2 border-l-2 border-gray-200">
            "{task.submissionText}"
          </p>
        )}
        {task.fileUrl && (
          <a
            href={task.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-1"
          >
            <ExternalLink className="w-3 h-3" /> {t('viewAttachment')}
          </a>
        )}
        {(task.completedAt || task.submittedAt) && (
          <p className="text-xs text-gray-400 mt-1">
            {task.submittedAt
              ? t('submittedOn', { date: formatShortDate(task.submittedAt) })
              : t('completedOn', { date: formatShortDate(task.completedAt!) })}
          </p>
        )}
      </div>
      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
          done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {done ? t('statusCompleted') : t('statusPending')}
      </span>
    </div>
  )
}

// ── Tab: Guardians ────────────────────────────────────────────────────────────

const RELATIONSHIP_COLORS: Record<string, string> = {
  mother: 'bg-rose-50 text-rose-700 border-rose-100',
  father: 'bg-blue-50 text-blue-700 border-blue-100',
  guardian: 'bg-amber-50 text-amber-700 border-amber-100',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
}

function GuardianCard({
  guardian,
  onDelete,
  t,
}: {
  guardian: Guardian
  onDelete: (id: string) => void
  t: ReturnType<typeof useTranslations>
}) {
  const [deleting, setDeleting] = useState(false)
  const grad = avatarGradient(guardian.fullName)
  const relLabel = relationshipLabel(guardian.relationship, t) ?? guardian.relationship
  const relColor = RELATIONSHIP_COLORS[guardian.relationship] ?? RELATIONSHIP_COLORS.other

  const handleDelete = async () => {
    if (!confirm(t('deleteGuardianConfirm', { name: guardian.fullName }))) return
    setDeleting(true)
    onDelete(guardian.id)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}
        >
          <span className="text-white font-bold text-sm">{initials(guardian.fullName)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{guardian.fullName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${relColor}`}>
              {relLabel}
            </span>
            {guardian.isPrimaryContact && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3" /> {t('primaryContact')}
              </span>
            )}
            {guardian.isEmergencyContact && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" /> SOS
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          title={t('delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {(guardian.phone || guardian.whatsapp || guardian.email) && (
        <div className="px-5 pb-4 flex flex-wrap gap-3">
          {guardian.phone && (
            <a
              href={`tel:${guardian.phone}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-teal-700 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {guardian.phone}
            </a>
          )}
          {guardian.whatsapp && (
            <a
              href={`https://wa.me/${guardian.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-green-700 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {guardian.whatsapp}
            </a>
          )}
          {guardian.email && (
            <a
              href={`mailto:${guardian.email}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary-700 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {guardian.email}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function AddGuardianForm({
  orgId,
  childId,
  onAdded,
  t,
}: {
  orgId: string
  childId: string
  onAdded: (g: Guardian) => void
  t: ReturnType<typeof useTranslations>
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<GuardianInput>({
    fullName: '',
    relationship: 'mother',
    isPrimaryContact: false,
    isEmergencyContact: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (p: Partial<GuardianInput>) => setForm((prev) => ({ ...prev, ...p }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    setSaving(true)
    setError('')
    try {
      const g = await apiClient.addChildGuardian(orgId, childId, form)
      onAdded(g)
      setForm({
        fullName: '',
        relationship: 'mother',
        isPrimaryContact: false,
        isEmergencyContact: false,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('guardianSaveError'))
    } finally {
      setSaving(false)
    }
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors"
      >
        <Plus className="w-4 h-4" /> {t('addGuardian')}
      </button>
    )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">{t('newGuardian')}</h4>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            {t('guardianFullName')} *
          </label>
          <input
            value={form.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder={t('guardianFullNamePlaceholder')}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            {t('relationship')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['mother', 'father', 'guardian', 'other'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set({ relationship: r })}
                className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                  form.relationship === r
                    ? 'bg-teal-50 border-teal-400 text-teal-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {relationshipLabel(r, t)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('phone')}</label>
            <input
              value={form.phone ?? ''}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+996..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t('whatsapp')}
            </label>
            <input
              value={form.whatsapp ?? ''}
              onChange={(e) => set({ whatsapp: e.target.value })}
              placeholder="+996..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="example@mail.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrimaryContact}
              onChange={(e) => set({ isPrimaryContact: e.target.checked })}
              className="rounded text-primary-500"
            />
            <span className="text-xs text-gray-600">{t('primaryContact')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isEmergencyContact}
              onChange={(e) => set({ isEmergencyContact: e.target.checked })}
              className="rounded text-primary-500"
            />
            <span className="text-xs text-gray-600">{t('emergencyContact')}</span>
          </label>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !form.fullName.trim()}
            className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {saving ? t('saving') : t('add')}
          </button>
        </div>
      </form>
    </div>
  )
}

function GuardiansTab({
  orgId,
  childId,
  childDetail,
  t,
  formatShortDate,
}: {
  orgId: string
  childId: string
  childDetail: ChildDetail
  t: ReturnType<typeof useTranslations>
  formatShortDate: (d: string) => string
}) {
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(true)
  const parent = childDetail.parentInfo

  useEffect(() => {
    apiClient
      .getChildGuardians(orgId, childId)
      .then(setGuardians)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId, childId])

  const handleAdded = (g: Guardian) => setGuardians((prev) => [g, ...prev])
  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteChildGuardian(orgId, childId, id)
      setGuardians((prev) => prev.filter((g) => g.id !== id))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Connected parent from app */}
      {parent && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t('connectedViaApp')}
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient(parent.displayName || 'Parent')} flex items-center justify-center flex-shrink-0 shadow-sm`}
              >
                <span className="text-white font-bold text-sm">
                  {initials(parent.displayName || 'PA')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">{parent.displayName || '—'}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> {t('inApp')}
                  </span>
                </div>
                {parent.linkedAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('connectedSince')}: {formatShortDate(parent.linkedAt)}
                  </p>
                )}
              </div>
            </div>
            {parent.email && (
              <div className="px-5 pb-4 flex flex-wrap gap-3 border-t border-gray-50 pt-3">
                {parent.email && (
                  <a
                    href={`mailto:${parent.email}`}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary-700 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {parent.email}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manually added guardians */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {t('guardiansContactsTitle')}
        </p>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {guardians.map((g) => (
              <GuardianCard key={g.id} guardian={g} onDelete={handleDelete} t={t} />
            ))}
            <AddGuardianForm orgId={orgId} childId={childId} onAdded={handleAdded} t={t} />
          </div>
        )}
      </div>

      {/* No parent connected hint */}
      {!parent && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t('parentNotConnected')}</p>
              <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                {t('parentNotConnectedHint')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Intake ───────────────────────────────────────────────────────────────

function IntakeSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            {icon}
          </div>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-6 pb-6 pt-2 space-y-3">{children}</div>}
    </div>
  )
}

function IntakeRow({
  label,
  value,
  t,
  multi,
}: {
  label: string
  value?: string | boolean | string[] | number | null
  t: ReturnType<typeof useTranslations>
  multi?: boolean
}) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return (
      <div className="flex gap-3 py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 min-w-[180px] flex-shrink-0">{label}</span>
        <span className="text-xs text-gray-300 italic">—</span>
      </div>
    )
  }
  const display = formatValue(value, t)
  if (!display) return null

  return (
    <div
      className={`flex gap-3 py-1.5 border-b border-gray-50 last:border-0 ${multi ? 'flex-col' : ''}`}
    >
      <span className="text-xs text-gray-500 min-w-[180px] flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-900 break-words">{display}</span>
    </div>
  )
}

function IntakeTab({ orgId, childId }: { orgId: string; childId: string }) {
  const t = useTranslations('b2b.pages.childDetail')
  const locale = useLocale()
  const [intake, setIntake] = useState<ChildIntakeForm | null>(null)
  const [loading, setLoading] = useState(true)
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : 'en-US'

  useEffect(() => {
    apiClient
      .getChildIntake(orgId, childId)
      .then((data) => setIntake(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId, childId])

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )

  if (!intake)
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ClipboardList className="w-8 h-8 text-teal-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('intake.emptyTitle')}</h3>
        <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
          {t('intake.emptyDescriptionFull')}
        </p>
      </div>
    )

  const filledBy = relationshipLabel(intake.filledBy, t, intake.filledByOther)

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('intake.childIntake')}</h2>
          {intake.updatedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('intake.updatedAt', {
                date: new Date(intake.updatedAt).toLocaleDateString(dateLocale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
          {t('intake.completed')}
        </span>
      </div>

      {/* 1. General info */}
      <IntakeSection title={t('intake.generalInfo')} icon={<User className="w-4 h-4" />}>
        <IntakeRow label={t('intake.childFullName')} value={intake.childFullName} t={t} />
        <IntakeRow label={t('intake.dateOfBirth')} value={intake.dateOfBirth} t={t} />
        <IntakeRow label={t('intake.ageText')} value={intake.ageText} t={t} />
        <IntakeRow label={t('intake.homeAddress')} value={intake.homeAddress} t={t} />
        <IntakeRow label={t('intake.contactPhone')} value={intake.contactPhone} t={t} />
        <IntakeRow label={t('intake.filledBy')} value={filledBy} t={t} />
      </IntakeSection>

      {/* 2. Complaints */}
      <IntakeSection
        title={t('intake.complaints')}
        icon={<FileText className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.mainConcerns')} value={intake.mainConcerns} t={t} multi />
        <IntakeRow label={t('intake.firstNoticedAt')} value={intake.firstNoticedAt} t={t} />
        <IntakeRow
          label={t('intake.previousSpecialists')}
          value={intake.previousSpecialists}
          t={t}
        />
        {intake.previousSpecialistsOther && (
          <IntakeRow
            label={t('intake.previousSpecialistsOther')}
            value={intake.previousSpecialistsOther}
            t={t}
          />
        )}
      </IntakeSection>

      {/* 3. Pregnancy */}
      <IntakeSection
        title={t('intake.pregnancy')}
        icon={<Heart className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow
          label={t('intake.motherAgeAtPregnancy')}
          value={intake.motherAgeAtPregnancy}
          t={t}
        />
        <IntakeRow label={t('intake.pregnancyNumber')} value={intake.pregnancyNumber} t={t} />
        <IntakeRow label={t('intake.complications')} value={intake.pregnancyComplications} t={t} />
        <IntakeRow label={t('intake.pregnancyFactors')} value={intake.pregnancyFactors} t={t} />
        {intake.pregnancyFactorsOther && (
          <IntakeRow label={t('intake.otherFactors')} value={intake.pregnancyFactorsOther} t={t} />
        )}
        <IntakeRow
          label={t('intake.hospitalizations')}
          value={intake.pregnancyHospitalizations}
          t={t}
        />
        <IntakeRow label={t('intake.gestationWeeks')} value={intake.gestationWeeks} t={t} />
      </IntakeSection>

      {/* 4. Birth */}
      <IntakeSection
        title={t('intake.birth')}
        icon={<Baby className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.birthTypes')} value={intake.birthTypes} t={t} />
        <IntakeRow label={t('intake.complications')} value={intake.birthComplications} t={t} />
        <IntakeRow label={t('intake.birthFactors')} value={intake.birthFactors} t={t} />
        {intake.birthFactorsOther && (
          <IntakeRow label={t('intake.otherFactors')} value={intake.birthFactorsOther} t={t} />
        )}
        <IntakeRow label={t('intake.weightAtBirth')} value={intake.weightAtBirth} t={t} />
        <IntakeRow label={t('intake.heightAtBirth')} value={intake.heightAtBirth} t={t} />
        <IntakeRow label={t('intake.apgarScore')} value={intake.apgarScore} t={t} />
        <IntakeRow label={t('intake.criedImmediately')} value={intake.criedImmediately} t={t} />
        <IntakeRow
          label={t('intake.neededResuscitation')}
          value={intake.neededResuscitation}
          t={t}
        />
        <IntakeRow label={t('intake.inIncubator')} value={intake.inIncubator} t={t} />
        <IntakeRow label={t('intake.daysInHospital')} value={intake.daysInHospital} t={t} />
      </IntakeSection>

      {/* 5. Early development */}
      <IntakeSection
        title={t('intake.earlyDevelopment')}
        icon={<TrendingUp className="w-4 h-4" />}
        defaultOpen={false}
      >
        <p className="text-xs font-semibold text-gray-600 mb-2 mt-1">
          {t('intake.motorDevelopment')}
        </p>
        <IntakeRow label={t('intake.heldHeadAt')} value={intake.heldHeadAt} t={t} />
        <IntakeRow label={t('intake.rolledOverAt')} value={intake.rolledOverAt} t={t} />
        <IntakeRow label={t('intake.satAt')} value={intake.satAt} t={t} />
        <IntakeRow label={t('intake.crawledAt')} value={intake.crawledAt} t={t} />
        <IntakeRow label={t('intake.stoodAt')} value={intake.stoodAt} t={t} />
        <IntakeRow label={t('intake.walkedAt')} value={intake.walkedAt} t={t} />
        <IntakeRow label={t('intake.toneIssues')} value={intake.toneIssues} t={t} />
        <IntakeRow label={t('intake.neurologistBefore3')} value={intake.neurologistBefore3} t={t} />

        <p className="text-xs font-semibold text-gray-600 mb-2 mt-4">
          {t('intake.speechDevelopment')}
        </p>
        <IntakeRow label={t('intake.cooingAt')} value={intake.cooingAt} t={t} />
        <IntakeRow label={t('intake.babblingAt')} value={intake.babblingAt} t={t} />
        <IntakeRow label={t('intake.firstWordsAt')} value={intake.firstWordsAt} t={t} />
        <IntakeRow label={t('intake.phraseSpeechAt')} value={intake.phraseSpeechAt} t={t} />
        <IntakeRow label={t('intake.speechRegression')} value={intake.speechRegression} t={t} />
        <IntakeRow label={t('intake.understandsSpeech')} value={intake.understandsSpeech} t={t} />
        <IntakeRow label={t('intake.usesGestures')} value={intake.usesGestures} t={t} />
        <IntakeRow label={t('intake.hasEcholalia')} value={intake.hasEcholalia} t={t} />
        <IntakeRow label={t('intake.speechFeatures')} value={intake.speechFeatures} t={t} />

        <p className="text-xs font-semibold text-gray-600 mb-2 mt-4">
          {t('intake.socialDevelopment')}
        </p>
        <IntakeRow label={t('intake.eyeContact')} value={intake.eyeContact} t={t} />
        <IntakeRow label={t('intake.respondsToName')} value={intake.respondsToName} t={t} />
        <IntakeRow label={t('intake.likedCommunication')} value={intake.likedCommunication} t={t} />
        <IntakeRow label={t('intake.playedRoleGames')} value={intake.playedRoleGames} t={t} />
        <IntakeRow label={t('intake.behaviorFeatures')} value={intake.behaviorFeatures} t={t} />
        {intake.behaviorFeaturesOther && (
          <IntakeRow
            label={t('intake.behaviorFeaturesOther')}
            value={intake.behaviorFeaturesOther}
            t={t}
          />
        )}
      </IntakeSection>

      {/* 6. Health */}
      <IntakeSection
        title={t('intake.health')}
        icon={<Stethoscope className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.healthConditions')} value={intake.healthConditions} t={t} />
        {intake.healthConditionsOther && (
          <IntakeRow label={t('intake.other')} value={intake.healthConditionsOther} t={t} />
        )}
        <IntakeRow
          label={t('intake.hospitalizations')}
          value={intake.hospitalizations}
          t={t}
          multi
        />
        <IntakeRow
          label={t('intake.longTermMedications')}
          value={intake.longTermMedications}
          t={t}
          multi
        />
      </IntakeSection>

      {/* 7. Nutrition & sleep */}
      <IntakeSection
        title={t('intake.nutritionSleep')}
        icon={<Heart className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.breastfed')} value={intake.breastfed} t={t} />
        {intake.breastfed && (
          <IntakeRow label={t('intake.breastfedUntil')} value={intake.breastfedUntil} t={t} />
        )}
        <IntakeRow
          label={t('intake.feedingDifficulties')}
          value={intake.feedingDifficulties}
          t={t}
        />
        <IntakeRow label={t('intake.selectiveEating')} value={intake.selectiveEating} t={t} />
        <IntakeRow label={t('intake.sleepDisorders')} value={intake.sleepDisorders} t={t} />
        {intake.sleepDisorders && (
          <IntakeRow
            label={t('intake.sleepDisordersDescription')}
            value={intake.sleepDisordersDescription}
            t={t}
            multi
          />
        )}
      </IntakeSection>

      {/* 8. Family history */}
      <IntakeSection
        title={t('intake.familyHistory')}
        icon={<Users className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.familyConditions')} value={intake.familyConditions} t={t} />
        {intake.familyConditionsOther && (
          <IntakeRow label={t('intake.other')} value={intake.familyConditionsOther} t={t} />
        )}
        <IntakeRow
          label={t('intake.familyConditionsWho')}
          value={intake.familyConditionsWho}
          t={t}
          multi
        />
      </IntakeSection>

      {/* 9. Institutions */}
      <IntakeSection
        title={t('intake.institutions')}
        icon={<School className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow
          label={t('intake.attendedInstitutions')}
          value={intake.attendedInstitutions}
          t={t}
        />
        <IntakeRow
          label={t('intake.adaptationDescription')}
          value={intake.adaptationDescription}
          t={t}
          multi
        />
        <IntakeRow
          label={t('intake.groupDifficulties')}
          value={intake.groupDifficulties}
          t={t}
          multi
        />
      </IntakeSection>

      {/* 10. Self-care */}
      <IntakeSection
        title={t('intake.selfCare')}
        icon={<Award className="w-4 h-4" />}
        defaultOpen={false}
      >
        <IntakeRow label={t('intake.selfCareSkills')} value={intake.selfCareSkills} t={t} />
      </IntakeSection>

      {/* 11. Additional */}
      {intake.additionalInfo && (
        <IntakeSection
          title={t('intake.additionalInfo')}
          icon={<FileText className="w-4 h-4" />}
          defaultOpen={false}
        >
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {intake.additionalInfo}
          </p>
        </IntakeSection>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChildDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { currentOrgId } = useAuth()
  const childId = params.childId as string
  const orgId = searchParams.get('orgId') || currentOrgId || ''

  const [childDetail, setChildDetail] = useState<ChildDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const t = useTranslations('b2b.pages.childDetail')
  const locale = useLocale()
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'ky' ? 'ky-KG' : 'en-US'

  useEffect(() => {
    if (!orgId) {
      router.push('/b2b/children')
      return
    }
    const load = async () => {
      try {
        const [detail, tl] = await Promise.all([
          apiClient.getChildDetail(orgId, childId),
          apiClient.getTimeline(orgId, childId, 30),
        ])
        setChildDetail(detail)
        setTimeline(tl)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('failedToLoad'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId, childId, router, t])

  const formatShortDate = (d: string) => new Date(d).toLocaleDateString(dateLocale)

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const yest = new Date(now)
    yest.setDate(now.getDate() - 1)
    if (date.toDateString() === now.toDateString()) return t('today')
    if (date.toDateString() === yest.toDateString()) return t('yesterday')
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
  }

  const getFeedbackIcon = (mood: 'good' | 'ok' | 'hard') =>
    ({
      good: <Smile className="w-4 h-4 text-green-500" />,
      ok: <Meh className="w-4 h-4 text-amber-500" />,
      hard: <Frown className="w-4 h-4 text-red-500" />,
    })[mood]

  const getFeedbackLabel = (mood: 'good' | 'ok' | 'hard') =>
    ({ good: t('moodGood'), ok: t('moodOk'), hard: t('moodHard') })[mood]

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">{t('loadingProfile')}</p>
        </div>
      </div>
    )

  if (!childDetail)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('notFoundTitle')}</h3>
          <p className="text-sm text-gray-500 mb-4">{error || t('notFoundDescription')}</p>
          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {t('backToChildren')}
          </Link>
        </div>
      </div>
    )

  const grad = avatarGradient(childDetail.name)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-0">
          {/* Back */}
          <Link
            href={`/b2b/children?orgId=${orgId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToChildren')}
          </Link>

          {/* Child identity */}
          <div className="flex items-start gap-5 mb-5">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}
            >
              <span className="text-white font-bold text-xl">{initials(childDetail.name)}</span>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{childDetail.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {childDetail.age && (
                  <StatChip
                    icon={<User className="w-3.5 h-3.5" />}
                    label={t('age')}
                    value={childDetail.age}
                    color="gray"
                  />
                )}
                <StatChip
                  icon={<CheckCircle className="w-3.5 h-3.5" />}
                  label={t('tasksCompleted')}
                  value={childDetail.completedTasksCount}
                  color="teal"
                />
                {childDetail.speechStepNumber && (
                  <StatChip
                    icon={<Award className="w-3.5 h-3.5" />}
                    label={t('step')}
                    value={childDetail.speechStepNumber}
                    color="blue"
                  />
                )}
                {childDetail.parentInfo ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                    {t('parentConnected')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                    {t('noGuardianLinked')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex items-center gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            orgId={orgId}
            childId={childId}
            childDetail={childDetail}
            timeline={timeline}
            formatDate={formatDate}
            formatShortDate={formatShortDate}
            getFeedbackIcon={getFeedbackIcon}
            getFeedbackLabel={getFeedbackLabel}
            t={t}
          />
        )}

        {activeTab === 'activity' && (
          <div className="max-w-4xl">
            <ActivityFeed orgId={orgId} childId={childId} userRole="specialist" />
          </div>
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab orgId={orgId} childId={childId} t={t} formatShortDate={formatShortDate} />
        )}

        {activeTab === 'guardians' && (
          <GuardiansTab
            orgId={orgId}
            childId={childId}
            childDetail={childDetail}
            t={t}
            formatShortDate={formatShortDate}
          />
        )}
      </div>
    </div>
  )
}
