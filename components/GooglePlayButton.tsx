'use client'

interface GooglePlayButtonProps {
  href?: string
  className?: string
  disabled?: boolean
}

const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=nuroo.app&pcampaignid=web_share'

export function GooglePlayButton({
  href = GOOGLE_PLAY_URL,
  className = '',
  disabled = false,
}: GooglePlayButtonProps) {
  return (
    <a
      href={disabled ? undefined : href}
      target={disabled ? undefined : '_blank'}
      rel={disabled ? undefined : 'noopener noreferrer'}
      className={`inline-flex items-center gap-2 sm:gap-3.5 px-3 py-2 sm:px-5 sm:py-3.5 bg-white hover:bg-gray-50 text-gray-900 rounded-[12px] sm:rounded-[14px] border border-gray-300 transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} ${className}`}
      aria-label="Get it on Google Play"
      onClick={disabled ? (e) => e.preventDefault() : undefined}
    >
      <svg
        className="w-8 h-9 sm:w-12 sm:h-13 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85c-.5-.25-.84-.76-.84-1.35z"
          fill="#4285F4"
        />
        <path d="M16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27z" fill="#34A853" />
        <path
          d="M20.16 10.81c.34.27.59.69.59 1.19 0 .5-.22.9-.57 1.18L17.89 14.5l-2.5-2.5 2.5-2.5 2.27 1.31z"
          fill="#FBBC04"
        />
        <path d="M16.81 8.88L6.05 2.66l8.49 8.49 2.27-2.27z" fill="#EA4335" />
      </svg>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] sm:text-md leading-[1.1] tracking-tight">GET IT ON</span>
        <span className="text-lg sm:text-2xl leading-[1.1] font-semibold tracking-tight">
          Google Play
        </span>
      </div>
      {disabled && (
        <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-600 text-[10px] sm:text-xs font-medium rounded">
          Soon
        </span>
      )}
    </a>
  )
}
