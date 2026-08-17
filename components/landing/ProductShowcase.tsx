'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, MapPin, Phone } from 'lucide-react'

// ─── Org Profile Mockup ────────────────────────────────────────────────────
function OrgProfileMockup() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xl">
      {/* Cover */}
      <div className="relative h-28 bg-teal-600">
        <Image
          src="/hero-center.png"
          alt="Детский центр"
          fill
          className="object-cover opacity-70"
          sizes="480px"
        />
        {/* Logo */}
        <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl bg-white dark:bg-gray-900 border-2 border-white dark:border-gray-800 shadow-md overflow-hidden">
          <Image src="/hero-center.png" alt="Logo" fill className="object-cover" sizes="48px" />
        </div>
      </div>

      {/* Header */}
      <div className="pt-8 px-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Детский центр «Развитие»
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-amber-500">★★★★★</span>
              <span className="text-[10px] text-gray-400">4.9 · 38 отзывов</span>
            </div>
          </div>
          <div className="flex gap-1">
            {['Логопедия', 'Психология'].map((c) => (
              <span
                key={c}
                className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[9px] font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <MapPin className="w-3 h-3" />
            Бишкек, ул. Токтогула
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Phone className="w-3 h-3" />
            +996 700 …
          </div>
        </div>
      </div>

      {/* Programs */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Программы и группы
        </div>
        <div className="flex flex-col gap-2">
          {[
            {
              src: '/prog-school.png',
              name: 'Подготовка к школе',
              schedule: 'Пн, Ср · 10:00',
              spots: '3 места',
            },
            {
              src: '/prog-masterclass.png',
              name: 'Арт-терапия 4–7 лет',
              schedule: 'Вт, Чт · 14:00',
              spots: '7 мест',
            },
          ].map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
            >
              <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden relative">
                <Image src={p.src} alt={p.name} fill className="object-cover" sizes="36px" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-gray-800 dark:text-white truncate">
                  {p.name}
                </div>
                <div className="text-[10px] text-gray-400">{p.schedule}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-teal-600 font-medium">{p.spots}</div>
                <div className="text-[9px] text-teal-600 font-semibold mt-0.5">Записаться →</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Booking Flow Mockup ───────────────────────────────────────────────────
const DATES = ['Пн 18', 'Вт 19', 'Ср 20', 'Чт 21', 'Пт 22']
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

function BookingFlowMockup() {
  const [selectedDate, setSelectedDate] = useState(1)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  if (confirmed) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-6 flex flex-col items-center text-center booking-success-enter">
        <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center mb-4">
          <CheckCircle className="w-7 h-7 text-teal-600" />
        </div>
        <div className="text-base font-bold text-gray-900 dark:text-white mb-1">
          Запись подтверждена
        </div>
        <div className="flex items-center gap-3 my-3">
          <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0 border border-gray-100">
            <Image
              src="/specialist-profile.png"
              alt="Айзада М."
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div className="text-sm text-left text-gray-500 dark:text-gray-400">
            Айзада М. · Логопед
            <br />
            {DATES[selectedDate]} · {SLOTS[selectedSlot!]}
          </div>
        </div>
        <div className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-left mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <div className="text-xs font-semibold text-gray-800 dark:text-white">
                Google Meet создан
              </div>
              <div className="text-[10px] text-teal-600">meet.google.com/abc-nuroo-xyz</div>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setConfirmed(false)
            setSelectedSlot(null)
          }}
          className="text-xs text-gray-400 hover:text-teal-600 transition-colors"
        >
          ← Назад
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
      {/* Header with real photo */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl overflow-hidden relative flex-shrink-0">
          <Image
            src="/specialist-profile.png"
            alt="Айзада М."
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
        <div>
          <div className="text-xs font-bold text-gray-900 dark:text-white">Айзада М. · Логопед</div>
          <div className="text-[10px] text-gray-400">Консультация · 50 мин · 1 800 сом</div>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Date picker */}
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Выберите дату
        </div>
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {DATES.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                setSelectedDate(i)
                setSelectedSlot(null)
              }}
              className={`py-2 rounded-xl text-center transition-all ${
                selectedDate === i
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-teal-300'
              }`}
            >
              <div className="text-[8px] font-medium">{d.split(' ')[0]}</div>
              <div className="text-[11px] font-bold">{d.split(' ')[1]}</div>
            </button>
          ))}
        </div>

        {/* Time slots */}
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Доступное время
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {SLOTS.map((s, i) => {
            const unavail = i === 2 || i === 4
            return (
              <button
                key={s}
                disabled={unavail}
                onClick={() => !unavail && setSelectedSlot(i)}
                className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                  unavail
                    ? 'border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 line-through cursor-default'
                    : selectedSlot === i
                      ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-teal-400 bg-white dark:bg-gray-800'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => selectedSlot !== null && setConfirmed(true)}
          disabled={selectedSlot === null}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
            selectedSlot !== null
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
          }`}
        >
          {selectedSlot !== null ? `Записаться на ${SLOTS[selectedSlot]}` : 'Выберите время'}
        </button>
      </div>
    </div>
  )
}

// ─── Programs Carousel ─────────────────────────────────────────────────────
const PROGRAMS = [
  {
    src: '/prog-school.png',
    name: 'Подготовка к школе',
    age: '5–7 лет',
    days: 'Пн, Ср · 17:00',
    spots: '8 / 10 мест',
    price: '3 500',
  },
  {
    src: '/prog-robotics.png',
    name: 'Робототехника',
    age: '8–12 лет',
    days: 'Чт · Сб 15:00',
    spots: '6 / 12 мест',
    price: '4 000',
  },
  {
    src: '/prog-english.png',
    name: 'Английский язык',
    age: '6–10 лет',
    days: 'Вт, Чт · 16:00',
    spots: '7 / 10 мест',
    price: '3 000',
  },
  {
    src: '/prog-masterclass.png',
    name: 'Мастер-класс по арту',
    age: '24 мая · 12:00',
    days: '',
    spots: 'Осталось 4 места',
    price: '1 800',
  },
]

function ProgramsSection({ t }: { t: (key: string) => string }) {
  return (
    <div className="mt-24 lg:mt-32">
      <div className="mb-8">
        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
          {t('s3eyebrow')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-3 leading-tight">
          {t('s3title')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl">{t('s3subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PROGRAMS.map((p) => (
          <div
            key={p.name}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="relative w-full aspect-video overflow-hidden">
              <Image
                src={p.src}
                alt={p.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="p-3">
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1 leading-tight">
                {p.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {p.age}
                {p.days ? ` · ${p.days}` : ''}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{p.spots}</span>
                <span className="text-xs font-bold text-teal-600">{p.price} сом/мес</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────
export function ProductShowcase() {
  const t = useTranslations('landing.showcase')

  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-gray-950">
      <div className="container-custom">
        {/* Block 1: Org profile — copy left, mockup right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">
              {t('s1eyebrow')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-5 leading-tight">
              {t('s1title')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-6">
              {t('s1subtitle')}
            </p>
            <ul className="space-y-3">
              {(['s1f1', 's1f2', 's1f3', 's1f4'] as const).map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"
                >
                  <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <OrgProfileMockup />
          </div>
        </div>

        {/* Block 2: Booking — mockup left, copy right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mt-24 lg:mt-32">
          <div className="order-2 lg:order-1">
            <BookingFlowMockup />
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">
              {t('s2eyebrow')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-5 leading-tight">
              {t('s2title')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-6">
              {t('s2subtitle')}
            </p>
            <ul className="space-y-3">
              {(['s2f1', 's2f2', 's2f3', 's2f4'] as const).map((key) => (
                <li
                  key={key}
                  className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"
                >
                  <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <div className="mt-6 p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900">
              <p className="text-sm text-teal-700 dark:text-teal-300 font-medium">
                {t('s2tryCta')}
              </p>
            </div>
          </div>
        </div>

        {/* Programs grid */}
        <ProgramsSection t={t} />
      </div>
    </section>
  )
}
