'use client'

interface AppStoreButtonProps {
  href?: string
  className?: string
}

export function AppStoreButton({
  href = 'https://apps.apple.com/us/app/nuroo-ai/id6753772410',
  className = '',
}: AppStoreButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 sm:gap-3.5 px-3 py-2 sm:px-5 sm:py-3.5 bg-black hover:bg-gray-900 text-white rounded-[12px] sm:rounded-[14px] border border-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 ${className}`}
      aria-label="Download on the App Store"
    >
      <svg
        className="w-8 h-9 sm:w-12 sm:h-13 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zm-5.02-13.03c.15-2.23 1.66-4.07 3.74-4.25-.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] sm:text-md leading-[1.1] tracking-tight">Download on the</span>
        <span className="text-lg sm:text-2xl leading-[1.1] font-semibold tracking-tight">
          App Store
        </span>
      </div>
    </a>
  )
}
