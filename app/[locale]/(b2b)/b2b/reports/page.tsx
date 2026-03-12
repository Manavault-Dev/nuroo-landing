'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/b2b/api'
import { useAuth } from '@/lib/b2b/AuthContext'
import { usePageAuth } from '@/lib/b2b/usePageAuth'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  BarChart3,
  Users,
  UserX,
  Loader2,
  TrendingUp,
  Target,
  BookOpen,
  Download,
} from 'lucide-react'

type ReportData = Awaited<ReturnType<typeof apiClient.getReports>>
type ReportsTranslator = ReturnType<typeof useTranslations>

const REPORTS_TIMEOUT_MS = 15000
const PDF_PAGE_WIDTH_MM = 210
const PDF_PAGE_HEIGHT_MM = 297
const PDF_MARGIN_MM = 10
const PDF_CONTENT_WIDTH_MM = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2

function formatReportDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function hasReportData(data: NonNullable<ReportData>) {
  return (
    data.childCompletion.length > 0 ||
    data.groupCompletion.length > 0 ||
    data.topParents.length > 0 ||
    data.lowActivity.length > 0 ||
    Boolean(
      data.contentActivity &&
      (data.contentActivity.totalCompleted > 0 || data.contentActivity.byChild.length > 0)
    )
  )
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPdfSection(title: string, content: string) {
  return `
    <section style="margin: 0 0 24px;">
      <h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #111827;">
        ${escapeHtml(title)}
      </h2>
      ${content}
    </section>
  `
}

function renderPdfTable(headers: string[], rows: Array<Array<string | number>>, emptyText: string) {
  if (rows.length === 0) {
    return `<p style="margin: 0; font-size: 12px; color: #6b7280;">${escapeHtml(emptyText)}</p>`
  }

  const headerCells = headers
    .map(
      (header) => `
        <th style="padding: 8px 10px; border: 1px solid #d1d5db; background: #f3f4f6; text-align: left; font-size: 12px;">
          ${escapeHtml(header)}
        </th>
      `
    )
    .join('')

  const bodyRows = rows
    .map(
      (row) => `
        <tr>
          ${row
            .map(
              (cell) => `
                <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-size: 12px; vertical-align: top;">
                  ${escapeHtml(cell)}
                </td>
              `
            )
            .join('')}
        </tr>
      `
    )
    .join('')

  return `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `
}

function buildPdfMarkup(data: NonNullable<ReportData>, days: number, t: ReportsTranslator) {
  const sections = [
    renderPdfSection(
      t('childCompletion'),
      renderPdfTable(
        [t('child'), t('parent'), t('tasks'), t('percent')],
        data.childCompletion.map((row) => [
          row.childName,
          row.parentName ?? '-',
          `${row.completedTasks} / ${row.totalTasks}`,
          `${row.percent}%`,
        ]),
        t('noChildren')
      )
    ),
    renderPdfSection(
      t('groupCompletion'),
      renderPdfTable(
        [t('group'), t('specialist'), t('childrenCount'), t('tasks'), t('percent')],
        data.groupCompletion.map((group) => [
          group.groupName,
          group.specialistName ?? '-',
          group.childCount,
          `${group.completedTasks} / ${group.totalTasks}`,
          `${group.percent}%`,
        ]),
        t('noGroups')
      )
    ),
    renderPdfSection(
      t('topParents'),
      renderPdfTable(
        [t('rank'), t('parent'), t('last7Days'), t('last30Days')],
        data.topParents.map((parent, index) => [
          index + 1,
          parent.parentName,
          parent.completedLast7,
          parent.completedLast30,
        ]),
        t('noActivity')
      )
    ),
    renderPdfSection(
      t('lowActivity'),
      renderPdfTable(
        [t('parent'), t('last7Days'), t('last30Days')],
        data.lowActivity.map((parent) => [parent.parentName, 0, parent.completedLast30]),
        t('noLowActivity')
      )
    ),
  ]

  if (data.contentActivity) {
    sections.push(
      renderPdfSection(
        t('contentActivity'),
        `
          <div style="margin: 0 0 12px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
            <div style="padding: 12px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px;">
              <div style="font-size: 12px; color: #6b7280;">${escapeHtml(t('totalCompleted'))}</div>
              <div style="margin-top: 4px; font-size: 20px; font-weight: 700; color: #111827;">
                ${escapeHtml(data.contentActivity.totalCompleted)}
              </div>
            </div>
            <div style="padding: 12px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px;">
              <div style="font-size: 12px; color: #6b7280;">${escapeHtml(t('last7Days'))}</div>
              <div style="margin-top: 4px; font-size: 20px; font-weight: 700; color: #111827;">
                ${escapeHtml(data.contentActivity.completedLast7Days)}
              </div>
            </div>
            <div style="padding: 12px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px;">
              <div style="font-size: 12px; color: #6b7280;">${escapeHtml(t('last30Days'))}</div>
              <div style="margin-top: 4px; font-size: 20px; font-weight: 700; color: #111827;">
                ${escapeHtml(data.contentActivity.completedLast30Days)}
              </div>
            </div>
          </div>
          ${renderPdfTable(
            [t('child'), t('tasks')],
            data.contentActivity.byChild.map((item) => [item.childId, item.count]),
            t('pdfNoData')
          )}
        `
      )
    )
  }

  return `
    <div style="width: 794px; padding: 24px; background: #ffffff; color: #111827; font-family: Arial, sans-serif;">
      <div style="margin: 0 0 24px;">
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #111827;">
          ${escapeHtml(t('title'))}
        </h1>
        <div style="font-size: 12px; color: #4b5563;">
          ${escapeHtml(t('period'))} ${days} ${escapeHtml(t('days'))}
        </div>
        <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">
          ${escapeHtml(t('pdfGeneratedAt'))}: ${escapeHtml(formatReportDate())}
        </div>
      </div>
      ${sections.join('')}
    </div>
  `
}

function ReportsSpinner() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
    </div>
  )
}

