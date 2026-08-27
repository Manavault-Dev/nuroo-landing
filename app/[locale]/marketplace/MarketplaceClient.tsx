'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Search,
  MapPin,
  Star,
  ArrowRight,
  Building2,
  User,
  Wifi,
  Users,
  Calendar,
  X,
  Clock,
  CheckCircle2,
  Phone,
  Baby,
  SlidersHorizontal,
} from 'lucide-react'
import { BookingPanel, type PanelOrg } from './BookingPanel'
import { getIdToken } from '@/lib/b2b/authClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicOrg {
  id: string
  name: string
  logoUrl: string | null
  coverImageUrl: string | null
  description: string | null
  city: string | null
  country: string | null
  address: string | null
  categories: string[]
  contactPhone: string | null
  reviewCount: number
  averageRating: number
  isOnline?: boolean
  plan?: 'nuroo' | 'nuroo_business'
  specialization?: string
  priceFrom?: number | null
  currency?: string
  ageMin?: number | null
  ageMax?: number | null
  languages?: string[]
}

interface PublicCohort {
  id: string
  orgId: string
  orgName: string
  title: string
  format: 'online' | 'offline' | 'hybrid'
  startDate: string
  schedule?: string // e.g. "Пн / Ср / Пт · 16:00"
  spotsLeft: number
  price: number
  currency: string
  category?: string
  ageMin?: number
  ageMax?: number
  coverUrl?: string
  city?: string
}

type ActiveTab = 'specialists' | 'centers' | 'programs' | 'events'

const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101').replace(/\/+$/, '')}/v1`

// ─── Main component ───────────────────────────────────────────────────────────

// Localise a category string stored in English in Firestore.
// Falls back to the original value so new categories appear immediately
// without requiring a translation deployment.
function useCategoryLabel() {
  const t = useTranslations('marketplace')
  return (cat: string) => {
    try {
      // next-intl throws if key is missing when using t.raw; catch = fallback
      const label = t(`categoryLabels.${cat}` as any)
      return label ?? cat
    } catch {
      return cat
    }
  }
}

