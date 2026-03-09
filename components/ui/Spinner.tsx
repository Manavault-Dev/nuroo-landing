import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-10 h-10' }

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin text-primary-600 ${sizeMap[size]} ${className}`} />
}

/** Full-page centered loading state for B2B pages */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] p-8">
      <Spinner size="lg" />
    </div>
  )
}
