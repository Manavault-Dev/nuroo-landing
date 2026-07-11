// Tailwind class tokens for the course detail page.
// Centralises repeated long strings so the JSX stays readable.

export const courseDetailStyles = {
  // ── Layout ──────────────────────────────────────────────────────────────────
  page: 'flex h-full flex-col',
  splitPane: 'flex flex-1 overflow-hidden',
  sidebar: 'flex w-72 shrink-0 flex-col border-r border-gray-100 bg-white',
  mainPanel: 'min-w-0 flex-1 overflow-y-auto',

  // ── Typography ──────────────────────────────────────────────────────────────
  label: 'text-sm font-medium text-gray-700',
  labelBlock: 'block text-sm font-medium text-gray-700',
  helperText: 'mt-1 text-sm text-gray-500',
  sectionTitle: 'mt-1 text-2xl font-semibold text-gray-900',
  orgLabel: 'text-sm font-medium uppercase tracking-wide text-primary-600',

  // ── Form fields ─────────────────────────────────────────────────────────────
  input:
    'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100',
  inputDisabled:
    'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500',
  textarea:
    'mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100',

  // ── Buttons ──────────────────────────────────────────────────────────────────
  iconBtn: 'rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700',
  iconBtnDanger: 'rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600',
  ghostBtn:
    'rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700',
  uploadBtn:
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700',

  // ── Panels / cards ───────────────────────────────────────────────────────────
  fieldGroup: 'rounded-xl border border-gray-100 bg-gray-50/70 p-4',
  fieldGroupGrid: 'mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]',
} as const