function ReportsContent() {
  const router = useRouter()
  const t = useTranslations('b2b.pages.reports')
  const { user, isLoading: authLoading } = useAuth()
  const { profile, orgId } = usePageAuth()

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/b2b/login')
    }
  }, [authLoading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch reports whenever orgId or days change
  useEffect(() => {
    if (authLoading || !orgId) return

    let cancelled = false
    setLoading(true)
    setError('')

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError('Request timed out. Check your connection and try again.')
        setLoading(false)
      }
    }, REPORTS_TIMEOUT_MS)

    apiClient
      .getReports(orgId, days)
      .then((res) => {
        clearTimeout(timeoutId)
        if (cancelled) return
        if (res.ok) {
          setData(res)
        } else {
          setError('Failed to load reports')
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [orgId, days, authLoading])

  if (authLoading || (loading && !data)) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!profile?.organizations?.length) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          {t('noOrg')}
        </div>
      </div>
    )
  }

  const handleDownloadCsv = () => {
    if (!data) return
    const rows = data.childCompletion
    const header = [t('child'), t('parent'), t('tasks'), t('percent')]
    const csvRows = rows.map((row) => [
      row.childName,
      row.parentName ?? '',
      `${row.completedTasks}/${row.totalTasks}`,
      `${row.percent}%`,
    ])
    const csvContent = [header, ...csvRows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nuroo-report-${days}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canDownloadPdf = Boolean(data && hasReportData(data))

  const handleDownloadPdf = async () => {
    if (!data || !canDownloadPdf) return

    let container: HTMLDivElement | null = null

    try {
      setExportingPdf(true)
      setError('')

      container = document.createElement('div')
      container.setAttribute('aria-hidden', 'true')
      container.style.position = 'fixed'
      container.style.left = '-10000px'
      container.style.top = '0'
      container.style.zIndex = '-1'
      container.style.pointerEvents = 'none'
      container.innerHTML = buildPdfMarkup(data, days, t)
      document.body.appendChild(container)

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      })

      const imageData = canvas.toDataURL('image/png')
      const imageHeight = (canvas.height * PDF_CONTENT_WIDTH_MM) / canvas.width
      const pageContentHeight = PDF_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2
      let remainingHeight = imageHeight

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      pdf.addImage(
        imageData,
        'PNG',
        PDF_MARGIN_MM,
        PDF_MARGIN_MM,
        PDF_CONTENT_WIDTH_MM,
        imageHeight,
        undefined,
        'FAST'
      )
      remainingHeight -= pageContentHeight

      while (remainingHeight > 0) {
        pdf.addPage()
        pdf.addImage(
          imageData,
          'PNG',
          PDF_MARGIN_MM,
          PDF_MARGIN_MM - (imageHeight - remainingHeight),
          PDF_CONTENT_WIDTH_MM,
          imageHeight,
          undefined,
          'FAST'
        )
        remainingHeight -= pageContentHeight
      }

      pdf.save(`${t('pdfFilePrefix')}-${formatReportDate()}.pdf`)
    } catch {
      setError(t('pdfExportError'))
    } finally {
      container?.remove()
      setExportingPdf(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary-600" />
          {t('title')}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">{t('period')}</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value={7}>7 {t('days')}</option>
            <option value={30}>30 {t('days')}</option>
          </select>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          {data && (
            <>
              <button
                onClick={handleDownloadCsv}
                data-print-hide
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('downloadCsv')}
              </button>
              <button
                onClick={handleDownloadPdf}
                data-print-hide
                disabled={!canDownloadPdf || exportingPdf}
                title={!canDownloadPdf ? t('pdfNoData') : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  !canDownloadPdf || exportingPdf
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportingPdf ? t('preparingPdf') : t('downloadPdf')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-8">
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" />
              {t('childCompletion')}
            </h2>
            {data.childCompletion.length === 0 ? (
              <p className="text-gray-500">{t('noChildren')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-4">{t('child')}</th>
                      <th className="py-2 pr-4">{t('parent')}</th>
                      <th className="py-2 pr-4 text-right">{t('tasks')}</th>
                      <th className="py-2 pr-4 text-right">{t('percent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.childCompletion.map((row) => (
                      <tr key={row.childId} className="border-b border-gray-100">
                        <td className="py-3 font-medium text-gray-900">{row.childName}</td>
                        <td className="py-3 text-gray-600">{row.parentName ?? '—'}</td>
                        <td className="py-3 text-right text-gray-600">
                          {row.completedTasks} / {row.totalTasks}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              row.percent >= 70
                                ? 'text-green-600 font-medium'
                                : row.percent >= 40
                                  ? 'text-amber-600'
                                  : 'text-red-600 font-medium'
                            }
                          >
                            {row.percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              {t('groupCompletion')}
            </h2>
            {data.groupCompletion.length === 0 ? (
              <div className="text-gray-500 space-y-1">
                <p>{t('noGroups')}</p>
                <p className="text-sm">{t('noGroupsHint')}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.groupCompletion.map((g) => (
                  <div
                    key={g.ownerId ? `${g.ownerId}_${g.groupId}` : g.groupId}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                  >
                    <div className="font-medium text-gray-900">{g.groupName}</div>
                    {g.specialistName && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t('specialist')}: {g.specialistName}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mt-1">
                      {t('childrenCount')}: {g.childCount}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {g.completedTasks} / {g.totalTasks} {t('tasks')}
                      </span>
                      <span
                        className={
                          g.percent >= 70
                            ? 'text-green-600 font-semibold'
                            : g.percent >= 40
                              ? 'text-amber-600'
                              : 'text-red-600 font-semibold'
                        }
                      >
                        {g.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              {t('topParents')}
            </h2>
            {data.topParents.length === 0 ? (
              <p className="text-gray-500">{t('noActivity')}</p>
            ) : (
              <ul className="space-y-3">
                {data.topParents.map((p, i) => (
                  <li
                    key={p.parentUserId}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-900">{p.parentName}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      {t('completed')}: {p.completedLast7} (7d) / {p.completedLast30} (30d)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserX className="w-5 h-5 text-amber-600" />
              {t('lowActivity')}
            </h2>
            {data.lowActivity.length === 0 ? (
              <p className="text-green-600">{t('noLowActivity')}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">{t('lowActivityDesc')}</p>
                <ul className="space-y-2">
                  {data.lowActivity.map((p) => (
                    <li
                      key={p.parentUserId}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <span className="font-medium text-gray-900">{p.parentName}</span>
                      <span className="text-sm text-amber-700">
                        {t('completed')}: 0 (7d) / {p.completedLast30} (30d)
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {data.contentActivity && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-600" />
                {t('contentActivity')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">
                    {data.contentActivity.totalCompleted}
                  </div>
                  <div className="text-sm text-gray-600">{t('totalCompleted')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {data.contentActivity.completedLast7Days}
                  </div>
                  <div className="text-sm text-gray-600">{t('last7Days')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {data.contentActivity.completedLast30Days}
                  </div>
                  <div className="text-sm text-gray-600">{t('last30Days')}</div>
                </div>
              </div>
              {data.contentActivity.byChild.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">{t('byChild')}</h3>
                  <div className="space-y-2">
                    {data.contentActivity.byChild.slice(0, 10).map((item) => (
                      <div
                        key={item.childId}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                      >
                        <span className="text-sm text-gray-700">{item.childId}</span>
                        <span className="text-sm font-medium text-primary-600">
                          {item.count} {t('tasks')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSpinner />}>
      <ReportsContent />
    </Suspense>
  )
}
