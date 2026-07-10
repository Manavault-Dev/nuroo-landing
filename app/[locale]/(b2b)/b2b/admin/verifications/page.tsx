'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  ChevronDown,
  Loader2,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient } from '@/lib/b2b/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChildVerification {
  id: string
  childId: string
  parentUserId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  documentRefs: string[]
  documentUrls: string[]
  note?: string
  rejectionReason?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

const STATUS_TAB = ['PENDING', 'APPROVED', 'REJECTED'] as const
type StatusTab = (typeof STATUS_TAB)[number]

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChildVerification['status'] }) {
  const config = {
    PENDING: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
      label: 'На рассмотрении',
    },
    APPROVED: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: CheckCircle,
      label: 'Одобрено',
    },
    REJECTED: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: XCircle,
      label: 'Отклонено',
    },
  }[status]

  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.border} ${config.text}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function VerificationsAdminPage() {
  usePageAuth()

  const [tab, setTab] = useState<StatusTab>('PENDING')
  const [verifications, setVerifications] = useState<ChildVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionState, setActionState] = useState<Record<string, 'loading' | 'done'>>({})
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({
    id: '',
    open: false,
  })
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async (status: StatusTab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getChildVerificationsForReview(status)
      setVerifications(res.verifications as ChildVerification[])
    } catch (e: any) {
      if (e?.status === 403) {
        setError('Только администраторы Nuroo имеют доступ к этому разделу.')
      } else {
        setError('Не удалось загрузить заявки. Попробуйте ещё раз.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  const approve = async (id: string) => {
    setActionState((s) => ({ ...s, [id]: 'loading' }))
    try {
      await apiClient.reviewChildVerification(id, { status: 'APPROVED' })
      setActionState((s) => ({ ...s, [id]: 'done' }))
      setVerifications((prev) => prev.filter((v) => v.id !== id))
    } catch {
      setActionState((s) => {
        const n = { ...s }
        delete n[id]
        return n
      })
      alert('Ошибка при одобрении. Попробуйте ещё раз.')
    }
  }

  const openReject = (id: string) => {
    setRejectReason('')
    setRejectModal({ id, open: true })
  }

  const confirmReject = async () => {
    if (!rejectReason.trim()) return
    const { id } = rejectModal
    setRejectModal({ id: '', open: false })
    setActionState((s) => ({ ...s, [id]: 'loading' }))
    try {
      await apiClient.reviewChildVerification(id, {
        status: 'REJECTED',
        rejectionReason: rejectReason.trim(),
      })
      setActionState((s) => ({ ...s, [id]: 'done' }))
      setVerifications((prev) => prev.filter((v) => v.id !== id))
    } catch {
      setActionState((s) => {
        const n = { ...s }
        delete n[id]
        return n
      })
      alert('Ошибка при отклонении. Попробуйте ещё раз.')
    }
  }

  const tabLabels: Record<StatusTab, string> = {
    PENDING: 'На рассмотрении',
    APPROVED: 'Одобренные',
    REJECTED: 'Отклонённые',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Верификация льготного доступа</h1>
            <p className="text-sm text-gray-500 mt-1">
              Заявки родителей на бесплатный доступ к курсам для семей с особыми потребностями
            </p>
          </div>
          <button
            onClick={() => load(tab)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {STATUS_TAB.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabLabels[s]}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Нет заявок</p>
          <p className="text-gray-400 text-sm mt-1">В этом статусе заявок не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map((v) => (
            <VerificationCard
              key={v.id}
              verification={v}
              actionState={actionState[v.id]}
              onApprove={() => approve(v.id)}
              onReject={() => openReject(v.id)}
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Отклонить заявку</h3>
            <p className="text-sm text-gray-500 mb-4">
              Укажите причину отклонения — родитель её увидит.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Например: документ нечитаем, истёк срок справки, неверный тип документа..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal({ id: '', open: false })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Verification Card ──────────────────────────────────────────────────────────

function VerificationCard({
  verification: v,
  actionState,
  onApprove,
  onReject,
}: {
  verification: ChildVerification
  actionState?: 'loading' | 'done'
  onApprove: () => void
  onReject: () => void
}) {
  const [docsOpen, setDocsOpen] = useState(false)

  const date = new Date(v.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Top row */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={v.status} />
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Parent UID:</span>{' '}
              <span className="font-mono">{v.parentUserId}</span>
            </p>
            {v.note && (
              <p className="text-sm text-gray-600 mt-2 max-w-lg">
                <span className="font-medium">Примечание: </span>
                {v.note}
              </p>
            )}
            {v.rejectionReason && (
              <p className="text-sm text-red-600 mt-1">
                <span className="font-medium">Причина отклонения: </span>
                {v.rejectionReason}
              </p>
            )}
          </div>

          {/* Actions */}
          {v.status === 'PENDING' && (
            <div className="flex gap-2 shrink-0">
              {actionState === 'loading' ? (
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin mt-2" />
              ) : (
                <>
                  <button
                    onClick={onReject}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Отклонить
                  </button>
                  <button
                    onClick={onApprove}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Одобрить
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Documents accordion */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setDocsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            {v.documentRefs.length} документ(а)
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${docsOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {docsOpen && (
          <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(v.documentUrls?.length ? v.documentUrls : v.documentRefs).map((url, i) =>
              url ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center shrink-0 transition-colors">
                    <FileText className="w-4 h-4 text-gray-500 group-hover:text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">Документ {i + 1}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {v.documentRefs[i]?.split('/').pop() || 'файл'}
                    </p>
                  </div>
                  <Eye className="w-4 h-4 text-gray-400 group-hover:text-primary-500 shrink-0" />
                </a>
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs"
                >
                  <FileText className="w-4 h-4" />
                  Документ {i + 1} (ссылка недоступна)
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
