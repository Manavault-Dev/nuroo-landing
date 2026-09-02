'use client'

import { useEffect, useRef, useState } from 'react'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { getIdToken } from '@/lib/b2b/authClient'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
// Resize cover to ≤600px wide at JPEG 0.55 → ~50–150KB, safely under Firestore's 1MB field limit
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 600
      const scale = img.width > MAX ? MAX / img.width : 1
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.55))
    }
    img.onerror = reject
    img.src = url
  })
}
import {
  Plus,
  Calendar,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Loader2,
  X,
  Wifi,
  ImagePlus,
  Download,
  ChevronLeft,
} from 'lucide-react'

const API = `${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101').replace(/\/+$/, '')}/v1`

interface OrgEvent {
  id: string
  title: string
  description: string
  date: string
  endDate: string | null
  location: string
  city: string | null
  format: 'online' | 'offline' | 'hybrid'
  price: number
  currency: string
  spotsTotal: number
  registeredCount: number
  status: 'draft' | 'published' | 'cancelled'
  coverUrl: string | null
}

interface Registration {
  uid: string
  displayName: string | null
  email: string | null
  phone: string | null
  registeredAt: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  date: '',
  endDate: '',
  location: '',
  city: '',
  format: 'offline' as OrgEvent['format'],
  price: 0,
  currency: 'KGS',
  spotsTotal: 0,
  status: 'draft' as OrgEvent['status'],
  coverUrl: '',
}

