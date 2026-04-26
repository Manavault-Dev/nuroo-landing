'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
  type CSSProperties,
} from 'react'
import { type OrgBranding } from './types'
import { apiClient } from './api'

export type { OrgBranding }

interface BrandingState {
  branding: OrgBranding | null
  updateBranding: (updates: OrgBranding) => Promise<void>
  isLoading: boolean
  error: string | null
}

const BrandingContext = createContext<BrandingState | null>(null)

function cacheKey(orgId: string) {
  return `nuroo:branding:${orgId}`
}

function readCache(orgId: string): OrgBranding | null {
  try {
    const raw = localStorage.getItem(cacheKey(orgId))
    return raw ? (JSON.parse(raw) as OrgBranding) : null
  } catch {
    return null
  }
}

function writeCache(orgId: string, branding: OrgBranding) {
  try {
    localStorage.setItem(cacheKey(orgId), JSON.stringify(branding))
  } catch {
    // quota exceeded
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(color?: string | null) {
  if (!color) return null
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixColors(from: string, to: string, ratio: number) {
  const start = hexToRgb(from)
  const end = hexToRgb(to)
  return rgbToHex(
    start.r + (end.r - start.r) * ratio,
    start.g + (end.g - start.g) * ratio,
    start.b + (end.b - start.b) * ratio
  )
}

function buildThemeVariables(branding: OrgBranding | null) {
  const primary = normalizeHexColor(branding?.primaryColor) || '#14b8a6'
  const primary50 = mixColors(primary, '#ffffff', 0.9)
  const primary100 = mixColors(primary, '#ffffff', 0.8)
  const primary200 = mixColors(primary, '#ffffff', 0.65)
  const primary300 = mixColors(primary, '#ffffff', 0.45)
  const primary400 = mixColors(primary, '#ffffff', 0.2)
  const primary600 = mixColors(primary, '#000000', 0.12)
  const primary700 = mixColors(primary, '#000000', 0.25)
  const primary800 = mixColors(primary, '#000000', 0.38)
  const primary900 = mixColors(primary, '#000000', 0.5)

  return {
    '--brand-primary-50': primary50,
    '--brand-primary-100': primary100,
    '--brand-primary-200': primary200,
    '--brand-primary-300': primary300,
    '--brand-primary-400': primary400,
    '--brand-primary-500': primary,
    '--brand-primary-600': primary600,
    '--brand-primary-700': primary700,
    '--brand-primary-800': primary800,
    '--brand-primary-900': primary900,
  } as CSSProperties
}

export function BrandingProvider({
  children,
  orgId,
}: {
  children: ReactNode
  orgId: string | null | undefined
}) {
  const [branding, setBranding] = useState<OrgBranding | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) {
      setBranding(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Optimistic: show cached value immediately
    const cached = readCache(orgId)
    if (cached) setBranding(cached)

    setIsLoading(true)
    setError(null)

    apiClient
      .getOrgBranding(orgId)
      .then(({ branding: remote }) => {
        if (remote) {
          // Strip nulls — treat null as "not set"
          const cleaned: OrgBranding = Object.fromEntries(
            Object.entries(remote).filter(([, v]) => v !== null && v !== undefined)
          )
          setBranding(cleaned)
          writeCache(orgId, cleaned)
        } else {
          // No branding configured yet — keep cached if available
          if (!cached) setBranding(null)
        }
      })
      .catch(() => {
        // API failed — use cache silently
        if (!cached) setError(null)
      })
      .finally(() => setIsLoading(false))
  }, [orgId])

  const updateBranding = useCallback(
    async (updates: OrgBranding) => {
      if (!orgId) return

      // Optimistic update
      const next = { ...(branding ?? {}), ...updates }
      setBranding(next)
      writeCache(orgId, next)

      const { branding: saved } = await apiClient.updateOrgBranding(orgId, updates)
      if (saved) {
        const cleaned: OrgBranding = Object.fromEntries(
          Object.entries(saved).filter(([, v]) => v !== null && v !== undefined)
        )
        setBranding(cleaned)
        writeCache(orgId, cleaned)
      }
    },
    [orgId, branding]
  )

  const value = useMemo<BrandingState>(
    () => ({ branding, updateBranding, isLoading, error }),
    [branding, updateBranding, isLoading, error]
  )

  const themeVariables = useMemo(() => buildThemeVariables(branding), [branding])

  return (
    <BrandingContext.Provider value={value}>
      <div className="b2b-theme" style={themeVariables}>
        {children}
      </div>
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
