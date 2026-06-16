import { clsx } from 'clsx'

export const selectStyles = {
  root: (className?: string) => clsx('relative min-w-0', className),
  button: (className?: string) =>
    clsx(
      'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-sm transition-colors',
      'hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
      className
    ),
  placeholder: 'truncate text-gray-400',
  value: 'truncate',
  chevron: (isOpen: boolean) =>
    clsx('h-4 w-4 flex-shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180'),
  menu: 'absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl',
  list: 'max-h-72 overflow-y-auto p-1',
  option: (isSelected: boolean) =>
    clsx(
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
      isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
    ),
  check: (isSelected: boolean) =>
    clsx('h-4 w-4 flex-shrink-0', isSelected ? 'text-primary-600' : 'text-transparent'),
  optionLabel: 'min-w-0 flex-1 truncate',
} as const
