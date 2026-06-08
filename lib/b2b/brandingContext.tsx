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
import { resolvePreset, presetToCssVariables } from './themePresets'
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

function buildThemeVariables(branding: OrgBranding | null): CSSProperties {
  // Generated theme (from logo color extraction) takes priority over preset
  if (branding?.generatedThemeTokens && Object.keys(branding.generatedThemeTokens).length > 0) {
    return branding.generatedThemeTokens as CSSProperties
  }
  const preset = resolvePreset(branding?.presetId)
  return presetToCssVariables(preset) as CSSProperties
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
