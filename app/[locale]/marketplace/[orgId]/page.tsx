'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Star,
  ChevronRight,
  CheckCircle2,
  X,
  Building2,
  User,
  Clock,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'

interface Org {
  id: string
  name: string
  logoUrl: string | null
  coverImageUrl: string | null
  description: string | null
  city: string | null
  country: string | null
  address: string | null
  contactPhone: string | null
  whatsappNumber: string | null
  websiteUrl: string | null
  categories: string[]
  reviewCount: number
  averageRating: number
}

interface Specialist {
  id: string
  fullName: string
  avatarUrl: string | null
  specialization: string | null
  bio: string | null
}

interface Service {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  price: number
  currency: string
}

interface Slot {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
}

type Step = 'specialist' | 'service' | 'slot' | 'confirm' | 'success'

function useUser() {
  const [user, setUser] = useState<{ uid: string; token: string } | null>(null)
  useEffect(() => {
    // Try to get auth from b2b auth context via localStorage token
    const token = localStorage.getItem('nuroo_auth_token')
    const uid = localStorage.getItem('nuroo_uid')
    if (token && uid) setUser({ uid, token })
  }, [])
  return user
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, options)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const err = Object.assign(new Error(body.error || r.statusText), { status: r.status, body })
    throw err
  }
  return r.json()
}

