'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * Вычисляет массив видимых номеров страниц с многоточиями
 */
function getVisiblePages(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | string)[] = []
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  pages.push(1)

  if (start > 2) {
    pages.push('...')
  }

  for (let page = start; page <= end; page++) {
    pages.push(page)
  }

  if (end < total - 1) {
    pages.push('...')
  }

  pages.push(total)
  return pages
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null

  const visiblePages = getVisiblePages(currentPage, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 mt-6 py-4">
      {/* Кнопка Назад */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Номера страниц и многоточие */}
      {visiblePages.map((item, idx) => {
        if (item === '...') {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 py-2 text-sm text-gray-400 flex items-center justify-center"
            >
              …
            </span>
          )
        }

        const page = item as number
        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPage === page
                ? 'bg-primary-500 text-white shadow-sm'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        )
      })}

      {/* Кнопка Вперед */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
