'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { selectStyles as s } from './Select.styles'
import type { SelectProps } from './Select.types'
export type { SelectOption, SelectProps } from './Select.types'

export function Select({
  value,
  options,
  onChange,
  placeholder = '',
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
    <div ref={rootRef} className={s.root(className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        onClick={() => setIsOpen((open) => !open)}
        className={s.button(buttonClassName)}
      >
        <span className={selectedOption ? s.value : s.placeholder}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={s.chevron(isOpen)} />
      </button>

      {isOpen && (
        <div className={s.menu}>
          <div id={`${id}-listbox`} role="listbox" className={s.list}>
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
                  className={s.option(isSelected)}
                >
                  <Check className={s.check(isSelected)} />
                  <span className={s.optionLabel}>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
