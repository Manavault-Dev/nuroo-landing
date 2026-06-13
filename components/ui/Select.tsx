'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className = '',
  buttonClassName = '',
  disabled = false,
}: SelectProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-sm transition-colors hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${buttonClassName}`}
      >
        <span className={`truncate ${selectedOption ? '' : 'text-gray-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div id={`${id}-listbox`} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                    buttonRef.current?.focus()
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Check
                    className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-primary-600' : 'text-transparent'}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
