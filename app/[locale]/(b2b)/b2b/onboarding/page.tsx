'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import {
  AlertCircle,
  Loader2,
  Key,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Building2,
  Palette,
  FlaskConical,
  Music,
  Brain,
  MessageCircle,
  Dumbbell,
  BookOpen,
  HandHeart,
  Music2,
  Languages,
  Castle,
  Code2,
  Cpu,
  Theater,
  Waves,
  CalendarDays,
  CreditCard,
  Users,
  BarChart3,
  MapPin,
  Wallet,
  UserCircle,
  Video,
  Bell,
  Megaphone,
  Baby,
  ClipboardList,
  Mail,
  type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import { Select } from '@/components/ui/Select'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import { useAuth } from '@/lib/b2b/AuthContext'
import { getWorkspacePath, type B2bOrgMembership } from '@/src/config/routes'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'info' | 'category' | 'goals' | 'result' | 'setup' | 'invite'

interface GoalItem {
  id: string
  label: string
  isBusiness: boolean
  icon: LucideIcon
  color: string
}

// ── Data ─────────────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { value: 'kg', label: '🇰🇬 Кыргызстан' },
  { value: 'kz', label: '🇰🇿 Казахстан' },
  { value: 'ru', label: '🇷🇺 Россия' },
  { value: 'uz', label: '🇺🇿 Узбекистан' },
  { value: 'other', label: '🌍 Другая страна' },
]

const CITIES_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  kg: [
    { value: 'bishkek', label: 'Бишкек' },
    { value: 'osh', label: 'Ош' },
    { value: 'jalal-abad', label: 'Жалал-Абад' },
    { value: 'karakol', label: 'Каракол' },
    { value: 'tokmok', label: 'Токмок' },
    { value: 'naryn', label: 'Нарын' },
    { value: 'talas', label: 'Талас' },
  ],
  kz: [
    { value: 'almaty', label: 'Алматы' },
    { value: 'astana', label: 'Астана' },
    { value: 'shymkent', label: 'Шымкент' },
    { value: 'karaganda', label: 'Караганда' },
  ],
  ru: [
    { value: 'moscow', label: 'Москва' },
    { value: 'saint-petersburg', label: 'Санкт-Петербург' },
    { value: 'novosibirsk', label: 'Новосибирск' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
  ],
  uz: [
    { value: 'tashkent', label: 'Ташкент' },
    { value: 'samarkand', label: 'Самарканд' },
    { value: 'namangan', label: 'Наманган' },
  ],
  other: [{ value: 'other', label: 'Другой город' }],
}

