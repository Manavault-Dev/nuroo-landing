'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Search, MapPin, Star, ArrowRight, Building2 } from 'lucide-react'

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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'

export function MarketplaceClient({
  locale,
  initialQuery = '',
}: {
  locale: string
  initialQuery?: string
}) {
  const t = useTranslations('marketplace')

  const [orgs, setOrgs] = useState<PublicOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(initialQuery)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetch(`${API_URL}/api/organizations/public`)
      .then((r) => r.json())
      .then((data) => setOrgs(data.organizations ?? []))
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }, [t])

  const categories = useMemo(() => {
    const set = new Set<string>()
    orgs.forEach((o) => o.categories.forEach((c) => set.add(c)))
    return Array.from(set).slice(0, 8)
  }, [orgs])

  const filtered = useMemo(() => {
    let result = orgs
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.city?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q)
      )
    }
    if (category !== 'all') {
      result = result.filter((o) =>
        o.categories.some((c) => c.toLowerCase() === category.toLowerCase())
      )
    }
    return result
  }, [orgs, search, category])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 text-white px-4 pt-24 pb-20 md:pt-28 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{t('pageTitle')}</h1>
          <p className="text-primary-100 text-lg mb-10">{t('pageSubtitle')}</p>

          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-base"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-primary-400'
              }`}
            >
              {t('filterAll')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-primary-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && <div className="text-center py-16 text-red-500">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium text-lg">{t('noOrgs')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('noOrgsHint')}</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((org) => (
              <OrgCard key={org.id} org={org} locale={locale} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrgCard({
  org,
  locale,
  t,
}: {
  org: PublicOrg
  locale: string
  t: ReturnType<typeof useTranslations<'marketplace'>>
}) {
  return (
    <Link
      href={`/${locale}/marketplace/${org.id}`}
      className="group bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="h-36 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 relative overflow-hidden">
        {org.coverImageUrl && (
          <img src={org.coverImageUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute bottom-3 left-4 w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-md overflow-hidden flex items-center justify-center">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-6 h-6 text-primary-400" />
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight mb-1 group-hover:text-primary-600 transition-colors">
          {org.name}
        </h3>

        {(org.city || org.country) && (
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
            <MapPin className="w-3 h-3" />
            <span>{[org.city, org.country].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {org.description && (
          <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
            {org.description}
          </p>
        )}

        {org.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {org.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          {org.averageRating > 0 ? (
            <div className="flex items-center gap-1 text-amber-500 text-sm font-medium">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <span>{org.averageRating.toFixed(1)}</span>
              <span className="text-gray-400 font-normal">({org.reviewCount})</span>
            </div>
          ) : (
            <span className="text-gray-400 text-xs">{t('specialists')}</span>
          )}
          <span className="flex items-center gap-1 text-primary-600 text-sm font-medium">
            {t('viewProfile')}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
