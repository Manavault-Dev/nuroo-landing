'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, CalendarDays, Bell, BarChart2, ChevronRight } from 'lucide-react'

function GoogleMeetIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/google-meet.svg"
      alt="Google Meet"
      width={size}
      height={size}
      className="object-contain"
    />
  )
}

function GoogleCalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/google-calendar.svg"
      alt="Google Calendar"
      width={size}
      height={size}
      className="object-contain"
    />
  )
}

const FLOATING_STATES = [
  {
    icon: 'calendar',
    title: 'Новая запись',
    sub: 'Айдана К. · Логопедия · Завтра 10:00',
    color: 'teal',
  },
  {
    icon: 'bell',
    title: 'Напоминание отправлено',
    sub: '8 клиентам · занятие завтра в 10:00',
    color: 'amber',
  },
  {
    icon: 'meet',
    title: 'Google Meet создан',
    sub: 'meet.google.com/nuroo-abc-xyz',
    color: 'blue',
  },
]

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']
const CALENDAR_EVENTS: Record<number, { time: string; name: string; color: string }[]> = {
  0: [
    { time: '10:00', name: 'Логоп. А', color: 'teal' },
    { time: '14:00', name: 'Психол.', color: 'violet' },
  ],
  1: [{ time: '11:00', name: 'Арт-тер.', color: 'amber' }],
  2: [
    { time: '10:00', name: 'Логоп. А', color: 'teal' },
    { time: '13:00', name: 'Консульт.', color: 'teal' },
  ],
  3: [{ time: '09:00', name: 'Дефектол.', color: 'rose' }],
  4: [
    { time: '14:00', name: 'Психол.', color: 'violet' },
    { time: '16:00', name: 'Арт-тер.', color: 'amber' },
  ],
}

const CLIENTS = [
  {
    name: 'Алина С.',
    age: '5 лет',
    next: 'Пн 10:00',
    specialist: 'Айгерим М.',
    initials: 'АС',
    avatarBg: '#0D9488',
  },
  {
    name: 'Дамир Н.',
    age: '7 лет',
    next: 'Вт 11:00',
    specialist: 'Нурлан Б.',
    initials: 'ДН',
    avatarBg: '#7C3AED',
  },
  {
    name: 'Зарина К.',
    age: '4 года',
    next: 'Ср 10:00',
    specialist: 'Айгерим М.',
    initials: 'ЗК',
    avatarBg: '#0891B2',
  },
]

const GROUPS = [
  {
    name: 'Логопедия. Группа А',
    days: 'Пн, Ср',
    time: '10:00',
    enrolled: 6,
    capacity: 8,
    color: 'teal',
  },
  {
    name: 'Арт-терапия 4–7 лет',
    days: 'Вт, Чт',
    time: '14:00',
    enrolled: 9,
    capacity: 10,
    color: 'amber',
  },
]

