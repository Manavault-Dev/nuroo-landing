/**
 * Pure color math utilities (no browser dependencies).
 * Used by themeGenerator.ts and colorExtraction.ts.
 */

export function hexToRgbTriplet(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgbTriplet(hex).map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** hue 0-360, saturation 0-100, lightness 0-100 */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) {
    r = c
    g = x
    b = 0
  } else if (h < 120) {
    r = x
    g = c
    b = 0
  } else if (h < 180) {
    r = 0
    g = c
    b = x
  } else if (h < 240) {
    r = 0
    g = x
    b = c
  } else if (h < 300) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }
  return `#${[r, g, b]
    .map((n) =>
      Math.round((n + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/** WCAG 2.1 relative luminance (0–1) */
export function getRelativeLuminance(hex: string): number {
  const channels = hexToRgbTriplet(hex).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG contrast ratio between two hex colors (1–21) */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1)
  const l2 = getRelativeLuminance(hex2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Pick white or black depending on which has better contrast against bg */
export function pickReadableText(bg: string): '#ffffff' | '#111827' {
  return getContrastRatio('#ffffff', bg) >= 4.5 ? '#ffffff' : '#111827'
}

/** True if color is vibrant enough to build a theme from */
export function isColorSuitable(hex: string): boolean {
  try {
    const [, s, l] = hexToHsl(hex)
    return s >= 18 && l >= 10 && l <= 90
  } catch {
    return false
  }
}
