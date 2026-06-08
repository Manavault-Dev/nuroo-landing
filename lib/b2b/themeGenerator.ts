/**
 * Generate a full professional theme from a single extracted brand color.
 * All math is pure (no browser deps) — safe to test in Node/Vitest.
 */

import {
  hexToHsl,
  hslToHex,
  getContrastRatio,
  pickReadableText,
  isColorSuitable,
} from './colorUtils'
import { type FullThemeTokens } from './themePresets'
import { type PresetId } from './types'

// Primary hex colors of each preset (used for closest-match fallback)
const PRESET_PRIMARIES: Record<PresetId, string> = {
  nuroo: '#14b8a6',
  ocean: '#3b82f6',
  forest: '#22c55e',
  sunset: '#f97316',
  violet: '#8b5cf6',
}

/** Hue distance 0–180 between two hex colors */
function hueDistance(hex1: string, hex2: string): number {
  const [h1] = hexToHsl(hex1)
  const [h2] = hexToHsl(hex2)
  const d = Math.abs(h1 - h2)
  return d > 180 ? 360 - d : d
}

/**
 * Return the preset whose primary color is closest in hue to the given hex.
 */
export function findClosestPreset(hex: string): PresetId {
  let best: PresetId = 'nuroo'
  let bestDist = Infinity
  for (const [id, primary] of Object.entries(PRESET_PRIMARIES) as [PresetId, string][]) {
    const d = hueDistance(hex, primary)
    if (d < bestDist) {
      bestDist = d
      best = id
    }
  }
  return best
}

/** Generate the 10-shade primary scale from a base hue + saturation */
function buildPrimaryScale(h: number, s: number): Record<number, string> {
  // lightness values for shades 50..900
  const lightnesses = [97, 93, 87, 78, 65, 50, 42, 35, 28, 20]
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  const scale: Record<number, string> = {}
  shades.forEach((shade, i) => {
    scale[shade] = hslToHex(h, s, lightnesses[i])
  })
  return scale
}

/** Adjust a generated color until buttons/text pass WCAG AA (4.5:1) */
function ensureContrast(bg: string, fg: string): string {
  if (getContrastRatio(bg, fg) >= 4.5) return fg
  // Try brightening or darkening fg
  const [fh, fs, fl] = hexToHsl(fg)
  for (let delta = 5; delta <= 60; delta += 5) {
    const lighter = hslToHex(fh, fs, Math.min(100, fl + delta))
    if (getContrastRatio(bg, lighter) >= 4.5) return lighter
    const darker = hslToHex(fh, fs, Math.max(0, fl - delta))
    if (getContrastRatio(bg, darker) >= 4.5) return darker
  }
  return pickReadableText(bg) // fallback
}

/**
 * Build a complete FullThemeTokens from a single extracted hex color.
 *
 * Strategy:
 *  - sidebar: dark version of the hue (s ~55%, l ~17%)
 *  - primary: the extracted color adjusted to l ~50%
 *  - app/page/card backgrounds: very light tint of the hue
 *  - all contrast requirements validated
 */
export function generateThemeFromColor(hex: string): FullThemeTokens {
  const [h, rawS] = hexToHsl(hex)
  // Clamp saturation to a range that looks professional
  const s = Math.max(40, Math.min(75, rawS))

  // --- Primary scale ---
  const scale = buildPrimaryScale(h, s)
  const primary = hslToHex(h, s, 50)
  const primaryHover = hslToHex(h, s, 43)
  const primaryText = pickReadableText(primary)

  // --- Sidebar: dark, saturated ---
  const sidebarBg = hslToHex(h, Math.max(45, s - 5), 17)
  const sidebarHoverBg = hslToHex(h, Math.max(45, s - 5), 23)
  const sidebarActiveBg = `hsla(${h}, ${s}%, 50%, 0.24)`
  const sidebarText = ensureContrast(sidebarBg, hslToHex(h, 30, 90))
  const sidebarMutedText = ensureContrast(sidebarBg, hslToHex(h, 30, 70))
  const sidebarActiveText = hslToHex(h, 30, 92)

  // --- Topbar: light tint ---
  const topbarBg = hslToHex(h, 40, 97)
  const topbarBorder = hslToHex(h, 35, 88)

  // --- App shell ---
  const appBg = hslToHex(h, 30, 97)
  const pageBg = hslToHex(h, 28, 94)
  const surface = '#ffffff'

  // --- Cards ---
  const cardBg = '#ffffff'
  const cardBorder = hslToHex(h, 30, 87)

  // --- Buttons ---
  const buttonBg = primary
  const buttonText = primaryText

  // --- Badges ---
  const badgeBg = hslToHex(h, 40, 92)
  const badgeText = ensureContrast(badgeBg, hslToHex(h, s, 28))

  // --- Inputs ---
  const inputBg = '#ffffff'
  const inputBorder = hslToHex(h, 25, 82)
  const inputFocusBorder = primary

  // --- Notifications ---
  const notificationBg = hslToHex(h, 35, 96)
  const notificationBorder = hslToHex(h, 35, 82)

  // --- Gradient ---
  const gradientFrom = primary
  const gradientTo = primaryHover

  return {
    appBg,
    pageBg,
    surface,
    cardBg,
    cardBorder,
    sidebarBg,
    sidebarText,
    sidebarMutedText,
    sidebarActiveBg,
    sidebarActiveText,
    sidebarHoverBg,
    topbarBg,
    topbarBorder,
    50: scale[50],
    100: scale[100],
    200: scale[200],
    300: scale[300],
    400: scale[400],
    500: scale[500],
    600: scale[600],
    700: scale[700],
    800: scale[800],
    900: scale[900],
    primary,
    primaryHover,
    primaryText,
    secondary: '#f59e0b',
    buttonBg,
    buttonText,
    badgeBg,
    badgeText,
    inputBg,
    inputBorder,
    inputFocusBorder,
    notificationBg,
    notificationBorder,
    gradientFrom,
    gradientTo,
  }
}

/**
 * Validate generated tokens and adjust anything that fails WCAG AA.
 * Returns a (possibly corrected) copy of the tokens.
 */
export function validateAndAdjust(tokens: FullThemeTokens): FullThemeTokens {
  return {
    ...tokens,
    buttonText: ensureContrast(tokens.buttonBg, tokens.buttonText),
    badgeText: ensureContrast(tokens.badgeBg, tokens.badgeText),
    sidebarText: ensureContrast(tokens.sidebarBg, tokens.sidebarText),
    sidebarMutedText: ensureContrast(tokens.sidebarBg, tokens.sidebarMutedText),
    sidebarActiveText: ensureContrast(tokens.sidebarBg, tokens.sidebarActiveText),
  }
}

/**
 * Full pipeline: generate → validate.
 * Returns null if the color is not suitable for theme generation.
 */
export function buildThemeFromColor(hex: string): FullThemeTokens | null {
  if (!isColorSuitable(hex)) return null
  return validateAndAdjust(generateThemeFromColor(hex))
}
