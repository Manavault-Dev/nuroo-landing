'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ru } from 'react-day-picker/locale'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function parseLocal(iso: string): { date: Date | undefined; hh: string; mm: string } {
  if (!iso) return { date: undefined, hh: '12', mm: '00' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: undefined, hh: '12', mm: '00' }
  return {
    date: d,
    hh: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
  }
}

function toISO(date: Date, hh: string, mm: string): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}T${hh}:${mm}`
}

function formatDisplay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DateTimePicker({ value, onChange, placeholder = 'Выберите дату и время' }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date | undefined>()
  const [hh, setHh] = useState('12')
  const [mm, setMm] = useState('00')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { date, hh: h, mm: m } = parseLocal(value)
    setSelected(date)
    setHh(h)
    setMm(m)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const commit = (date: Date | undefined, h: string, m: string) => {
    if (date) onChange(toISO(date, h, m))
  }

  const handleDaySelect = (day: Date | undefined) => {
    setSelected(day)
    commit(day, hh, mm)
  }

  const handleTimeChange = (raw: string) => {
    const [h = '12', m = '00'] = raw.split(':')
    setHh(h)
    setMm(m)
    commit(selected, h, m)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(undefined)
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-white dark:bg-gray-900 text-sm text-left transition-colors focus:outline-none ${
          open
            ? 'border-primary-400 ring-2 ring-primary-400/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <span
          className={`flex-1 truncate ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
        >
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            onClick={clear}
            className="p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[200] w-[280px] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Calendar */}
          <div className="p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleDaySelect}
              locale={ru}
              showOutsideDays
              classNames={{
                root: 'w-full',
                month_caption: 'flex items-center justify-between mb-1.5',
                caption_label: 'text-xs font-bold text-gray-900 dark:text-white',
                nav: 'flex items-center gap-0.5',
                button_previous:
                  'p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors',
                button_next:
                  'p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors',
                weeks: 'w-full',
                weekdays: 'flex',
                weekday: 'flex-1 text-center text-[10px] font-semibold text-gray-400 py-0.5',
                week: 'flex',
                day: 'flex-1 flex items-center justify-center',
                day_button:
                  'w-7 h-7 rounded-lg text-xs font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-300',
                selected: '[&>button]:!bg-primary-600 [&>button]:!text-white',
                today:
                  '[&>button]:font-bold [&>button]:text-primary-600 dark:[&>button]:text-primary-400',
                outside: '[&>button]:!text-gray-300 dark:[&>button]:!text-gray-600',
              }}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ),
              }}
            />
          </div>

          {/* Time row */}
          <div className="flex items-center gap-3 px-3 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
            <span className="text-xs font-semibold text-gray-400">Время</span>
            <input
              type="time"
              value={`${hh}:${mm}`}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent cursor-text"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
