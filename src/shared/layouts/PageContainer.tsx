'use client'

import { ReactNode } from 'react'
import { cn } from '@/src/shared/lib/utils/cn'

interface PageContainerProps {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function PageContainer({
  children,
  title,
  description,
  action,
  className,
}: PageContainerProps) {
  return (
    <div className={cn('p-6', className)}>
      {(title || description || action) && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
