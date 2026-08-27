'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  X,
  Star,
  MapPin,
  Wifi,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react'

const API = `${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101').replace(/\/+$/, '')}/v1`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PanelOrg {
  id: string
  name: string
  logoUrl: string | null
  coverImageUrl: string | null
  description: string | null
  city: string | null
  isOnline?: boolean
  categories: string[]
  averageRating: number
  reviewCount: number
}

interface Specialist {
  id: string
  name: string
  role?: string
  avatarUrl?: string | null
}
interface Service {
  id: string
  name: string
  duration?: number
  price?: number
  currency?: string
}
interface Slot {
  id: string
  date: string
  startTime: string
  endTime: string
}

type Step = 'pick' | 'confirm' | 'done'

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MO = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingPanel({
  org,
  locale,
  onClose,
}: {
  org: PanelOrg
  locale: string
  onClose: () => void
}) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [step, setStep] = useState<Step>('pick')
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [selectedSpec, setSelectedSpec] = useState<Specialist | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookedSlot, setBookedSlot] = useState<Slot | null>(null)

  useEffect(() => {
    fetch(`${API}/marketplace/organizations/${org.id}/specialists`)
      .then((r) => r.json())
      .then((d) => {
        const list: Specialist[] = Array.isArray(d) ? d : (d?.specialists ?? [])
        setSpecialists(list)
        if (list.length > 0) setSelectedSpec(list[0])
      })
      .catch(() => {})
  }, [org.id])

  useEffect(() => {
    if (!selectedSpec) return
    setServices([])
    setSelectedService(null)
    fetch(`${API}/marketplace/organizations/${org.id}/specialists/${selectedSpec.id}/services`)
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d) ? d : (d?.services ?? [])))
      .catch(() => {})
  }, [selectedSpec, org.id])

  useEffect(() => {
    if (!selectedSpec || !selectedDate) return
    setSlotsLoading(true)
    const sq = selectedService ? `&serviceId=${selectedService.id}` : ''
    fetch(
      `${API}/marketplace/organizations/${org.id}/specialists/${selectedSpec.id}/slots?date=${selectedDate}&days=1${sq}`
    )
      .then((r) => r.json())
      .then((d) => setSlots(d?.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [selectedSpec, selectedDate, selectedService, org.id])

  const calDays = useMemo(() => {
    const first = new Date(year, month, 1)
    const dow = (first.getDay() + 6) % 7
    const total = new Date(year, month + 1, 0).getDate()
    const cells: Array<number | null> = Array(dow).fill(null)
    for (let d = 1; d <= total; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [month, year])

  const ds = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isPast = (d: number) => {
    const a = new Date(year, month, d)
    const b = new Date()
    a.setHours(0, 0, 0, 0)
    b.setHours(0, 0, 0, 0)
    return a < b
  }
  const prevMo = () =>
    month === 0 ? (setMonth(11), setYear((y) => y - 1)) : setMonth((m) => m - 1)
  const nextMo = () =>
    month === 11 ? (setMonth(0), setYear((y) => y + 1)) : setMonth((m) => m + 1)
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const slotsForDay = slots.filter((s) => s.date === selectedDate)
  const canProceed = !!selectedDate && !!selectedSlot

  const handleBook = async () => {
    if (!selectedSlot) return
    setBooking(true)
    await new Promise((r) => setTimeout(r, 800))
    setBookedSlot(selectedSlot)
    setStep('done')
    setBooking(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />

      <aside
        className="
        fixed right-0 top-0 bottom-0 z-50
        w-full sm:w-[420px] flex flex-col
        bg-white dark:bg-gray-950
        shadow-2xl
        lg:static lg:z-auto lg:w-auto
        lg:sticky lg:top-24
        lg:h-[calc(100vh-7rem)]
        lg:rounded-2xl
        lg:border lg:border-gray-200 lg:dark:border-gray-800
        overflow-hidden
      "
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 border-b border-gray-100 dark:border-gray-800">
          {/* Top row: logo + name + close */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            {/* Logo */}
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt="" className="w-full h-full object-cover scale-[1.3]" />
              ) : (
                <User className="w-6 h-6 text-gray-400" />
              )}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
                {org.name}
              </h2>
              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                {org.averageRating > 0 && (
                  <span className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {org.averageRating.toFixed(1)}
                    <span className="text-gray-400 font-normal">({org.reviewCount})</span>
                  </span>
                )}
                {org.city && (
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    {org.isOnline ? <Wifi className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                    {org.isOnline ? 'Онлайн' : org.city}
                  </span>
                )}
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <Link
              href={`/${locale}/marketplace/${org.id}`}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Подробнее
            </Link>
            <button
              onClick={() => {
                setStep('pick')
                setSelectedDate(null)
                setSelectedSlot(null)
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white transition-colors"
            >
              Записаться
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* DONE */}
          {step === 'done' && bookedSlot && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Запись подтверждена
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {fmtDate(bookedSlot.date)} в {bookedSlot.startTime}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 mb-6">
                <DetailRow label="Организация" value={org.name} />
                {selectedSpec && <DetailRow label="Специалист" value={selectedSpec.name} />}
                {selectedService && <DetailRow label="Услуга" value={selectedService.name} />}
                <DetailRow label="Дата" value={fmtDate(bookedSlot.date)} />
                <DetailRow
                  label="Время"
                  value={`${bookedSlot.startTime} — ${bookedSlot.endTime}`}
                />
              </div>
              <div className="space-y-2">
                <button className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
                  Добавить в календарь
                </button>
                <button
                  onClick={() => {
                    setStep('pick')
                    setSelectedDate(null)
                    setSelectedSlot(null)
                    setBookedSlot(null)
                  }}
                  className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  Записаться ещё раз
                </button>
              </div>
            </div>
          )}

          {/* PICK — specialist + service + calendar + slots */}
          {step === 'pick' && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Specialist */}
              {specialists.length > 1 && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Специалист
                  </p>
                  <div className="space-y-2">
                    {specialists.map((sp) => (
                      <button
                        key={sp.id}
                        onClick={() => {
                          setSelectedSpec(sp)
                          setSelectedDate(null)
                          setSelectedSlot(null)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          selectedSpec?.id === sp.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {sp.avatarUrl ? (
                            <img src={sp.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${selectedSpec?.id === sp.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}
                          >
                            {sp.name}
                          </p>
                          {sp.role && <p className="text-xs text-gray-400 truncate">{sp.role}</p>}
                        </div>
                        {selectedSpec?.id === sp.id && (
                          <div className="w-2 h-2 rounded-full bg-primary-600 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Service */}
              {services.length > 0 && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Услуга
                  </p>
                  <div className="space-y-2">
                    {services.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => setSelectedService(svc)}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all ${
                          selectedService?.id === svc.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${selectedService?.id === svc.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}
                          >
                            {svc.name}
                          </p>
                          {svc.duration && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {svc.duration} мин
                            </p>
                          )}
                        </div>
                        {svc.price != null && (
                          <span
                            className={`text-sm font-semibold ml-4 flex-shrink-0 ${selectedService?.id === svc.id ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            {svc.price === 0
                              ? 'Бесплатно'
                              : `${svc.price.toLocaleString()} ${svc.currency ?? 'KGS'}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar */}
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Выберите дату
                </p>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={prevMo}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {MO[month]} {year}
                  </span>
                  <button
                    onClick={nextMo}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-2">
                  {WD.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {calDays.map((day, i) => {
                    if (!day) return <div key={i} />
                    const d = ds(day)
                    const past = isPast(day)
                    const isTd = d === todayStr
                    const sel = selectedDate === d
                    return (
                      <button
                        key={i}
                        disabled={past}
                        onClick={() => {
                          setSelectedDate(d)
                          setSelectedSlot(null)
                        }}
                        className={`aspect-square text-sm font-medium rounded-xl transition-all ${
                          past
                            ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                            : sel
                              ? 'bg-primary-600 text-white font-semibold shadow-sm'
                              : isTd
                                ? 'text-primary-700 dark:text-primary-300 ring-1 ring-primary-400 font-semibold'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slots */}
              {selectedDate && (
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Доступное время
                  </p>
                  {slotsLoading ? (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="h-10 w-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : slotsForDay.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">
                      Нет свободных слотов — выберите другой день
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slotsForDay.map((sl) => (
                        <button
                          key={sl.id}
                          onClick={() => setSelectedSlot(sl)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                            selectedSlot?.id === sl.id
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:text-primary-700'
                          }`}
                        >
                          {sl.startTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CONFIRM */}
          {step === 'confirm' && selectedSlot && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Подтверждение записи
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 mb-6">
                <DetailRow label="Организация" value={org.name} />
                {selectedSpec && <DetailRow label="Специалист" value={selectedSpec.name} />}
                {selectedService && <DetailRow label="Услуга" value={selectedService.name} />}
                <DetailRow label="Дата" value={fmtDate(selectedSlot.date)} />
                <DetailRow
                  label="Время"
                  value={`${selectedSlot.startTime} — ${selectedSlot.endTime}`}
                />
                {selectedService?.price != null && (
                  <DetailRow
                    label="Стоимость"
                    value={
                      selectedService.price === 0
                        ? 'Бесплатно'
                        : `${selectedService.price.toLocaleString()} ${selectedService.currency ?? 'KGS'}`
                    }
                    bold
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step === 'pick' && (
          <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
            <button
              disabled={!canProceed}
              onClick={() => setStep('confirm')}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
                canProceed
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              {!selectedDate ? 'Выберите дату' : !selectedSlot ? 'Выберите время' : 'Продолжить'}
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 flex gap-2">
            <button
              onClick={() => setStep('pick')}
              className="flex-shrink-0 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors"
            >
              Назад
            </button>
            <button
              disabled={booking}
              onClick={handleBook}
              className="flex-1 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-all"
            >
              {booking ? 'Оформляем запись…' : 'Подтвердить запись'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
      <span
        className={`text-sm text-right ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {value}
      </span>
    </div>
  )
}
