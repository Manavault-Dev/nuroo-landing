'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient, type SpecialistProfile, type ChildSummary } from '@/lib/b2b/api'
import {
  Users,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  UserCog,
  Activity,
  Clock,
  UserPlus,
  Sparkles,
  Target,
  ChevronRight,
} from 'lucide-react'
import { InviteModal } from '@/components/b2b/InviteModal'
import Assistant from './components/assistant'
import { useBranding } from '@/lib/b2b/brandingContext'
import { useLocale, useTranslations } from 'next-intl'
import { useAlert } from '@/components/ui/AlertDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatLastSeen(
  dateStr: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const days = daysSince(dateStr)
  if (days === null) return t('lastSeenNever')
  if (days === 0) return t('lastSeenToday')
  return t('lastSeenDaysAgo', { days })
}

function cropValue(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function buildHeroBackgroundStyle(
  coverImage?: string | null,
  borderTopColor?: string,
  crop?: { x?: number | null; y?: number | null; scale?: number | null }
) {
  const scale = cropValue(crop?.scale, 1)
  const backgroundImage = coverImage
    ? `linear-gradient(rgba(15,23,42,0.76), rgba(15,23,42,0.76)), linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px), url(${coverImage})`
    : 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #134e4a 100%)'

  const backgroundSize = coverImage
    ? `100% 100%, 34px 34px, 34px 34px, ${Math.round(scale * 100)}% auto`
    : '34px 34px, 34px 34px, 100% 100%'
  const backgroundPosition = coverImage
    ? `0 0, 0 0, 0 0, ${cropValue(crop?.x, 50)}% ${cropValue(crop?.y, 50)}%`
    : '0 0, 0 0, 0 0'

  return {
    backgroundColor: '#0f172a',
    backgroundImage,
    backgroundSize,
    backgroundPosition,
    borderTopWidth: borderTopColor ? '3px' : undefined,
    borderTopColor,
  } as const
}

type ChildStatus = 'active' | 'inactive' | 'new'

function getStatus(child: ChildSummary): ChildStatus {
  const d = daysSince(child.lastActiveDate)
  if (d === null) return 'new'
  if (d <= 7) return 'active'
  return 'inactive'
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-5 animate-pulse">
      <div className="h-52 bg-slate-200 rounded-2xl" />
      <div className="h-36 bg-teal-50 rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )
}

interface AdminActionCardData {
  icon: React.ElementType
  value: string
  label: string
  detail: string
  href?: string
  action: string
  severity: 'alert' | 'info' | 'success'
}

function AdminActionCard({ card, brandColor }: { card: AdminActionCardData; brandColor: string }) {
  const t = useTranslations('b2b.pages.dashboard')
  const Icon = card.icon
  const palette =
    card.severity === 'alert'
      ? {
          badge: 'bg-amber-50 text-amber-700',
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          label: t('needsAction'),
        }
      : card.severity === 'success'
        ? {
            badge: 'bg-emerald-50 text-emerald-700',
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            label: t('healthy'),
          }
        : {
            badge: 'bg-sky-50 text-sky-700',
            iconBg: 'bg-sky-50',
            iconColor: 'text-sky-600',
            label: t('monitor'),
          }

  const inner = (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${palette.iconBg}`}>
          <Icon className={`w-5 h-5 ${palette.iconColor}`} />
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full ${palette.badge}`}
        >
          {palette.label}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-3xl font-bold text-slate-900 leading-none tabular-nums">{card.value}</p>
        <p className="text-sm font-semibold text-slate-900 mt-2">{card.label}</p>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{card.detail}</p>
      </div>

      <div className="mt-5">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ background: `${brandColor}14`, color: brandColor }}
        >
          {card.action}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  )

  return card.href ? (
    <Link href={card.href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}

// ── Health Card ───────────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  unit,
  trend,
  trendLabel,
  color,
  icon: Icon,
  href,
}: {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  color: 'teal' | 'amber' | 'emerald' | 'blue' | 'slate'
  icon: React.ElementType
  href?: string
}) {
  const palette = {
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    slate: { bg: 'bg-slate-100', icon: 'text-slate-500' },
  }[color]

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity
  const trendColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-amber-600' : 'text-slate-400'

  const inner = (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all cursor-default group-hover:border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-lg ${palette.bg}`}>
          <Icon className={`w-4 h-4 ${palette.icon}`} />
        </div>
        {trend && trendLabel && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{trendLabel}</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
        {value}
        {unit && <span className="text-lg font-semibold text-slate-400 ml-0.5">{unit}</span>}
      </p>
      <p className="text-xs font-semibold text-slate-400 mt-2 uppercase tracking-wider">{label}</p>
    </div>
  )

  if (href)
    return (
      <Link href={href} className="group">
        {inner}
      </Link>
    )
  return inner
}

// ── Premium Student Row ───────────────────────────────────────────────────────

function StudentRow({ child, orgId }: { child: ChildSummary; orgId: string }) {
  const t = useTranslations('b2b.pages.dashboard')
  const status = getStatus(child)
  const days = daysSince(child.lastActiveDate)
  const statusStyle = {
    active: {
      dot: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      label: t('statusActive'),
    },
    inactive: {
      dot: 'bg-amber-400',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      label: t('statusInactive'),
    },
    new: { dot: 'bg-sky-400', bg: 'bg-sky-50', text: 'text-sky-700', label: t('statusNew') },
  }[status]

  return (
    <Link
      href={`/b2b/children/${child.id}?orgId=${orgId}`}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group border-b border-gray-50 last:border-0"
    >
      <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 font-semibold text-sm flex items-center justify-center shrink-0 select-none">
        {getInitials(child.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 truncate">{child.name}</span>
          {child.age !== undefined && (
            <span className="text-xs text-slate-400 shrink-0">
              {t('ageYearsShort', { age: child.age })}
            </span>
          )}
        </div>
        {child.speechStepNumber && (
          <p className="text-xs text-slate-400 mt-0.5">
            {t('therapyStep', { step: child.speechStepNumber })}
          </p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
          {statusStyle.label}
        </span>
        <span className="text-xs text-slate-400 w-16 text-right tabular-nums">
          {days === null
            ? t('lastSeenNever')
            : days === 0
              ? t('lastSeenToday')
              : t('lastSeenDaysAgo', { days })}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-500 w-12 justify-end">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="tabular-nums font-medium">{child.completedTasksCount}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
    </Link>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations('b2b.pages.dashboard')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [teamCount, setTeamCount] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [currentOrgId, setCurrentOrgId] = useState<string | undefined>()
  const { alert } = useAlert()

  useEffect(() => {
    const load = async () => {
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
        try {
          const session = await apiClient.getSession()
          if (!session.hasOrg) {
            router.push('/b2b/onboarding')
            return
          }
        } catch {}
        const profileData = await apiClient.getMe()
        setProfile(profileData)
        const orgId = searchParams.get('orgId') || profileData.organizations[0]?.orgId
        setCurrentOrgId(orgId)
        if (!orgId) {
          router.push('/b2b/onboarding')
          return
        }
        const selectedOrg =
          profileData.organizations.find((o) => o.orgId === orgId) || profileData.organizations[0]
        const isAdmin = selectedOrg?.role === 'admin'
        const [childrenData, teamData, reportsData] = await Promise.all([
          apiClient.getChildren(orgId),
          isAdmin ? apiClient.getTeam(orgId).catch(() => []) : Promise.resolve([]),
          apiClient.getReports(orgId, 7).catch(() => null),
        ])
        setChildren(childrenData)
        setTeamCount(Array.isArray(teamData) ? teamData.length : 0)
        if (reportsData?.childCompletion.length) {
          const avg = Math.round(
            reportsData.childCompletion.reduce((s, c) => s + c.percent, 0) /
              reportsData.childCompletion.length
          )
          setAvgCompletion(avg)
        }
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, searchParams])

  const { branding } = useBranding()

  if (loading) return <DashboardSkeleton />

  const orgId = searchParams.get('orgId') || profile?.organizations[0]?.orgId || currentOrgId
  const currentOrg =
    profile?.organizations.find((o) => o.orgId === orgId) || profile?.organizations[0]
  const isAdmin = currentOrg?.role === 'admin'
  const firstName = profile?.name?.split(' ')[0] || t('there')

  const activeCount = children.filter((c) => (daysSince(c.lastActiveDate) ?? 99) <= 7).length
  const inactiveCount = children.filter((c) => (daysSince(c.lastActiveDate) ?? 99) > 14).length
  const neverActive = children.filter((c) => !c.lastActiveDate).length
  const totalTasks = children.reduce((s, c) => s + c.completedTasksCount, 0)
  const brandPrimary = branding?.primaryColor || '#14b8a6'
  const orgName = branding?.name || currentOrg?.orgName || t('yourCenter')
  const orgMission = branding?.description || t('orgMissionFallback')
  const coverImage = branding?.coverImage
  const coverCrop = {
    x: branding?.coverPositionX,
    y: branding?.coverPositionY,
    scale: branding?.coverScale,
  }
  const handleAssistantCommandExecuted = () => undefined

  // ── Specialist action cards (derived from real operational data) ──────────
  const specialistActionCards: AdminActionCardData[] = []
  if (inactiveCount > 0) {
    specialistActionCards.push({
      icon: Clock,
      value: String(inactiveCount),
      label: t('childrenInactive14Days'),
      detail: t('childrenInactive14DaysDetail'),
      href: `/b2b/children?orgId=${orgId}`,
      action: t('followUp'),
      severity: 'alert',
    })
  }
  if (avgCompletion !== null && avgCompletion < 80) {
    specialistActionCards.push({
      icon: Target,
      value: `${avgCompletion}%`,
      label: t('homeworkCompletion'),
      detail: t('homeworkCompletionDetail'),
      href: `/b2b/reports?orgId=${orgId}`,
      action: t('openReports'),
      severity: avgCompletion < 60 ? 'alert' : 'info',
    })
  }
  if (neverActive > 0) {
    specialistActionCards.push({
      icon: UserPlus,
      value: String(neverActive),
      label: t('awaitingActivation'),
      detail: t('familiesNotActivatedDetail'),
      href: `/b2b/invites?orgId=${orgId}`,
      action: t('sendInvite'),
      severity: 'info',
    })
  }
  if (specialistActionCards.length === 0) {
    specialistActionCards.push({
      icon: CheckCircle2,
      value: String(activeCount),
      label: t('activeThisWeekMetric'),
      detail: t('specialistAllClearDetail'),
      href: `/b2b/reports?orgId=${orgId}`,
      action: t('viewReports'),
      severity: 'success',
    })
  }

  // ── ADMIN VIEW ────────────────────────────────────────────────────────────

  if (isAdmin && currentOrg) {
    const awaitingActivationChildren = children.filter((c) => !c.lastActiveDate).slice(0, 5)
    const recentlyActiveChildren = [...children]
      .filter((c) => c.lastActiveDate)
      .sort(
        (a, b) =>
          new Date(b.lastActiveDate as string).getTime() -
          new Date(a.lastActiveDate as string).getTime()
      )
      .slice(0, 5)
    const adminActionCards: AdminActionCardData[] = []

    if (inactiveCount > 0) {
      adminActionCards.push({
        icon: Clock,
        value: String(inactiveCount),
        label: t('childrenInactive14Days'),
        detail: t('childrenInactive14DaysDetail'),
        href: `/b2b/children?orgId=${orgId}`,
        action: t('reviewChildren'),
        severity: 'alert',
      })
    }

    if (avgCompletion !== null && avgCompletion < 80) {
      adminActionCards.push({
        icon: Target,
        value: `${avgCompletion}%`,
        label: t('homeworkCompletion'),
        detail: t('homeworkCompletionDetail'),
        href: `/b2b/reports?orgId=${orgId}`,
        action: t('openReports'),
        severity: avgCompletion < 60 ? 'alert' : 'info',
      })
    }

    if (teamCount === 0) {
      adminActionCards.push({
        icon: UserCog,
        value: '0',
        label: t('specialistsOnTeam'),
        detail: t('specialistsOnTeamDetail'),
        href: `/b2b/team?orgId=${orgId}`,
        action: t('inviteSpecialist'),
        severity: 'alert',
      })
    }

    if (adminActionCards.length === 0) {
      adminActionCards.push({
        icon: CheckCircle2,
        value: '0',
        label: t('urgentIssuesNow'),
        detail: t('urgentIssuesNowDetail'),
        href: `/b2b/reports?orgId=${orgId}`,
        action: t('viewReports'),
        severity: 'success',
      })
    }

    return (
      <div className="w-full p-5 lg:p-8 space-y-5">
        {/* ── Hero ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={buildHeroBackgroundStyle(coverImage, undefined, coverCrop)}
        >
          <div className="px-6 py-7 lg:px-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">
                  {t('executiveOperations')}
                </p>
                <h1 className="text-2xl font-bold text-white leading-tight">{orgName}</h1>
                <p className="text-sm text-slate-400 mt-1 line-clamp-1">{orgMission}</p>
              </div>
              <p className="hidden sm:block shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm backdrop-blur-sm">
                {new Date().toLocaleDateString(locale, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* 4 focused metrics — no vanity numbers */}
            {children.length === 0 && teamCount === 0 ? (
              <div className="flex items-center gap-4 py-3.5 px-4 bg-white/[0.07] rounded-xl border border-white/[0.08]">
                <UserPlus className="w-5 h-5 text-teal-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{t('readyToOnboardFamilies')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('readyToOnboardFamiliesDetail')}
                  </p>
                </div>
                <Link
                  href={`/b2b/invites?orgId=${orgId}`}
                  className="text-sm font-semibold px-4 py-2 rounded-lg text-white shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: brandPrimary }}
                >
                  {t('getStarted')}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.08] rounded-xl overflow-hidden">
                {[
                  {
                    label: t('specialistsMetric'),
                    value: teamCount > 0 ? teamCount : '—',
                    warn: false,
                    accent: teamCount > 0,
                  },
                  {
                    label: t('studentsMetric'),
                    value: children.length,
                    warn: false,
                    accent: false,
                  },
                  {
                    label: t('activeThisWeekMetric'),
                    value: activeCount,
                    warn: false,
                    accent: activeCount > 0,
                  },
                  {
                    label: t('tasksDoneMetric'),
                    value: totalTasks,
                    warn: false,
                    accent: totalTasks > 0,
                  },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-900 px-5 py-4 text-center">
                    <p
                      className="text-2xl font-bold leading-none tabular-nums"
                      style={{ color: m.warn ? '#fbbf24' : m.accent ? brandPrimary : '#f8fafc' }}
                    >
                      {m.value}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-2 uppercase tracking-wider">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Priority Actions (AI) ── */}
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${brandPrimary}14` }}
              >
                <Sparkles className="w-4 h-4" style={{ color: brandPrimary }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('priorityActions')}</h2>
                <p className="text-sm text-slate-500">{t('priorityActionsDesc')}</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
              {t('prioritiesCount', { count: adminActionCards.length })}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {adminActionCards.map((card) => (
              <AdminActionCard
                key={`${card.label}-${card.value}`}
                card={card}
                brandColor={brandPrimary}
              />
            ))}
          </div>
        </div>

        {/* ── Family Snapshot ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('familySnapshot')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {children.length > 0
                  ? t('enrolledCount', { count: children.length })
                  : t('noStudentsYet')}
              </p>
            </div>
            {children.length > 0 && (
              <Link
                href={`/b2b/children?orgId=${orgId}`}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                {t('viewAll')} <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {children.length === 0 ? (
            <div className="text-center py-14 px-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${brandPrimary}12` }}
              >
                <Users className="w-6 h-6" style={{ color: brandPrimary }} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {t('readyToOnboardFamilies')}
              </h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto mb-5">
                {t('shareInviteCodeWithParents')}
              </p>
              <Link
                href={`/b2b/invites?orgId=${orgId}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: brandPrimary }}
              >
                <UserPlus className="w-4 h-4" />
                {t('createInviteCode')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-gray-100">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t('awaitingActivation')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t('awaitingActivationDesc')}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    {neverActive}
                  </span>
                </div>
                {awaitingActivationChildren.length > 0 ? (
                  <div className="space-y-2">
                    {awaitingActivationChildren.map((child) => (
                      <Link
                        key={child.id}
                        href={`/b2b/children/${child.id}?orgId=${orgId}`}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-slate-50 transition-colors group"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: `${brandPrimary}12`, color: brandPrimary }}
                        >
                          {getInitials(child.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {child.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {child.age !== undefined
                              ? t('ageYearsShort', { age: child.age })
                              : t('profileAdded')}{' '}
                            · {t('notActiveYet')}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-amber-600 shrink-0">
                          {t('welcome')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      {t('noPendingActivations')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{t('newFamilySignupsAppear')}</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{t('recentActivity')}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t('recentActivityDesc')}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {t('latestFirst')}
                  </span>
                </div>
                {recentlyActiveChildren.length > 0 ? (
                  <div className="space-y-2">
                    {recentlyActiveChildren.map((child) => (
                      <Link
                        key={child.id}
                        href={`/b2b/children/${child.id}?orgId=${orgId}`}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-slate-50 transition-colors group"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: `${brandPrimary}12`, color: brandPrimary }}
                        >
                          {getInitials(child.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {child.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {t('lastSeenWithValue', {
                              value: formatLastSeen(child.lastActiveDate, t),
                            })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">
                            {child.completedTasksCount}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">
                            {t('tasksMetric')}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-800">{t('noRecentActivity')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('recentActivityWillAppear')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {orgId && (
          <Assistant
            orgId={orgId}
            locale={locale}
            onCommandExecuted={handleAssistantCommandExecuted}
          />
        )}
      </div>
    )
  }

  // ── SPECIALIST WORKSPACE ──────────────────────────────────────────────────

  const handleInviteParent = async () => {
    try {
      const idToken = await getIdToken()
      if (!idToken) {
        router.push('/b2b/login')
        return
      }
      apiClient.setToken(idToken)
      const invite = await apiClient.createParentInvite(orgId!)
      setInviteCode(invite.inviteCode)
      setInviteModalOpen(true)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('failedCreateInviteCode'), { type: 'error' })
    }
  }

  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('goodMorning') : hour < 18 ? t('goodAfternoon') : t('goodEvening')
  return (
    <div className="w-full p-5 lg:p-8 space-y-5">
      {/* ── Specialist Workspace Header — matches admin dark style ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={buildHeroBackgroundStyle(coverImage, brandPrimary, coverCrop)}
      >
        <div className="px-6 py-7 lg:px-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">
              {t('therapyWorkspace')}
            </p>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-slate-400 mt-1">{today}</p>
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-slate-300">
                  {t('activeThisWeekSummary', { count: activeCount })}
                </span>
              </div>
              {inactiveCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-400">
                    {t('needFollowUpSummary', { count: inactiveCount })}
                  </span>
                </div>
              )}
              <span className="text-xs text-slate-500">
                {t('studentsTotal', { count: children.length })}
              </span>
            </div>
          </div>
          {currentOrg && (
            <button
              onClick={handleInviteParent}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.1] hover:bg-white/[0.16] border border-white/[0.12] rounded-lg text-sm font-medium text-white transition-all shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              {t('inviteParent')}
            </button>
          )}
        </div>
      </div>

      {/* ── Priority Actions (Specialist) ── */}
      <div className="bg-gradient-to-br from-teal-50 via-emerald-50/50 to-cyan-50 border border-teal-100 rounded-2xl px-6 py-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('priorityActions')}</h2>
              <p className="text-xs text-slate-500">{t('priorityActionsDesc')}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 text-slate-600 text-xs font-semibold rounded-full">
            {t('prioritiesCount', { count: specialistActionCards.length })}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {specialistActionCards.map((card) => (
            <AdminActionCard
              key={`${card.label}-${card.value}`}
              card={card}
              brandColor={brandPrimary}
            />
          ))}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HealthCard
          icon={Users}
          label={t('myStudents')}
          value={children.length}
          color="teal"
          href={currentOrg ? `/b2b/children?orgId=${currentOrg.orgId}` : undefined}
        />
        <HealthCard
          icon={Activity}
          label={t('activeThisWeekMetric')}
          value={activeCount}
          color="emerald"
          trend={activeCount > 0 ? 'up' : 'neutral'}
          trendLabel={
            children.length ? `${Math.round((activeCount / children.length) * 100)}%` : undefined
          }
        />
        <HealthCard
          icon={Clock}
          label={t('needAttention')}
          value={inactiveCount}
          color={inactiveCount > 0 ? 'amber' : 'emerald'}
          trend={inactiveCount > 0 ? 'down' : 'up'}
          trendLabel={inactiveCount > 0 ? t('daysIdle14Plus') : t('allClear')}
          href={currentOrg ? `/b2b/children?orgId=${currentOrg.orgId}` : undefined}
        />
      </div>

      {/* ── Student Roster ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('assignedStudents')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('therapyCaseload', { count: children.length })}
            </p>
          </div>
          {currentOrg && (
            <Link
              href={`/b2b/children?orgId=${currentOrg.orgId}`}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              {t('allStudents')} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {children.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: `${brandPrimary}12` }}
            >
              <Users className="w-6 h-6" style={{ color: brandPrimary }} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">{t('yourCaseloadIsEmpty')}</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto mb-5">
              {t('shareInviteCodeForTherapy')}
            </p>
            <button
              onClick={handleInviteParent}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: brandPrimary }}
            >
              <UserPlus className="w-4 h-4" />
              {t('inviteFirstFamily')}
            </button>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2.5 bg-slate-50 border-b border-gray-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {t('studentColumn')}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 text-center">
                {t('statusColumn')}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 text-right">
                {t('lastSeenColumn')}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-12 text-right">
                {t('tasksColumn')}
              </span>
            </div>
            {children.map((child) => (
              <StudentRow key={child.id} child={child} orgId={orgId!} />
            ))}
          </>
        )}
      </div>

      {inviteCode && orgId && (
        <InviteModal
          isOpen={inviteModalOpen}
          onClose={() => {
            setInviteModalOpen(false)
            setInviteCode(null)
          }}
          inviteCode={inviteCode}
          orgId={orgId}
        />
      )}

      {orgId && (
        <Assistant
          orgId={orgId}
          locale={locale}
          onCommandExecuted={handleAssistantCommandExecuted}
        />
      )}
    </div>
  )
}
