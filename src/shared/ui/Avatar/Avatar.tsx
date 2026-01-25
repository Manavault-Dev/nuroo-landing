'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/src/shared/lib/utils/cn'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'circle' | 'square'
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

const iconSizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      size = 'md',
      variant = 'circle',
      ...props
    },
    ref
  ) => {
    const hasImage = !!src
    const initials = name ? getInitials(name) : null

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center overflow-hidden bg-gray-100',
          variant === 'circle' ? 'rounded-full' : 'rounded-lg',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {hasImage ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="h-full w-full object-cover"
          />
        ) : initials ? (
          <span className="font-medium text-gray-600">{initials}</span>
        ) : (
          <User className={cn('text-gray-400', iconSizeStyles[size])} />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
