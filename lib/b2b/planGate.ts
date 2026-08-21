/**
 * Feature gating for Nuroo vs Nuroo Business.
 *
 * Usage:
 *   const { can, isBusiness, plan } = usePlanGate()
 *   if (!can('team_management')) return <UpgradeScreen feature="team_management" />
 *
 * Architecture:
 *   - plan ('nuroo' | 'nuroo_business') is stored in Firestore org.nurooPlan
 *   - The backend returns it on GET /me inside organizations[].nurooPlan
 *   - Legacy orgs without nurooPlan default to 'nuroo_business' (full access)
 *   - Trial status does NOT change nurooPlan — it only affects billing limits
 */

import { useAuth } from './AuthContext'

export type NurooPlan = 'nuroo' | 'nuroo_business'
export type MemberRole = 'independent_specialist' | 'org_admin' | 'org_specialist'

/** Features locked to Nuroo Business */
export const BUSINESS_ONLY_FEATURES = [
  'team_management',
  'org_children',
  'team_schedule',
  'attendance',
  'assignments_progress',
  'org_finance',
  'reports',
  'analytics',
  'branches',
  'advanced_crm',
] as const

export type BusinessFeature = (typeof BUSINESS_ONLY_FEATURES)[number]

/** Human-readable labels for upgrade screens */
export const FEATURE_LABELS: Record<BusinessFeature, { title: string; description: string }> = {
  team_management: {
    title: 'Управление командой',
    description: 'Добавляйте специалистов, управляйте ролями и расписанием всей команды.',
  },
  org_children: {
    title: 'Клиенты организации',
    description: 'Единая база детей и клиентов на уровне всей организации с историей.',
  },
  team_schedule: {
    title: 'Расписание команды',
    description: 'Видьте расписание всех специалистов в одном месте и управляйте нагрузкой.',
  },
  attendance: {
    title: 'Посещаемость',
    description: 'Отмечайте посещаемость занятий и отслеживайте пропуски.',
  },
  assignments_progress: {
    title: 'Задания и прогресс',
    description: 'Давайте домашние задания и отслеживайте прогресс каждого ребёнка.',
  },
  org_finance: {
    title: 'Финансы организации',
    description: 'Учёт доходов, расходов и задолженностей клиентов на уровне организации.',
  },
  reports: {
    title: 'Отчёты',
    description: 'Готовые отчёты по занятиям, оплатам и клиентской базе.',
  },
  analytics: {
    title: 'Аналитика',
    description: 'Дашборд с ключевыми метриками вашей организации.',
  },
  branches: {
    title: 'Несколько филиалов',
    description: 'Управляйте несколькими локациями в одном аккаунте.',
  },
  advanced_crm: {
    title: 'Расширенный CRM',
    description: 'Теги, заметки, история коммуникаций и воронки для работы с клиентами.',
  },
}

/**
 * Resolve nurooPlan from the current org entry inside SpecialistProfile.
 * Falls back to 'nuroo_business' for legacy orgs (created before the field existed).
 */
function resolveNurooPlan(
  profile: ReturnType<typeof useAuth>['profile'],
  currentOrgId: string | null
): NurooPlan {
  if (!profile) return 'nuroo_business' // optimistic while loading

  const org = currentOrgId
    ? profile.organizations.find((o) => o.orgId === currentOrgId)
    : profile.organizations[0]

  const raw = org?.nurooPlan
  if (raw === 'nuroo' || raw === 'nuroo_business') return raw

  // Legacy org: no nurooPlan stored → grant full business access
  return 'nuroo_business'
}

export function usePlanGate(): {
  plan: NurooPlan
  isBusiness: boolean
  isNuroo: boolean
  can: (feature: BusinessFeature) => boolean
} {
  const { profile, currentOrgId } = useAuth()
  const plan = resolveNurooPlan(profile, currentOrgId ?? null)
  const isBusiness = plan === 'nuroo_business'

  return {
    plan,
    isBusiness,
    isNuroo: !isBusiness,
    can: (_feature: BusinessFeature) => isBusiness,
  }
}