interface Category {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

const CATEGORIES: Category[] = [
  { id: 'art', label: 'Арт и творчество', icon: Palette, color: 'bg-pink-50 text-pink-500' },
  { id: 'stem', label: 'STEM / Наука', icon: FlaskConical, color: 'bg-blue-50 text-blue-500' },
  { id: 'music', label: 'Музыка', icon: Music, color: 'bg-violet-50 text-violet-500' },
  { id: 'psychology', label: 'Психология', icon: Brain, color: 'bg-rose-50 text-rose-500' },
  { id: 'speech', label: 'Логопедия', icon: MessageCircle, color: 'bg-teal-50 text-teal-500' },
  { id: 'sport', label: 'Спорт', icon: Dumbbell, color: 'bg-orange-50 text-orange-500' },
  {
    id: 'school',
    label: 'Подготовка к школе',
    icon: BookOpen,
    color: 'bg-amber-50 text-amber-500',
  },
  { id: 'aba', label: 'ABA / Дефектология', icon: HandHeart, color: 'bg-green-50 text-green-500' },
  { id: 'dance', label: 'Танцы', icon: Music2, color: 'bg-fuchsia-50 text-fuchsia-500' },
  { id: 'languages', label: 'Языки', icon: Languages, color: 'bg-sky-50 text-sky-500' },
  { id: 'chess', label: 'Шахматы', icon: Castle, color: 'bg-slate-50 text-slate-500' },
  { id: 'coding', label: 'Программирование', icon: Code2, color: 'bg-indigo-50 text-indigo-500' },
  { id: 'robotics', label: 'Робототехника', icon: Cpu, color: 'bg-cyan-50 text-cyan-500' },
  {
    id: 'theater',
    label: 'Театр / Актёрство',
    icon: Theater,
    color: 'bg-purple-50 text-purple-500',
  },
  { id: 'swimming', label: 'Плавание', icon: Waves, color: 'bg-blue-50 text-blue-400' },
  { id: 'other', label: 'Другое', icon: Sparkles, color: 'bg-gray-50 text-gray-400' },
]

const GOALS: GoalItem[] = [
  // Nuroo (базовый)
  {
    id: 'booking',
    label: 'Онлайн-запись и календарь',
    isBusiness: false,
    icon: CalendarDays,
    color: 'bg-teal-50 text-teal-500',
  },
  {
    id: 'payments',
    label: 'Приём оплат онлайн',
    isBusiness: false,
    icon: CreditCard,
    color: 'bg-green-50 text-green-500',
  },
  {
    id: 'groups',
    label: 'Группы, курсы и программы',
    isBusiness: false,
    icon: Users,
    color: 'bg-blue-50 text-blue-500',
  },
  {
    id: 'meet',
    label: 'Онлайн-консультации и Google Meet',
    isBusiness: false,
    icon: Video,
    color: 'bg-sky-50 text-sky-500',
  },
  {
    id: 'promotion',
    label: 'Продвижение услуг и привлечение клиентов',
    isBusiness: false,
    icon: Megaphone,
    color: 'bg-pink-50 text-pink-500',
  },
  {
    id: 'notifications',
    label: 'Автоматические уведомления клиентам',
    isBusiness: false,
    icon: Bell,
    color: 'bg-amber-50 text-amber-500',
  },
  {
    id: 'emails',
    label: 'Письма о записи, оплате и изменениях',
    isBusiness: false,
    icon: Mail,
    color: 'bg-orange-50 text-orange-500',
  },
  {
    id: 'children',
    label: 'Клиентская база',
    isBusiness: false,
    icon: Baby,
    color: 'bg-rose-50 text-rose-500',
  },
  {
    id: 'solo',
    label: 'Работаю самостоятельно',
    isBusiness: false,
    icon: UserCircle,
    color: 'bg-gray-50 text-gray-400',
  },
  // Nuroo Business
  {
    id: 'team',
    label: 'Управление командой специалистов',
    isBusiness: true,
    icon: Building2,
    color: 'bg-violet-50 text-violet-500',
  },
  {
    id: 'crm',
    label: 'Управление детьми и клиентами',
    isBusiness: true,
    icon: Baby,
    color: 'bg-rose-50 text-rose-500',
  },
  {
    id: 'attendance',
    label: 'Посещаемость, задания и прогресс',
    isBusiness: true,
    icon: ClipboardList,
    color: 'bg-indigo-50 text-indigo-500',
  },
  {
    id: 'reports',
    label: 'Отчёты и аналитика',
    isBusiness: true,
    icon: BarChart3,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    id: 'finance',
    label: 'Финансы организации',
    isBusiness: true,
    icon: Wallet,
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    id: 'branches',
    label: 'Несколько филиалов',
    isBusiness: true,
    icon: MapPin,
    color: 'bg-orange-50 text-orange-500',
  },
]

// ── Progress bar ─────────────────────────────────────────────────────────────

const WIZARD_STEPS: Step[] = ['info', 'category', 'goals', 'result']

function ProgressBar({ current }: { current: Step }) {
  const idx = WIZARD_STEPS.indexOf(current)
  if (idx === -1) return null
  return (
    <div className="flex items-center gap-1 mb-6">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < idx
                ? 'bg-primary-600 text-white'
                : i === idx
                  ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-sm shadow-primary-200'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i < idx ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 rounded-full transition-all ${i < idx ? 'bg-primary-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { refreshProfile } = useAuth()

  // Wizard state
  const [step, setStep] = useState<Step>('info')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  // Action state
  const [inviteCode, setInviteCode] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Derived
  const needsBusiness = selectedGoals.some((id) => GOALS.find((g) => g.id === id)?.isBusiness)

  const ensureToken = async () => {
    const user = getCurrentUser()
    if (!user) {
      router.push('/b2b/login')
      return null
    }
    const token = await getIdToken()
    if (!token) {
      router.push('/b2b/login')
      return null
    }
    apiClient.setToken(token)
    return token
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const code = inviteCode.trim()
    if (!code) return setError('Введите код приглашения')
    setLoading(true)
    try {
      const token = await ensureToken()
      if (!token) return
      const result = await apiClient.acceptInvite(code)
      apiClient.clearCache()
      const refreshedToken = await getIdToken(true)
      if (refreshedToken) apiClient.setToken(refreshedToken)
      await refreshProfile({ force: true })
      const membership: B2bOrgMembership = {
        orgId: result.orgId,
        role: result.role === 'specialist' ? 'specialist' : 'admin',
      }
      router.replace(getWorkspacePath(membership))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось принять приглашение')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const name = orgName.trim()
    if (!name) return setError('Введите название')
    setLoading(true)
    try {
      const token = await ensureToken()
      if (!token) return
      const plan = needsBusiness ? 'nuroo_business' : 'nuroo'
      const res = await apiClient.createMyOrganization(name, country || undefined, plan)
      apiClient.clearCache()
      const refreshedToken = await getIdToken(true)
      if (refreshedToken) apiClient.setToken(refreshedToken)
      await refreshProfile({ force: true })
      router.replace(`/b2b?orgId=${res.orgId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать аккаунт')
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (id: string) =>
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )

  const toggleGoal = (id: string) =>
    setSelectedGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  // ── Step 1: Info ─────────────────────────────────────────────────────────

  if (step === 'info') {
    return (
      <Shell>
        <ProgressBar current="info" />
        <h2 className="text-3xl font-bold text-gray-900 mb-1.5">Давайте познакомимся</h2>
        <p className="text-base text-gray-500 mb-8">Расскажите немного о себе</p>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Имя</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Айгерим"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Манасова"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Страна</label>
            <Select
              value={country}
              options={COUNTRY_OPTIONS}
              onChange={(val) => {
                setCountry(val)
                setCity('')
              }}
              placeholder="Выберите страну"
              buttonClassName="py-3.5 text-base bg-gray-50 hover:bg-white rounded-xl"
            />
          </div>

          {country && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Город</label>
              <Select
                value={city}
                options={CITIES_BY_COUNTRY[country] ?? []}
                onChange={setCity}
                placeholder="Выберите город"
                buttonClassName="py-3.5 text-base bg-gray-50 hover:bg-white rounded-xl"
              />
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('invite')}
            className="text-sm text-gray-400 hover:text-primary-600 transition-colors"
          >
            Есть код приглашения?
          </button>
          <button
            type="button"
            disabled={!firstName.trim() || !lastName.trim() || !country}
            onClick={() => setStep('category')}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary-200"
          >
            Далее <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Shell>
    )
  }

  // ── Step 2: Category ─────────────────────────────────────────────────────

  if (step === 'category') {
    return (
      <Shell>
        <ProgressBar current="category" />
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Ваша специализация</h2>
        <p className="text-sm text-gray-500 mb-6">Выберите одну или несколько категорий</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const active = selectedCategories.includes(cat.id)
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                  active
                    ? 'border-primary-400 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary-100 text-primary-600' : cat.color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="leading-tight flex-1">{cat.label}</span>
                {active && <Check className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={() => setStep('info')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <button
            type="button"
            disabled={selectedCategories.length === 0}
            onClick={() => setStep('goals')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Далее <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Shell>
    )
  }

  // ── Step 3: Goals ─────────────────────────────────────────────────────────

  if (step === 'goals') {
    return (
      <Shell>
        <ProgressBar current="goals" />
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Что хотите делать?</h2>
        <p className="text-sm text-gray-500 mb-6">Выберите всё, что вам нужно</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-1">
            Nuroo
          </p>
          {GOALS.filter((g) => !g.isBusiness).map((goal) => {
            const active = selectedGoals.includes(goal.id)
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                  active
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {(() => {
                  const Icon = goal.icon
                  return (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary-100 text-primary-600' : goal.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  )
                })()}
                <span className="flex-1">{goal.label}</span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    active ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}

          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider px-1 pt-3">
            Nuroo Business
          </p>
          {GOALS.filter((g) => g.isBusiness).map((goal) => {
            const active = selectedGoals.includes(goal.id)
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                  active
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-purple-200'
                }`}
              >
                {(() => {
                  const Icon = goal.icon
                  return (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-purple-100 text-purple-600' : goal.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  )
                })()}
                <span className="flex-1">{goal.label}</span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    active ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={() => setStep('category')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <button
            type="button"
            disabled={selectedGoals.length === 0}
            onClick={() => setStep('result')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Показать рекомендацию <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Shell>
    )
  }

  // ── Step 4: Result / Recommendation ──────────────────────────────────────

  if (step === 'result') {
    const businessGoals = GOALS.filter((g) => g.isBusiness && selectedGoals.includes(g.id))
    const basicGoals = GOALS.filter((g) => !g.isBusiness && selectedGoals.includes(g.id))

    return (
      <Shell>
        <ProgressBar current="result" />

        {needsBusiness ? (
          // ── Nuroo Business recommendation ──────────────────────────────
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                  Рекомендуем
                </p>
                <h2 className="text-2xl font-bold text-gray-900">Nuroo Business</h2>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Вы выбрали функции, которые доступны только в бизнес-тарифе.
            </p>

            <div className="bg-purple-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">
                Нужно для вас
              </p>
              <ul className="space-y-2">
                {businessGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm text-purple-800">
                    <Check className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    {g.label}
                  </li>
                ))}
                {basicGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm text-purple-800">
                    <Check className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    {g.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-purple-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Nuroo Business</p>
                <p className="text-xs text-gray-500">1 месяц бесплатно</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-700">$50</p>
                <p className="text-xs text-gray-400">/месяц</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOrgName(`${firstName} ${lastName}`.trim())
                setStep('setup')
              }}
              className="w-full py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors"
            >
              Начать бесплатный период →
            </button>
            <button
              type="button"
              onClick={() => setStep('goals')}
              className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600"
            >
              ← Изменить выбор
            </button>
          </div>
        ) : (
          // ── Nuroo basic recommendation ─────────────────────────────────
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Рекомендуем
                </p>
                <h2 className="text-2xl font-bold text-gray-900">Nuroo</h2>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Для самостоятельной работы вам хватит базового тарифа.
            </p>

            <div className="bg-primary-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-3">
                Что вы получите
              </p>
              <ul className="space-y-2">
                {basicGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm text-primary-800">
                    <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    {g.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-primary-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Nuroo</p>
                <p className="text-xs text-gray-500">Для независимых специалистов</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-700">$15</p>
                <p className="text-xs text-gray-400">/месяц</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOrgName(`${firstName} ${lastName}`.trim())
                setStep('setup')
              }}
              className="w-full py-3.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              Начать работу →
            </button>

            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 text-center">
                Нужны бизнес-функции?{' '}
                <button
                  type="button"
                  onClick={() => setStep('goals')}
                  className="text-purple-600 font-medium hover:underline"
                >
                  Изменить выбор
                </button>{' '}
                и мы покажем Nuroo Business.
              </p>
            </div>
          </div>
        )}
      </Shell>
    )
  }

  // ── Setup: create org / workspace ─────────────────────────────────────────

  if (step === 'setup') {
    const isBusiness = needsBusiness

    return (
      <Shell>
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBusiness ? 'bg-purple-100' : 'bg-primary-100'}`}
          >
            <Building2
              className={`w-5 h-5 ${isBusiness ? 'text-purple-600' : 'text-primary-600'}`}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isBusiness ? 'Создайте рабочее пространство' : 'Ваш профиль специалиста'}
            </h2>
            <p className="text-sm text-gray-500">
              {isBusiness
                ? 'Название вашего центра или организации'
                : 'Как вас будут видеть клиенты'}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {isBusiness ? 'Название организации / центра' : 'Ваше имя или название профиля'}
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={isBusiness ? 'Центр «Шаг вперёд»' : `${firstName} ${lastName}`}
              className={`w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 text-sm ${
                isBusiness
                  ? 'focus:ring-purple-500 focus:border-purple-500'
                  : 'focus:ring-primary-500 focus:border-primary-500'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !orgName.trim()}
            className={`w-full inline-flex items-center justify-center py-3.5 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isBusiness
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isBusiness ? 'Создать организацию' : 'Начать работу'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setStep('result')}
          className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600"
        >
          ← Назад
        </button>
      </Shell>
    )
  }

  // ── Invite: join existing org ─────────────────────────────────────────────

  if (step === 'invite') {
    return (
      <Shell>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Key className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Войти по приглашению</h2>
            <p className="text-sm text-gray-500">Введите код, который прислал вам администратор</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center text-lg font-mono tracking-widest uppercase"
          />
          <button
            type="submit"
            disabled={loading || !inviteCode.trim()}
            className="w-full inline-flex items-center justify-center py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Присоединиться
          </button>
        </form>

        <button
          type="button"
          onClick={() => setStep('info')}
          className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600"
        >
          ← Нет кода? Создать свой аккаунт
        </button>
      </Shell>
    )
  }

  return null
}

// ── Shell layout ─────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-4">
          <Image
            src="/Logo.svg"
            alt="Nuroo"
            width={56}
            height={56}
            className="mx-auto rounded-xl"
            priority
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">{children}</div>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={async () => {
              setLoggingOut(true)
              try {
                await logout()
                router.push('/b2b/login')
              } finally {
                setLoggingOut(false)
              }
            }}
            disabled={loggingOut}
            className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            {loggingOut ? '...' : 'Выйти из аккаунта'}
          </button>
        </div>
      </div>
    </div>
  )
}