export default function EventsPage() {
  const { orgId, isAdmin, isLoading } = usePageAuth()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OrgEvent | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [regsEvent, setRegsEvent] = useState<OrgEvent | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [regsLoading, setRegsLoading] = useState(false)

  const fetchEvents = async () => {
    if (!orgId) return
    const token = await getIdToken()
    const res = await fetch(`${API}/orgs/${orgId}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(data.events ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isLoading && orgId) fetchEvents()
  }, [isLoading, orgId])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (ev: OrgEvent) => {
    setEditing(ev)
    setForm({
      title: ev.title,
      description: ev.description,
      date: ev.date ? ev.date.slice(0, 16) : '',
      endDate: ev.endDate ? ev.endDate.slice(0, 16) : '',
      location: ev.location,
      city: ev.city ?? '',
      format: ev.format,
      price: ev.price,
      currency: ev.currency,
      spotsTotal: ev.spotsTotal,
      status: ev.status,
      coverUrl: ev.coverUrl ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!orgId || saving) return
    setSaving(true)
    try {
      const token = await getIdToken()
      const body = {
        ...form,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        coverUrl: form.coverUrl || null,
        city: form.city || null,
      }
      const url = editing
        ? `${API}/orgs/${orgId}/events/${editing.id}`
        : `${API}/orgs/${orgId}/events`
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setModalOpen(false)
        fetchEvents()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!orgId || !confirm('Удалить мероприятие?')) return
    setDeleting(id)
    const token = await getIdToken()
    await fetch(`${API}/orgs/${orgId}/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDeleting(null)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const openRegistrations = async (ev: OrgEvent) => {
    setRegsEvent(ev)
    setRegs([])
    setRegsLoading(true)
    const token = await getIdToken()
    const res = await fetch(`${API}/orgs/${orgId}/events/${ev.id}/registrations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setRegs(data.registrations ?? [])
    }
    setRegsLoading(false)
  }

  const exportCsv = () => {
    if (!regsEvent || regs.length === 0) return
    const header = 'Имя,Email,Телефон,Дата регистрации'
    const rows = regs.map((r) =>
      [
        r.displayName ?? '—',
        r.email ?? '—',
        r.phone ?? '—',
        new Date(r.registeredAt).toLocaleString('ru-RU'),
      ]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-${regsEvent.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleTogglePublish = async (ev: OrgEvent) => {
    if (!orgId) return
    const next = ev.status === 'published' ? 'draft' : 'published'
    const token = await getIdToken()
    const res = await fetch(`${API}/orgs/${orgId}/events/${ev.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) fetchEvents()
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Мероприятия</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Мастер-классы, вебинары, открытые занятия
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-1">Мероприятий пока нет</p>
          <p className="text-sm text-gray-400">
            Создайте первое мероприятие — мастер-класс или вебинар
          </p>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="mt-6 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Создать мероприятие
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              isAdmin={isAdmin}
              deleting={deleting === ev.id}
              onEdit={() => openEdit(ev)}
              onDelete={() => handleDelete(ev.id)}
              onTogglePublish={() => handleTogglePublish(ev)}
              onViewRegistrations={() => openRegistrations(ev)}
            />
          ))}
        </div>
      )}

      {regsEvent && (
        <RegistrationsPanel
          event={regsEvent}
          regs={regs}
          loading={regsLoading}
          onClose={() => setRegsEvent(null)}
          onExport={exportCsv}
        />
      )}

      {modalOpen && (
        <EventModal
          form={form}
          editing={editing}
          saving={saving}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function EventCard({
  event: ev,
  isAdmin,
  deleting,
  onEdit,
  onDelete,
  onTogglePublish,
  onViewRegistrations,
}: {
  event: OrgEvent
  isAdmin: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
  onViewRegistrations: () => void
}) {
  const dateLabel = new Date(ev.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusColors = {
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col shadow-sm">
      <div className="h-36 bg-gradient-to-br from-violet-500 to-purple-700 relative overflow-hidden">
        {ev.coverUrl && <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-black/25" />
        <span
          className={`absolute top-2 right-2 text-[11px] font-bold px-2 py-1 rounded-full ${statusColors[ev.status]}`}
        >
          {ev.status === 'published'
            ? 'Опубликовано'
            : ev.status === 'draft'
              ? 'Черновик'
              : 'Отменено'}
        </span>
        <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-1.5">
          <div className="text-[11px] font-bold text-gray-900 dark:text-white">{dateLabel}</div>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug mb-2 line-clamp-2">
          {ev.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
          {ev.format === 'online' ? <Wifi className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
          <span className="truncate">{ev.location}</span>
        </div>
        <button
          onClick={onViewRegistrations}
          className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 font-semibold mb-4 hover:underline"
        >
          <Users className="w-3 h-3" />
          <span>{ev.registeredCount} зарегистрировались</span>
          {ev.spotsTotal > 0 && (
            <span className="text-gray-400 font-normal">/ {ev.spotsTotal}</span>
          )}
        </button>

        {isAdmin && (
          <div className="mt-auto flex items-center gap-2">
            <button
              onClick={onTogglePublish}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                ev.status === 'published'
                  ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {ev.status === 'published' ? 'Снять с публикации' : 'Опубликовать'}
            </button>
            <button
              onClick={onEdit}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 transition-colors disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RegistrationsPanel({
  event: ev,
  regs,
  loading,
  onClose,
  onExport,
}: {
  event: OrgEvent
  regs: Registration[]
  loading: boolean
  onClose: () => void
  onExport: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">
                {ev.title}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 pl-8">
              Список зарегистрированных участников
            </p>
          </div>
          <div className="flex items-center gap-2">
            {regs.length > 0 && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : regs.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Пока никто не зарегистрировался</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-3 pr-4">Имя</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Телефон</th>
                  <th className="pb-3 text-right">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {regs.map((r) => (
                  <tr
                    key={r.uid}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {r.displayName ?? '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{r.email ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {r.phone ?? '—'}
                    </td>
                    <td className="py-3 text-right text-gray-400 tabular-nums text-xs whitespace-nowrap">
                      {new Date(r.registeredAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && regs.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
            <p className="text-xs text-gray-400">
              Всего зарегистрировано:{' '}
              <span className="font-semibold text-gray-600 dark:text-gray-300">{regs.length}</span>
              {ev.spotsTotal > 0 ? ` из ${ev.spotsTotal}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const FORMAT_OPTIONS = [
  { value: 'offline', label: 'Офлайн' },
  { value: 'online', label: 'Онлайн' },
  { value: 'hybrid', label: 'Гибрид' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'cancelled', label: 'Отменено' },
]

function EventModal({
  form,
  editing,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  form: typeof EMPTY_FORM
  editing: OrgEvent | null
  saving: boolean
  onChange: (patch: Partial<typeof EMPTY_FORM>) => void
  onSave: () => void
  onClose: () => void
}) {
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await compressImage(file)
    onChange({ coverUrl: dataUrl })
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      {node}
    </div>
  )
  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
    />
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {editing ? 'Редактировать мероприятие' : 'Новое мероприятие'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Заполните основные данные о мероприятии</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Cover preview / upload */}
          <div
            className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 cursor-pointer group"
            onClick={() => !form.coverUrl && coverInputRef.current?.click()}
          >
            {form.coverUrl && (
              <img
                src={form.coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity ${form.coverUrl ? 'opacity-0 group-hover:opacity-100 bg-black/40' : 'opacity-100'}`}
            >
              <ImagePlus className="w-6 h-6 text-white" />
              <span className="text-xs font-semibold text-white">
                {form.coverUrl ? 'Изменить обложку' : 'Загрузить обложку'}
              </span>
            </div>
            {form.coverUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange({ coverUrl: '' })
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2 -mt-2">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline"
            >
              {form.coverUrl ? 'Заменить файл' : 'Выбрать файл'}
            </button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <input
              placeholder="или вставьте URL…"
              value={form.coverUrl.startsWith('data:') ? '' : form.coverUrl}
              onChange={(e) => onChange({ coverUrl: e.target.value })}
              className="flex-1 text-xs px-0 py-0 bg-transparent border-0 text-gray-500 dark:text-gray-400 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFile}
          />

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Title */}
          {field(
            'Название',
            input({
              placeholder: 'Мастер-класс по акварели',
              value: form.title,
              onChange: (e) => onChange({ title: e.target.value }),
            })
          )}

          {/* Description */}
          {field(
            'Описание',
            <textarea
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              placeholder="Расскажите о программе, для кого подходит, что возьмите с собой…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {field(
              'Начало',
              <DateTimePicker
                value={form.date}
                onChange={(v) => onChange({ date: v })}
                placeholder="Дата и время"
              />
            )}
            {field(
              'Конец',
              <DateTimePicker
                value={form.endDate}
                onChange={(v) => onChange({ endDate: v })}
                placeholder="Необязательно"
              />
            )}
          </div>

          {/* Location + Format */}
          <div className="grid grid-cols-2 gap-3">
            {field(
              'Место проведения',
              input({
                placeholder: 'Адрес или платформа',
                value: form.location,
                onChange: (e) => onChange({ location: e.target.value }),
              })
            )}
            {field(
              'Формат',
              <Select
                value={form.format}
                options={FORMAT_OPTIONS}
                onChange={(v) => onChange({ format: v as OrgEvent['format'] })}
              />
            )}
          </div>

          {/* City + Price + Spots */}
          <div className="grid grid-cols-3 gap-3">
            {field(
              'Город',
              input({
                placeholder: 'Бишкек',
                value: form.city,
                onChange: (e) => onChange({ city: e.target.value }),
              })
            )}
            {field(
              'Цена (KGS)',
              input({
                type: 'number',
                min: 0,
                placeholder: '0',
                value: form.price,
                onChange: (e) => onChange({ price: Number(e.target.value) }),
              })
            )}
            {field(
              'Мест',
              input({
                type: 'number',
                min: 0,
                placeholder: '∞',
                value: form.spotsTotal,
                onChange: (e) => onChange({ spotsTotal: Number(e.target.value) }),
              })
            )}
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              {field(
                'Статус публикации',
                <Select
                  value={form.status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => onChange({ status: v as OrgEvent['status'] })}
                />
              )}
            </div>
            {form.price === 0 && (
              <div className="flex items-center gap-2 h-[42px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ✓ Бесплатное мероприятие
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title || !form.date || !form.location}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Сохраняем…' : editing ? 'Сохранить изменения' : 'Создать мероприятие'}
          </button>
        </div>
      </div>
    </div>
  )
}
