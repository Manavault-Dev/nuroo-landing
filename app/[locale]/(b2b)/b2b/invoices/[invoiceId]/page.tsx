'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Clock, AlertCircle, XCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import { apiClient, type Invoice } from '@/lib/b2b/api'
import { PageSpinner, Spinner } from '@/components/ui/Spinner'

type StatusTheme = {
  icon: React.ReactNode
  title: string
  message: string
  bg: string
  border: string
  textColor: string
}

function getStatusTheme(status: string, returnStatus: string | null): StatusTheme {
  // If the URL has ?status=paid (return from Finik payment page) show success
  // even before the webhook confirms — the payment was accepted by Finik
  const effectiveStatus = returnStatus === 'paid' ? 'paid' : status

  switch (effectiveStatus) {
    case 'paid':
      return {
        icon: <CheckCircle className="w-16 h-16 text-emerald-500" />,
        title: 'Оплата получена',
        message: 'Платёж успешно проведён. Статус счёта обновлён.',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        textColor: 'text-emerald-700',
      }
    case 'pending':
      return {
        icon: <Clock className="w-16 h-16 text-amber-500" />,
        title: 'Ожидание подтверждения',
        message: 'Платёж обрабатывается. Статус обновится автоматически.',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        textColor: 'text-amber-700',
      }
    case 'failed':
      return {
        icon: <AlertCircle className="w-16 h-16 text-red-500" />,
        title: 'Платёж не прошёл',
        message: 'Произошла ошибка при обработке платежа. Попробуйте ещё раз.',
        bg: 'bg-red-50',
        border: 'border-red-200',
        textColor: 'text-red-700',
      }
    case 'expired':
      return {
        icon: <XCircle className="w-16 h-16 text-gray-400" />,
        title: 'Срок оплаты истёк',
        message: 'Время для оплаты этого счёта истекло. Обратитесь в организацию.',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        textColor: 'text-gray-600',
      }
    case 'canceled':
      return {
        icon: <XCircle className="w-16 h-16 text-gray-400" />,
        title: 'Счёт отменён',
        message: 'Этот счёт был отменён.',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        textColor: 'text-gray-600',
      }
    default:
      return {
        icon: <Clock className="w-16 h-16 text-blue-500" />,
        title: 'Детали счёта',
        message: '',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        textColor: 'text-blue-700',
      }
  }
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { orgId, isLoading: authLoading } = usePageAuth()

  const invoiceId = params.invoiceId as string
  // ?status=paid is appended by the returnUrl when Finik redirects user back
  const returnStatus = searchParams.get('status')

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  const load = useCallback(async () => {
    if (!orgId || !invoiceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getInvoices(orgId)
      const found = (res.invoices ?? []).find((inv) => inv.id === invoiceId)
      setInvoice(found ?? null)
    } catch {
      setError('Не удалось загрузить данные счёта.')
    } finally {
      setLoading(false)
    }
  }, [orgId, invoiceId])

  // Initial load
  useEffect(() => {
    if (!authLoading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgId])

  // Auto-refresh once when user arrives via returnUrl (?status=paid)
  // The webhook may not have fired yet — poll up to 3 times every 3 s
  useEffect(() => {
    if (returnStatus !== 'paid') return
    if (invoice?.status === 'paid') return
    if (refreshCount >= 3) return

    const timer = setTimeout(() => {
      setRefreshCount((c) => c + 1)
      void load()
    }, 3_000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnStatus, invoice?.status, refreshCount])

  if (authLoading || (loading && !invoice)) return <PageSpinner />

  const theme = getStatusTheme(invoice?.status ?? 'pending', returnStatus)

  const statusLabels: Record<string, string> = {
    paid: 'Оплачено',
    pending: 'Ожидает оплаты',
    upcoming: 'Предстоящий',
    overdue: 'Просрочен',
    failed: 'Ошибка',
    expired: 'Истёк',
    canceled: 'Отменён',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => router.push('/b2b/finance?tab=invoices')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">К списку счетов</span>
        </button>

        {/* Status card */}
        <div className={`rounded-2xl border ${theme.bg} ${theme.border} p-8 text-center shadow-sm`}>
          <div className="flex justify-center mb-4">{theme.icon}</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{theme.title}</h1>
          {theme.message && <p className={`text-sm ${theme.textColor} mb-6`}>{theme.message}</p>}

          {invoice && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-left mb-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Сумма</span>
                <span className="font-bold text-gray-900">
                  {invoice.amount.toLocaleString('ru-RU')} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Статус</span>
                <span
                  className={`text-sm font-semibold ${
                    invoice.status === 'paid'
                      ? 'text-emerald-600'
                      : invoice.status === 'overdue' || invoice.status === 'failed'
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {statusLabels[invoice.status] ?? invoice.status}
                </span>
              </div>
              {invoice.description && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-sm text-gray-500 shrink-0">Описание</span>
                  <span className="text-sm text-gray-700 text-right">{invoice.description}</span>
                </div>
              )}
              {invoice.dueDate && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Срок оплаты</span>
                  <span className="text-sm text-gray-700">
                    {new Date(invoice.dueDate + 'T00:00:00').toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Оплачено</span>
                  <span className="text-sm text-emerald-600 font-medium">
                    {new Date(invoice.paidAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          {/* Polling indicator for pending after payment return */}
          {returnStatus === 'paid' && invoice?.status !== 'paid' && refreshCount < 3 && (
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 mb-4">
              <Spinner size="sm" />
              <span>Ожидаем подтверждения от банка…</span>
            </div>
          )}

          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            <span>Обновить статус</span>
          </button>
        </div>
      </div>
    </div>
  )
}