export function MarketplaceClient({
  locale,
  initialQuery = '',
}: {
  locale: string
  initialQuery?: string
}) {
  const t = useTranslations('marketplace')
  const categoryLabel = useCategoryLabel()

  // data
  const [orgs, setOrgs] = useState<PublicOrg[]>([])
  const [cohorts, setCohorts] = useState<PublicCohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ui
  const [activeTab, setActiveTab] = useState<ActiveTab>('centers')
  const [selectedOrg, setSelectedOrg] = useState<PanelOrg | null>(null)
  const [search, setSearch] = useState(initialQuery)
  const [filterOpen, setFilterOpen] = useState(false)

  // shared filters
  const [category, setCategory] = useState('all')
  const [format, setFormat] = useState<'all' | 'online' | 'offline'>('all')
  const [city, setCity] = useState('all')

  // org filters (specialists + centers)
  const [orgPriceMax, setOrgPriceMax] = useState<number | null>(null)
  const [orgAge, setOrgAge] = useState<number | null>(null)

  // programs-only filters
  const [priceMax, setPriceMax] = useState<number | null>(null)
  const [ageMin, setAgeMin] = useState<number | null>(null)
  const [hasSpots, setHasSpots] = useState(false)

  useEffect(() => {
    const opts: RequestInit = { next: { revalidate: 30 } } as RequestInit
    Promise.all([
      fetch(`${API_URL}/api/organizations/public`, opts).then((r) => r.json()),
      fetch(`${API_URL}/marketplace/cohorts?limit=100`, opts)
        .then((r) => r.json())
        .catch(() => ({ cohorts: [] })),
    ])
      .then(([orgData, cohortData]) => {
        setOrgs(orgData.organizations ?? [])
        const raw = Array.isArray(cohortData) ? cohortData : (cohortData?.cohorts ?? [])
        setCohorts(raw)
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // derived lists
  // plan 'nuroo' = частник/специалист, 'nuroo_business' (или нет поля) = центр
  const specialists = useMemo(() => orgs.filter((o) => o.plan === 'nuroo'), [orgs])
  const centers = useMemo(() => orgs.filter((o) => o.plan !== 'nuroo'), [orgs])

  const categories = useMemo(() => {
    const set = new Set<string>()
    orgs.forEach((o) => o.categories.forEach((c) => set.add(c)))
    return Array.from(set).slice(0, 10)
  }, [orgs])

  const cities = useMemo(() => {
    const set = new Set<string>()
    orgs.forEach((o) => {
      if (o.city) set.add(o.city)
    })
    cohorts.forEach((c) => {
      if (c.city) set.add(c.city)
    })
    return Array.from(set).sort()
  }, [orgs, cohorts])

  const applyOrgFilters = (list: PublicOrg[]) => {
    let r = list
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.city?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.specialization?.toLowerCase().includes(q)
      )
    }
    if (category !== 'all')
      r = r.filter((o) => o.categories.some((c) => c.toLowerCase() === category.toLowerCase()))
    if (format === 'online') r = r.filter((o) => o.isOnline)
    if (format === 'offline') r = r.filter((o) => !o.isOnline)
    if (city !== 'all') r = r.filter((o) => o.city === city)
    if (orgPriceMax !== null) r = r.filter((o) => o.priceFrom == null || o.priceFrom <= orgPriceMax)
    if (orgAge !== null)
      r = r.filter(
        (o) => (o.ageMin == null || o.ageMin <= orgAge) && (o.ageMax == null || o.ageMax >= orgAge)
      )
    return r
  }

  const filteredSpecialists = useMemo(
    () => applyOrgFilters(specialists),
    [specialists, search, category, format, city, orgPriceMax, orgAge]
  )
  const filteredCenters = useMemo(
    () => applyOrgFilters(centers),
    [centers, search, category, format, city, orgPriceMax, orgAge]
  )

  const filteredCohorts = useMemo(() => {
    let r = cohorts
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((c) => c.title.toLowerCase().includes(q) || c.orgName?.toLowerCase().includes(q))
    }
    if (category !== 'all')
      r = r.filter((c) => c.category?.toLowerCase() === category.toLowerCase())
    if (format === 'online') r = r.filter((c) => c.format === 'online')
    if (format === 'offline') r = r.filter((c) => c.format === 'offline')
    if (city !== 'all') r = r.filter((c) => c.city === city)
    if (priceMax !== null) r = r.filter((c) => c.price <= priceMax)
    if (ageMin !== null) r = r.filter((c) => c.ageMin == null || c.ageMin >= ageMin)
    if (hasSpots) r = r.filter((c) => c.spotsLeft > 0)
    return r
  }, [cohorts, search, category, format, city, priceMax, ageMin, hasSpots])

  const activeCount =
    activeTab === 'specialists'
      ? filteredSpecialists.length
      : activeTab === 'centers'
        ? filteredCenters.length
        : filteredCohorts.length

  const activeFiltersCount = [
    format !== 'all',
    city !== 'all',
    category !== 'all',
    orgPriceMax !== null,
    orgAge !== null,
    priceMax !== null,
    ageMin !== null,
    hasSpots,
  ].filter(Boolean).length

  const resetFilters = () => {
    setFormat('all')
    setCity('all')
    setCategory('all')
    setOrgPriceMax(null)
    setOrgAge(null)
    setPriceMax(null)
    setAgeMin(null)
    setHasSpots(false)
  }

  const TABS: { id: ActiveTab; label: string; count: number }[] = [
    { id: 'specialists', label: 'Специалисты', count: filteredSpecialists.length },
    { id: 'centers', label: 'Центры', count: filteredCenters.length },
    { id: 'programs', label: 'Программы', count: filteredCohorts.length },
    { id: 'events', label: 'Мероприятия', count: 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 text-white px-4 pt-24 pb-20 md:pt-28 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Найдите лучшее для развития ребёнка
          </h1>
          <p className="text-primary-100 text-lg mb-10">
            Специалисты, центры и программы — с записью онлайн
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Специалист, центр или программа…"
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-base"
            />
          </div>
        </div>
      </div>

      {/* Mobile booking panel — renders outside grid, fixed overlay */}
      {selectedOrg && (
        <div className="lg:hidden">
          <BookingPanel org={selectedOrg} locale={locale} onClose={() => setSelectedOrg(null)} />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-900 rounded-xl p-1 border border-gray-100 dark:border-gray-800 w-fit shadow-sm overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex items-center gap-3">
            {/* Categories — horizontal scroll, no wrap */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
              <CategoryChip
                label="Все"
                active={category === 'all'}
                onClick={() => setCategory('all')}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  label={categoryLabel(cat)}
                  active={category === cat}
                  onClick={() => setCategory(cat)}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

            {/* Filter button — always visible, opens drawer */}
            <button
              onClick={() => setFilterOpen(true)}
              className={`flex items-center gap-2 h-9 px-4 rounded-full text-sm font-semibold border transition-all flex-shrink-0 whitespace-nowrap ${
                activeFiltersCount > 0
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-xs font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Filter Drawer ── */}
        <FilterDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          activeTab={activeTab}
          format={format}
          onFormat={setFormat}
          city={city}
          onCity={setCity}
          cities={cities}
          orgAge={orgAge}
          onOrgAge={setOrgAge}
          orgPriceMax={orgPriceMax}
          onOrgPriceMax={setOrgPriceMax}
          ageMin={ageMin}
          onAgeMin={setAgeMin}
          priceMax={priceMax}
          onPriceMax={setPriceMax}
          hasSpots={hasSpots}
          onHasSpots={setHasSpots}
          activeFiltersCount={activeFiltersCount}
          onReset={resetFilters}
        />

        {/* ── Content ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <div className="text-center py-16 text-red-500">{error}</div>}

        {/* ── Split layout: cards + booking panel ── */}
        <div
          className={`flex gap-6 items-start transition-all duration-300 ${selectedOrg ? 'flex-col lg:flex-row' : ''}`}
        >
          {/* Cards grid */}
          <div
            className={`min-w-0 transition-all duration-300 ${selectedOrg ? 'lg:flex-1' : 'w-full'}`}
          >
            {!loading &&
              !error &&
              activeTab === 'specialists' &&
              (filteredSpecialists.length === 0 ? (
                <EmptyMsg
                  icon={<User className="w-12 h-12 text-gray-300 mx-auto mb-4" />}
                  text="Специалисты не найдены"
                  hint="Попробуйте изменить фильтры или поиск"
                />
              ) : (
                <div
                  className={`grid gap-5 ${selectedOrg ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
                >
                  {filteredSpecialists.map((org) => (
                    <SpecialistCard
                      key={org.id}
                      org={org}
                      locale={locale}
                      catLabel={categoryLabel}
                      selected={selectedOrg?.id === org.id}
                      onSelect={() => setSelectedOrg(selectedOrg?.id === org.id ? null : org)}
                    />
                  ))}
                </div>
              ))}

            {!loading &&
              !error &&
              activeTab === 'centers' &&
              (filteredCenters.length === 0 ? (
                <EmptyMsg
                  icon={<Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />}
                  text="Центры не найдены"
                  hint="Попробуйте изменить фильтры или поиск"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCenters.map((org) => (
                    <CenterCard key={org.id} org={org} locale={locale} catLabel={categoryLabel} />
                  ))}
                </div>
              ))}

            {!loading &&
              !error &&
              activeTab === 'programs' &&
              (filteredCohorts.length === 0 ? (
                <EmptyMsg
                  icon={<Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />}
                  text="Программы не найдены"
                  hint="Попробуйте изменить фильтры или поиск"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCohorts.map((cohort) => (
                    <ProgramCard key={cohort.id} cohort={cohort} locale={locale} />
                  ))}
                </div>
              ))}

            {!loading && !error && activeTab === 'events' && (
              <EmptyMsg
                icon={<Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />}
                text="Мероприятий пока нет"
                hint="Скоро здесь появятся мастер-классы, вебинары и открытые занятия"
              />
            )}
          </div>

          {/* Booking panel */}
          {selectedOrg && (
            <div className="hidden lg:block w-[360px] xl:w-[400px] flex-shrink-0">
              <BookingPanel
                org={selectedOrg}
                locale={locale}
                onClose={() => setSelectedOrg(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Filter Drawer ────────────────────────────────────────────────────────────

interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  activeTab: ActiveTab
  format: 'all' | 'online' | 'offline'
  onFormat: (v: 'all' | 'online' | 'offline') => void
  city: string
  onCity: (v: string) => void
  cities: string[]
  orgAge: number | null
  onOrgAge: (v: number | null) => void
  orgPriceMax: number | null
  onOrgPriceMax: (v: number | null) => void
  ageMin: number | null
  onAgeMin: (v: number | null) => void
  priceMax: number | null
  onPriceMax: (v: number | null) => void
  hasSpots: boolean
  onHasSpots: (v: boolean) => void
  activeFiltersCount: number
  onReset: () => void
}

function FilterDrawer({
  open,
  onClose,
  activeTab,
  format,
  onFormat,
  city,
  onCity,
  cities,
  orgAge,
  onOrgAge,
  orgPriceMax,
  onOrgPriceMax,
  ageMin,
  onAgeMin,
  priceMax,
  onPriceMax,
  hasSpots,
  onHasSpots,
  activeFiltersCount,
  onReset,
}: FilterDrawerProps) {
  const currentAge = activeTab === 'programs' ? ageMin : orgAge
  const setCurrentAge = activeTab === 'programs' ? onAgeMin : onOrgAge
  const currentPrice = activeTab === 'programs' ? priceMax : orgPriceMax
  const setCurrentPrice = activeTab === 'programs' ? onPriceMax : onOrgPriceMax
  const priceOptions =
    activeTab === 'programs'
      ? [2000, 3500, 5000, 7000, 10000, 15000, 20000]
      : [1000, 2000, 3500, 5000, 7000, 10000]
  const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14]
  const ageLabel = (a: number) => `${a} ${a === 1 ? 'год' : a < 5 ? 'года' : 'лет'}`

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Фильтры</h2>
            {activeFiltersCount > 0 && (
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                {activeFiltersCount}{' '}
                {activeFiltersCount === 1
                  ? 'фильтр'
                  : activeFiltersCount < 5
                    ? 'фильтра'
                    : 'фильтров'}{' '}
                применено
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Format */}
          {activeTab !== 'events' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Формат
              </p>
              <div className="flex gap-2">
                {(['all', 'online', 'offline'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => onFormat(f)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      format === f
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {f === 'all' ? 'Все' : f === 'online' ? 'Онлайн' : 'Офлайн'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* City */}
          {(activeTab === 'specialists' || activeTab === 'centers') && cities.length > 0 && (
            <CityFilter city={city} onCity={onCity} cities={cities} />
          )}

          {/* Age */}
          {activeTab !== 'events' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Возраст ребёнка
                </p>
                {currentAge !== null && (
                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                    {ageLabel(currentAge)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  label="Любой"
                  active={currentAge === null}
                  onClick={() => setCurrentAge(null)}
                />
                {ages.map((a) => (
                  <FilterPill
                    key={a}
                    label={ageLabel(a)}
                    active={currentAge === a}
                    onClick={() => setCurrentAge(a)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          {activeTab !== 'events' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Бюджет
                </p>
                {currentPrice !== null && (
                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                    до {currentPrice.toLocaleString()} KGS
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  label="Любая цена"
                  active={currentPrice === null}
                  onClick={() => setCurrentPrice(null)}
                />
                {priceOptions.map((p) => (
                  <FilterPill
                    key={p}
                    label={`до ${p.toLocaleString()} KGS`}
                    active={currentPrice === p}
                    onClick={() => setCurrentPrice(p)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Spots — programs only */}
          {activeTab === 'programs' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Доступность
              </p>
              <button
                onClick={() => onHasSpots(!hasSpots)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 transition-all ${
                  hasSpots
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-left">
                  <p
                    className={`text-sm font-semibold ${hasSpots ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    Только с местами
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Показать программы, куда можно записаться
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    hasSpots
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {hasSpots && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <button
            onClick={() => {
              onReset()
              onClose()
            }}
            disabled={activeFiltersCount === 0}
            className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            Сбросить {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors whitespace-nowrap"
          >
            Показать результаты
          </button>
        </div>
      </div>
    </>
  )
}

// ─── CityFilter ───────────────────────────────────────────────────────────────

function CityFilter({
  city,
  onCity,
  cities,
}: {
  city: string
  onCity: (v: string) => void
  cities: string[]
}) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? cities.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : cities

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        Город / регион
      </p>

      {/* Search input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск города…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-primary-400 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="max-h-48 overflow-y-auto rounded-xl border-2 border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {/* All cities option */}
        <button
          onClick={() => onCity('all')}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
            city === 'all'
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <span>Все города</span>
          {city === 'all' && <div className="w-2 h-2 rounded-full bg-primary-500" />}
        </button>

        {filtered.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400 text-center bg-white dark:bg-gray-900">
            Не найдено
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c}
              onClick={() => onCity(c)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                city === c
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span>{c}</span>
              {city === c && <div className="w-2 h-2 rounded-full bg-primary-500" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-primary-400'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyMsg({ icon, text, hint }: { icon: React.ReactNode; text: string; hint: string }) {
  return (
    <div className="text-center py-20">
      {icon}
      <p className="text-gray-500 font-semibold text-lg">{text}</p>
      <p className="text-gray-400 text-sm mt-1">{hint}</p>
    </div>
  )
}

// ─── Specialist card (compact, 4-column) ─────────────────────────────────────

function SpecialistCard({
  org,
  locale,
  catLabel,
  selected,
  onSelect,
}: {
  org: PublicOrg
  locale: string
  catLabel: (c: string) => string
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group bg-white dark:bg-gray-900 rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center text-center ${
        selected
          ? 'border-primary-500 shadow-md shadow-primary-100 dark:shadow-primary-900'
          : 'border-gray-100 dark:border-gray-800 hover:border-primary-200'
      }`}
    >
      <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 overflow-hidden mb-3 flex items-center justify-center shadow-sm">
        {org.logoUrl ? (
          <img
            src={org.logoUrl}
            alt={org.name}
            className="w-full h-full object-cover scale-[1.3]"
          />
        ) : (
          <User className="w-8 h-8 text-primary-400" />
        )}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-1 group-hover:text-primary-600 transition-colors">
        {org.name}
      </h3>
      {org.specialization && (
        <p className="text-primary-600 text-xs font-medium mb-1">{org.specialization}</p>
      )}
      {org.city && (
        <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
          {org.isOnline ? <Wifi className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
          <span>{org.isOnline ? 'Онлайн' : org.city}</span>
        </div>
      )}
      {org.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center mb-2">
          {org.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full"
            >
              {catLabel(cat)}
            </span>
          ))}
        </div>
      )}
      {org.averageRating > 0 && (
        <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
          <Star className="w-3 h-3 fill-amber-500" />
          {org.averageRating.toFixed(1)}
          <span className="text-gray-400 font-normal">({org.reviewCount})</span>
        </div>
      )}
    </div>
  )
}

// ─── Center card ─────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`w-3.5 h-3.5 ${i <= full ? 'text-amber-400' : i === full + 1 && half ? 'text-amber-300' : 'text-gray-200 dark:text-gray-700'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-gray-400">
        ({count} {count === 1 ? 'отзыв' : count < 5 ? 'отзыва' : 'отзывов'})
      </span>
    </div>
  )
}

function CenterCard({
  org,
  locale,
  catLabel,
}: {
  org: PublicOrg
  locale: string
  catLabel: (c: string) => string
}) {
  return (
    <Link
      href={`/${locale}/marketplace/${org.id}`}
      className="group bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary-200 transition-all duration-200 flex flex-col"
    >
      {/* Cover */}
      <div className="h-44 relative overflow-hidden bg-gradient-to-br from-primary-100 to-teal-50 dark:from-primary-900/40 dark:to-teal-900/20">
        {org.coverImageUrl && (
          <img
            src={org.coverImageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {/* gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {org.isOnline && (
            <span className="flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
              <Wifi className="w-3 h-3" /> Онлайн
            </span>
          )}
        </div>

        {/* logo + name at bottom of cover */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
          <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-800 shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white dark:border-gray-700">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="w-full h-full object-cover scale-[1.3]"
              />
            ) : (
              <Building2 className="w-7 h-7 text-primary-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base leading-tight drop-shadow group-hover:text-primary-100 transition-colors line-clamp-2">
              {org.name}
            </h3>
            {org.city && (
              <div className="flex items-center gap-1 text-white/80 text-xs mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>
                  {org.isOnline ? 'Онлайн' : [org.city, org.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Categories */}
        {org.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {org.categories.slice(0, 4).map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full"
              >
                {catLabel(cat)}
              </span>
            ))}
            {org.categories.length > 4 && (
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-medium rounded-full">
                +{org.categories.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {org.description && (
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2 mb-3">
            {org.description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
          {org.averageRating > 0 ? (
            <StarRating rating={org.averageRating} count={org.reviewCount} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-full">
              Новый
            </span>
          )}
          <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400 text-sm font-semibold group-hover:gap-2 transition-all">
            Подробнее <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Program card ─────────────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, string> = {
  online: 'bg-blue-50  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  offline: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  hybrid: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

function ProgramCard({ cohort }: { cohort: PublicCohort; locale: string }) {
  const startDate = new Date(cohort.startDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
  const ageLabel =
    cohort.ageMin != null
      ? cohort.ageMax != null
        ? `${cohort.ageMin}–${cohort.ageMax} лет`
        : `от ${cohort.ageMin} лет`
      : null
  const spotsLow = cohort.spotsLeft > 0 && cohort.spotsLeft <= 5
  const [enrollOpen, setEnrollOpen] = useState(false)

  return (
    <>
      {enrollOpen && <EnrollModal cohort={cohort} onClose={() => setEnrollOpen(false)} />}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-br from-primary-500 to-primary-700 relative overflow-hidden">
          {cohort.coverUrl && (
            <img src={cohort.coverUrl} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/25" />
          <span
            className={`absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${FORMAT_COLORS[cohort.format] ?? FORMAT_COLORS.hybrid}`}
          >
            {cohort.format === 'online' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <MapPin className="w-3 h-3" />
            )}
            {cohort.format === 'online'
              ? 'Онлайн'
              : cohort.format === 'offline'
                ? 'Офлайн'
                : 'Гибрид'}
          </span>
          {spotsLow && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              Осталось {cohort.spotsLeft}!
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1">
          {cohort.orgName && (
            <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold mb-1">
              {cohort.orgName}
            </p>
          )}
          <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug mb-3">
            {cohort.title}
          </h3>

          {/* Details grid */}
          <div className="space-y-1.5 mb-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <span>
                Старт: <strong className="text-gray-700 dark:text-gray-200">{startDate}</strong>
              </span>
            </div>
            {cohort.schedule && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span>{cohort.schedule}</span>
              </div>
            )}
            {ageLabel && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span>{ageLabel}</span>
              </div>
            )}
            {(cohort.city || cohort.format === 'online') && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span>{cohort.format === 'online' ? 'Онлайн' : cohort.city}</span>
              </div>
            )}
            {cohort.spotsLeft > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span className={spotsLow ? 'text-red-500 font-semibold' : ''}>
                  Осталось {cohort.spotsLeft}{' '}
                  {cohort.spotsLeft === 1 ? 'место' : cohort.spotsLeft < 5 ? 'места' : 'мест'}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            <div>
              <span
                className={`font-bold text-lg ${cohort.price === 0 ? 'text-primary-600' : 'text-gray-900 dark:text-white'}`}
              >
                {cohort.price === 0
                  ? 'Бесплатно'
                  : `${cohort.price.toLocaleString()} ${cohort.currency}`}
              </span>
              {cohort.price > 0 && <span className="text-gray-400 text-xs ml-1">/ мес.</span>}
            </div>
            <button
              onClick={() => setEnrollOpen(true)}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            >
              Записаться <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Enroll Modal ─────────────────────────────────────────────────────────────

function EnrollModal({ cohort, onClose }: { cohort: PublicCohort; onClose: () => void }) {
  const [childName, setChildName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isChildren =
    (cohort as any).targetAudience !== 'parents' && (cohort as any).targetAudience !== 'specialists'
  const participantLabel = isChildren ? 'Имя ребёнка' : 'Имя участника'

  const handleEnroll = async () => {
    if (!childName.trim()) {
      setError(`Введите ${participantLabel.toLowerCase()}`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const token = await getIdToken()
      if (!token) {
        setError('Войдите в аккаунт, чтобы записаться на программу')
        return
      }
      const res = await fetch(
        `${API_URL}/marketplace/cohorts/${cohort.orgId}/${cohort.id}/enroll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            childId: `child_${Date.now()}`,
            childName: childName.trim(),
            parentPhone: phone.trim() || null,
          }),
        }
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? d?.message ?? 'Не удалось записаться')
      }
      setDone(true)
    } catch (e: any) {
      setError(e?.message ?? 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Записаться в программу
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {cohort.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          /* ── Success state ── */
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Запись оформлена!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Администратор свяжется с вами для подтверждения.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Готово
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="px-6 py-5 space-y-4">
            {/* Program info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">Стоимость</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {cohort.price === 0
                  ? 'Бесплатно'
                  : `${cohort.price.toLocaleString()} ${cohort.currency} / мес.`}
              </div>
            </div>

            {/* Child name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {participantLabel} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Baby className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder={isChildren ? 'Алтынай Бекова' : 'Имя участника'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Телефон для связи
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+996 700 000 000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleEnroll}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-all"
              >
                {saving ? 'Отправляем…' : 'Записаться'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