// Formats YYYY-MM-DD to locale-aware display string
function formatDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Returns array of YYYY-MM-DD strings starting from today
function getDateRange(startOffset: number, count = 7): string[] {
  const dates: string[] = []
  const base = new Date()
  base.setDate(base.getDate() + startOffset)
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export default function OrgPage() {
  const t = useTranslations('marketplace.orgPage')
  const { locale, orgId } = useParams<{ locale: string; orgId: string }>()
  const user = useUser()

  const [org, setOrg] = useState<Org | null>(null)
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Booking flow state
  const [step, setStep] = useState<Step>('specialist')
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [dateOffset, setDateOffset] = useState(0)
  const [dates] = useState(() => getDateRange(0, 30))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)

  // Load org + specialists
  useEffect(() => {
    Promise.all([
      apiFetch<{ organizations?: Org[] }>('/api/organizations/public').then(
        (d) => d.organizations?.find((o) => o.id === orgId) ?? null
      ),
      apiFetch<{ ok: boolean; specialists: Specialist[] }>(
        `/marketplace/organizations/${orgId}/specialists`
      ).then((d) => d.specialists),
    ])
      .then(([orgData, specs]) => {
        if (!orgData) {
          setLoadError(t('loadError'))
          return
        }
        setOrg(orgData)
        setSpecialists(specs)
      })
      .catch(() => setLoadError(t('loadError')))
      .finally(() => setLoading(false))
  }, [orgId, t])

  // Load services when specialist selected
  useEffect(() => {
    if (!selectedSpecialist) return
    setServicesLoading(true)
    apiFetch<{ ok: boolean; services: Service[] }>(
      `/marketplace/organizations/${orgId}/specialists/${selectedSpecialist.id}/services`
    )
      .then((d) => setServices(d.services))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false))
  }, [selectedSpecialist, orgId])

  // Load slots when date selected
  useEffect(() => {
    if (!selectedDate || !selectedSpecialist) return
    setSlotsLoading(true)
    const params = new URLSearchParams({ date: selectedDate, days: '1' })
    if (selectedService) params.set('serviceId', selectedService.id)
    apiFetch<{ ok: boolean; slots: Slot[] }>(
      `/marketplace/organizations/${orgId}/specialists/${selectedSpecialist.id}/slots?${params}`
    )
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [selectedDate, selectedSpecialist, selectedService, orgId])

  const handleSelectSpecialist = (spec: Specialist) => {
    setSelectedSpecialist(spec)
    setSelectedService(null)
    setSelectedSlot(null)
    setSelectedDate(null)
    setSlots([])
    setStep('service')
  }

  const handleSelectService = (svc: Service) => {
    setSelectedService(svc)
    setStep('slot')
  }

  const handleSelectSlot = (slot: Slot) => {
    setSelectedSlot(slot)
    setStep('confirm')
  }

  const handleBook = useCallback(async () => {
    if (!selectedSlot || !selectedSpecialist || !user) return
    setBooking(true)
    setBookError(null)
    try {
      await apiFetch(`/marketplace/organizations/${orgId}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          specialistId: selectedSpecialist.id,
          serviceId: selectedService?.id ?? null,
          slotId: selectedSlot.id,
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        }),
      })
      setStep('success')
    } catch (err: any) {
      if (err?.status === 409) {
        setBookError(t('slotTaken'))
      } else {
        setBookError(t('bookError'))
      }
    } finally {
      setBooking(false)
    }
  }, [selectedSlot, selectedSpecialist, selectedService, user, orgId, t])

  const visibleDates = dates.slice(dateOffset, dateOffset + 7)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError || !org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{loadError || t('loadError')}</p>
        <Link href={`/${locale}/marketplace`} className="text-primary-600 hover:underline">
          {t('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Cover */}
      <div className="relative h-52 bg-gradient-to-br from-primary-600 to-primary-700 overflow-hidden">
        {org.coverImageUrl && (
          <img src={org.coverImageUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Link
          href={`/${locale}/marketplace`}
          className="absolute top-4 left-4 flex items-center gap-2 text-white/90 hover:text-white text-sm bg-black/20 hover:bg-black/30 px-3 py-2 rounded-full transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </Link>
        {/* Logo */}
        <div className="absolute bottom-4 left-6 w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 shadow-lg overflow-hidden flex items-center justify-center">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-8 h-8 text-primary-400" />
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {/* Org header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 -mt-4 mb-6 pt-8 pb-5 px-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{org.name}</h1>

          <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
            {(org.city || org.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {[org.city, org.country].filter(Boolean).join(', ')}
              </span>
            )}
            {org.contactPhone && (
              <a
                href={`tel:${org.contactPhone}`}
                className="flex items-center gap-1 hover:text-primary-600"
              >
                <Phone className="w-4 h-4" />
                {org.contactPhone}
              </a>
            )}
            {org.websiteUrl && (
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary-600"
              >
                <Globe className="w-4 h-4" />
                {org.websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
            {org.averageRating > 0 && (
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-amber-500" />
                {org.averageRating.toFixed(1)} ({org.reviewCount})
              </span>
            )}
          </div>

          {org.description && (
            <p className="text-gray-600 dark:text-gray-300 text-sm">{org.description}</p>
          )}

          {org.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {org.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pb-16">
          {/* Specialists list */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('specialists')}
            </h2>
            {specialists.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('noSpecialists')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {specialists.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => handleSelectSpecialist(spec)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedSpecialist?.id === spec.id
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {spec.avatarUrl ? (
                          <img
                            src={spec.avatarUrl}
                            alt={spec.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-primary-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {spec.fullName}
                        </p>
                        {spec.specialization && (
                          <p className="text-gray-400 text-xs truncate">{spec.specialization}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Booking panel */}
          <div className="lg:col-span-3">
            {!selectedSpecialist ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t('selectService')}</p>
              </div>
            ) : step === 'success' ? (
              <SuccessPanel locale={locale} t={t} />
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Steps breadcrumb */}
                <div className="flex border-b border-gray-100 dark:border-gray-800">
                  {(['service', 'slot', 'confirm'] as Step[]).map((s, i) => {
                    const stepLabels: Record<string, string> = {
                      service: t('services'),
                      slot: t('selectDate'),
                      confirm: t('confirmTitle'),
                    }
                    const isActive = step === s
                    const isDone =
                      (s === 'service' && ['slot', 'confirm'].includes(step)) ||
                      (s === 'slot' && step === 'confirm')
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          if (isDone) setStep(s)
                        }}
                        disabled={!isDone && !isActive}
                        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
                          isActive
                            ? 'text-primary-600 border-b-2 border-primary-500'
                            : isDone
                              ? 'text-gray-500 hover:text-primary-500 cursor-pointer'
                              : 'text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {i + 1}. {stepLabels[s]}
                      </button>
                    )
                  })}
                </div>

                <div className="p-5">
                  {/* Step: Services */}
                  {step === 'service' && (
                    <div>
                      {servicesLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="w-7 h-7 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : services.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">{t('noServices')}</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {services.map((svc) => (
                            <button
                              key={svc.id}
                              onClick={() => handleSelectService(svc)}
                              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 bg-gray-50 dark:bg-gray-800 transition-all text-left"
                            >
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {svc.name}
                                </p>
                                {svc.description && (
                                  <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
                                    {svc.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {t('duration', { min: svc.durationMinutes })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                  {svc.price > 0
                                    ? `${svc.price.toLocaleString()} ${svc.currency}`
                                    : t('free')}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step: Date + Slot */}
                  {step === 'slot' && (
                    <div>
                      {/* Date picker */}
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t('selectDate')}
                      </p>
                      <div className="flex items-center gap-1 mb-4">
                        <button
                          onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                          disabled={dateOffset === 0}
                          className="px-2 py-1.5 text-xs text-gray-500 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {t('back7Days')}
                        </button>
                        <div className="flex-1 flex gap-1 overflow-x-auto pb-1">
                          {visibleDates.map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                setSelectedDate(d)
                                setSelectedSlot(null)
                              }}
                              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                selectedDate === d
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary-100'
                              }`}
                            >
                              {formatDate(d, locale).split(',')[0]}
                              <br />
                              <span className="text-[10px] opacity-70">
                                {d.split('-').slice(1).join('/')}
                              </span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setDateOffset(Math.min(dates.length - 7, dateOffset + 7))}
                          disabled={dateOffset + 7 >= dates.length}
                          className="px-2 py-1.5 text-xs text-gray-500 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {t('next7Days')}
                        </button>
                      </div>

                      {/* Slots */}
                      {selectedDate && (
                        <>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('selectTime')}
                          </p>
                          {slotsLoading ? (
                            <div className="flex justify-center py-4">
                              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : slots.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-4">{t('noSlots')}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {slots.map((slot) => (
                                <button
                                  key={slot.id}
                                  onClick={() => handleSelectSlot(slot)}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    selectedSlot?.id === slot.id
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary-100'
                                  }`}
                                >
                                  {slot.startTime}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Step: Confirm */}
                  {step === 'confirm' && selectedSlot && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        {t('confirmTitle')}
                      </h3>
                      <dl className="space-y-3 mb-6">
                        <Row
                          label={t('confirmSpecialist')}
                          value={selectedSpecialist?.fullName ?? ''}
                        />
                        {selectedService && (
                          <Row label={t('confirmService')} value={selectedService.name} />
                        )}
                        <Row
                          label={t('confirmDate')}
                          value={formatDate(selectedSlot.date, locale)}
                        />
                        <Row
                          label={t('confirmTime')}
                          value={`${selectedSlot.startTime} – ${selectedSlot.endTime}`}
                        />
                      </dl>

                      {bookError && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                          <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {bookError}
                        </div>
                      )}

                      {user ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setStep('slot')}
                            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            {t('cancelBtn')}
                          </button>
                          <button
                            onClick={handleBook}
                            disabled={booking}
                            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                          >
                            {booking ? t('booking') : t('confirmBtn')}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-gray-500 text-sm mb-3">{t('loginRequired')}</p>
                          <Link
                            href={`/${locale}/(b2b)/login`}
                            className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors"
                          >
                            {t('loginBtn')}
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <dt className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-gray-900 dark:text-white font-medium text-right ml-4">{value}</dd>
    </div>
  )
}

function SuccessPanel({
  locale,
  t,
}: {
  locale: string
  t: ReturnType<typeof useTranslations<'marketplace.orgPage'>>
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
      <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('bookSuccess')}</h3>
      <p className="text-gray-500 text-sm mb-6">{t('loginRequired')}</p>
      <Link
        href={`/${locale}/marketplace`}
        className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {t('back')}
      </Link>
    </div>
  )
}