function colorClass(c: string, variant: 'bg' | 'text' | 'border') {
  const map: Record<string, Record<string, string>> = {
    teal: { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-700' },
    violet: { bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-700' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-700' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-700' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-700' },
  }
  return map[c]?.[variant] ?? ''
}

export function BusinessDashboard() {
  const t = useTranslations('landing.dashboard')
  const [activeFloat, setActiveFloat] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveFloat((p) => (p + 1) % FLOATING_STATES.length), 3500)
    return () => clearInterval(id)
  }, [])

  const state = FLOATING_STATES[activeFloat]

  return (
    <section className="py-20 lg:py-28 bg-gray-950">
      <div className="container-custom">
        {/* Header */}
        <div className="max-w-2xl mb-12">
          <span className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-widest mb-4">
            {t('eyebrow')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            {t('title')}
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">{t('subtitle')}</p>
        </div>

        {/* Dashboard mockup */}
        <div className="rounded-2xl border border-gray-800 overflow-hidden shadow-2xl relative min-w-0">
          {/* Floating state notification */}
          <div
            key={activeFloat}
            className="absolute top-3 right-3 z-20 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl dashboard-float-in max-w-[calc(100%-1.5rem)]"
          >
            <span className="flex-shrink-0">
              {state.icon === 'meet' ? (
                <GoogleMeetIcon size={22} />
              ) : state.icon === 'calendar' ? (
                <GoogleCalendarIcon size={22} />
              ) : (
                <Bell className="w-[22px] h-[22px] text-amber-400" />
              )}
            </span>
            <div className="min-w-0">
              <div className={`text-xs font-semibold truncate ${colorClass(state.color, 'text')}`}>
                {state.title}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 truncate">{state.sub}</div>
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-48 bg-gray-900 border-r border-gray-800 p-4 min-h-[520px]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-lg bg-teal-600 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">N</span>
                </div>
                <span className="text-sm font-semibold text-white">Nuroo</span>
              </div>
              <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2 px-2">
                Управление
              </div>
              {[
                { label: 'Дашборд', icon: BarChart2, active: true },
                { label: 'Клиенты', icon: Users, active: false },
                { label: 'Расписание', icon: CalendarDays, active: false },
                { label: 'Группы', icon: Users, active: false },
                { label: 'Уведомления', icon: Bell, active: false },
              ].map(({ label, icon: Icon, active }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 cursor-default ${
                    active ? 'bg-teal-600/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 bg-gray-950 p-5 min-w-0">
              {/* Top bar */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-sm font-bold text-white">Детский центр «Развитие»</div>
                  <div className="text-xs text-gray-500">Административная панель</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className="w-4 h-4 text-gray-500" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 rounded-full border border-gray-950" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center text-[10px] text-white font-bold">
                    АД
                  </div>
                </div>
              </div>

              {/* Metric tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { value: '24', label: 'Клиентов', tone: 'default' },
                  { value: '6', label: 'Записей сегодня', tone: 'good' },
                  { value: '4', label: 'Специалиста', tone: 'default' },
                  { value: '2', label: 'Активных группы', tone: 'default' },
                ].map(({ value, label, tone }) => (
                  <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                    <div
                      className={`text-xl font-bold ${tone === 'good' ? 'text-teal-400' : 'text-white'}`}
                    >
                      {value}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Calendar */}
                <div className="lg:col-span-3 bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-white">Эта неделя</div>
                    <div className="text-[10px] text-gray-500">18–22 авг 2025</div>
                  </div>
                  <div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {WEEK_DAYS.map((day, di) => (
                        <div key={day}>
                          <div className="text-[9px] font-semibold text-gray-500 text-center mb-1.5">
                            {day}
                          </div>
                          <div className="flex flex-col gap-1 min-h-[80px]">
                            {(CALENDAR_EVENTS[di] ?? []).map((ev) => (
                              <div
                                key={ev.name}
                                className={`px-1.5 py-1 rounded-lg border ${colorClass(ev.color, 'border')} bg-gray-800`}
                              >
                                <div
                                  className={`text-[8px] font-bold ${colorClass(ev.color, 'text')}`}
                                >
                                  {ev.time}
                                </div>
                                <div className="text-[8px] text-gray-300 leading-tight">
                                  {ev.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                  {/* Groups */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="text-xs font-semibold text-white mb-3">Группы</div>
                    {GROUPS.map((g) => (
                      <div key={g.name} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-gray-200 truncate">
                            {g.name}
                          </span>
                          <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                            {g.enrolled}/{g.capacity}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${g.color === 'teal' ? 'bg-teal-500' : 'bg-amber-500'}`}
                            style={{ width: `${(g.enrolled / g.capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Clients */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1">
                    <div className="text-xs font-semibold text-white mb-3">Клиенты</div>
                    <div className="flex flex-col gap-2">
                      {CLIENTS.map((c) => (
                        <div key={c.name} className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: c.avatarBg }}
                          >
                            <span className="text-[8px] font-bold text-white leading-none">
                              {c.initials}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold text-gray-200 truncate">
                              {c.name}
                            </div>
                            <div className="text-[9px] text-gray-500">{c.next}</div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {[
            { iconEl: <GoogleCalendarIcon size={22} />, labelKey: 'f1label', descKey: 'f1desc' },
            {
              iconEl: <Bell className="w-5 h-5 text-amber-400" />,
              labelKey: 'f2label',
              descKey: 'f2desc',
            },
            { iconEl: <GoogleMeetIcon size={22} />, labelKey: 'f3label', descKey: 'f3desc' },
            {
              iconEl: <Users className="w-5 h-5 text-teal-400" />,
              labelKey: 'f4label',
              descKey: 'f4desc',
            },
          ].map(({ iconEl, labelKey, descKey }) => (
            <div key={labelKey} className="p-4 rounded-xl bg-gray-900 border border-gray-800">
              <div className="mb-2">{iconEl}</div>
              <div className="text-sm font-semibold text-white mb-1">{t(labelKey)}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{t(descKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
