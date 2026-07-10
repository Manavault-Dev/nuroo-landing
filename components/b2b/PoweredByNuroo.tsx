import Image from 'next/image'
import { clsx } from 'clsx'

type PoweredByNurooProps = {
  label: string
  organizationName?: string | null
  className?: string
  size?: 'sm' | 'xs'
}

export function PoweredByNuroo({
  label,
  organizationName,
  className,
  size = 'sm',
}: PoweredByNurooProps) {
  const compact = size === 'xs'

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-full border border-teal-100/80 bg-white/90 text-gray-500 shadow-sm shadow-teal-900/5 backdrop-blur',
        compact ? 'gap-2 px-2.5 py-1.5 text-xs' : 'gap-2.5 px-3 py-2 text-sm',
        className
      )}
    >
      <span
        className={clsx(
          'grid shrink-0 place-items-center overflow-hidden rounded-full bg-teal-50 ring-1 ring-teal-100',
          compact ? 'h-7 w-7' : 'h-8 w-8'
        )}
      >
        <Image
          src="/mascot-1.svg"
          alt="Nuroo"
          width={compact ? 28 : 32}
          height={compact ? 28 : 32}
          className="h-full w-full object-cover"
          unoptimized
        />
      </span>
      <span className="min-w-0 truncate leading-none">
        {organizationName && (
          <>
            <span className="text-gray-400">{organizationName}</span>
            <span className="mx-1 text-gray-300">·</span>
          </>
        )}
        <span className="text-gray-400">{label}</span>{' '}
        <span className="font-semibold text-teal-700">Nuroo</span>
      </span>
    </div>
  )
}
