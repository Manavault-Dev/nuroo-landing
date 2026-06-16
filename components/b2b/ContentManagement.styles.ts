import { clsx } from 'clsx'

type Difficulty = 'easy' | 'medium' | 'hard'

export const contentManagementStyles = {
  page: 'min-w-0 p-4 sm:p-6 lg:p-8',
  header: 'mb-6',
  title: 'mb-2 text-2xl font-bold leading-tight text-gray-900 sm:text-4xl',
  subtitle: 'max-w-3xl text-base leading-7 text-gray-600 sm:text-lg',
  tabsWrap: 'mb-6 border-b border-gray-200',
  tabsNav: '-mb-px flex gap-6 overflow-x-auto',
  tabButton: (isActive: boolean) =>
    clsx(
      'flex shrink-0 items-center space-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary-500 text-primary-600'
        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
    ),
  tabCount: (isActive: boolean) =>
    clsx(
      'rounded-full px-2 py-0.5 text-xs',
      isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
    ),
  primaryButton:
    'w-full rounded-lg bg-primary-600 px-6 py-3 text-white transition-colors hover:bg-primary-700 sm:w-auto',
  createButton:
    'flex w-full items-center justify-center space-x-2 rounded-lg bg-primary-600 px-4 py-2.5 text-white transition-colors hover:bg-primary-700 sm:w-auto',
  filterPanel: 'mb-4 rounded-xl border border-gray-100 bg-white p-3',
  filterGrid: 'grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]',
  searchInput:
    'w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500',
  clearButton:
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 lg:w-auto',
  formStack: 'space-y-4',
  formSection: 'space-y-3',
  label: 'block text-sm font-medium text-gray-700 mb-1',
  labelSpaced: 'block text-sm font-medium text-gray-700 mb-2',
  input:
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  subtleInput:
    'flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  amberTextarea:
    'w-full px-3 py-2 border border-amber-200 bg-amber-50/40 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400',
  greenTextarea:
    'w-full px-3 py-2 border border-green-200 bg-green-50/40 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent placeholder:text-gray-400',
  helperText: 'text-xs text-gray-500',
  emptyCard: 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center sm:p-12',
  splitPanel: 'flex min-h-[520px] min-w-0 flex-col gap-4 lg:flex-row',
  taskGrid:
    'grid min-w-0 flex-1 grid-cols-1 content-start gap-3 md:grid-cols-2 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1 2xl:grid-cols-3',
  taskCard: (isSelected: boolean) =>
    clsx(
      'flex min-h-[148px] cursor-pointer flex-col rounded-xl border bg-white p-4 transition-all',
      isSelected
        ? 'border-primary-500 shadow-sm ring-2 ring-primary-100'
        : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
    ),
  metadataBadge:
    'max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600',
  difficultyBadge: (difficulty: Difficulty) =>
    clsx(
      'rounded-full px-2 py-0.5 text-[11px]',
      difficulty === 'easy'
        ? 'bg-green-100 text-green-700'
        : difficulty === 'medium'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
    ),
  iconButton:
    'p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors',
  dangerIconButton:
    'p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors',
  groupOption: (checked: boolean) =>
    clsx(
      'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors border',
      checked ? 'bg-primary-50 border-primary-200' : 'hover:bg-gray-50 border-transparent'
    ),
  assignButton: (isSuccess: boolean) =>
    clsx(
      'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
      isSuccess
        ? 'bg-green-100 text-green-700'
        : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed'
    ),
  gridCards: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  gridCard:
    'bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col min-h-0',
  showMoreButton:
    'rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-200 hover:text-primary-700',
  modalBackdrop: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
  modalPanel: 'bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
  modalHeader:
    'sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between',
  modalFooter:
    'sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3',
} as const
