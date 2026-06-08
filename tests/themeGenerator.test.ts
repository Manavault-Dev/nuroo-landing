import { describe, it, expect } from 'vitest'
import {
  hexToHsl,
  hslToHex,
  getContrastRatio,
  pickReadableText,
  isColorSuitable,
} from '../lib/b2b/colorUtils'
import {
  generateThemeFromColor,
  validateAndAdjust,
  buildThemeFromColor,
  findClosestPreset,
} from '../lib/b2b/themeGenerator'
import { tokensToCssVariables, presetToCssVariables, THEME_PRESETS } from '../lib/b2b/themePresets'

// ── colorUtils ───────────────────────────────────────────────────────────────

describe('colorUtils', () => {
  it('hexToHsl round-trips known colors', () => {
    const [h, s, l] = hexToHsl('#14b8a6') // teal
    expect(h).toBeGreaterThan(168)
    expect(h).toBeLessThan(180)
    expect(s).toBeGreaterThan(50)
    expect(l).toBeGreaterThan(30)
  })

  it('hslToHex produces a valid 6-digit hex', () => {
    const hex = hslToHex(210, 60, 50)
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('hslToHex clamps saturation and lightness to 0-100', () => {
    const a = hslToHex(0, -10, 50)
    const b = hslToHex(0, 0, 50)
    expect(a).toBe(b)
  })

  it('getContrastRatio is symmetric', () => {
    const r1 = getContrastRatio('#ffffff', '#000000')
    const r2 = getContrastRatio('#000000', '#ffffff')
    expect(r1).toBeCloseTo(r2, 5)
  })

  it('getContrastRatio returns 21 for black/white', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('pickReadableText chooses white for dark background', () => {
    expect(pickReadableText('#1e3a8a')).toBe('#ffffff')
  })

  it('pickReadableText chooses dark for light background', () => {
    expect(pickReadableText('#f0fdfa')).toBe('#111827')
  })

  it('isColorSuitable rejects near-white', () => {
    expect(isColorSuitable('#fafafa')).toBe(false)
  })

  it('isColorSuitable rejects near-black', () => {
    expect(isColorSuitable('#050505')).toBe(false)
  })

  it('isColorSuitable rejects desaturated gray', () => {
    expect(isColorSuitable('#808080')).toBe(false)
  })

  it('isColorSuitable accepts vibrant mid-range colors', () => {
    expect(isColorSuitable('#3b82f6')).toBe(true) // blue
    expect(isColorSuitable('#22c55e')).toBe(true) // green
    expect(isColorSuitable('#f97316')).toBe(true) // orange
  })
})

// ── themeGenerator ───────────────────────────────────────────────────────────

describe('generateThemeFromColor', () => {
  const teal = '#14b8a6'
  const blue = '#3b82f6'
  const orange = '#f97316'

  it('returns an object with all FullThemeTokens fields', () => {
    const tokens = generateThemeFromColor(teal)
    const required = [
      'appBg', 'pageBg', 'surface', 'cardBg', 'cardBorder',
      'sidebarBg', 'sidebarText', 'sidebarMutedText',
      'sidebarActiveBg', 'sidebarActiveText', 'sidebarHoverBg',
      'topbarBg', 'topbarBorder',
      'primary', 'primaryHover', 'primaryText',
      'buttonBg', 'buttonText',
      'badgeBg', 'badgeText',
      'inputBg', 'inputBorder', 'inputFocusBorder',
      'notificationBg', 'notificationBorder',
      'gradientFrom', 'gradientTo',
    ] as const
    for (const key of required) {
      expect(tokens[key], key).toBeTruthy()
    }
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    for (const shade of shades) {
      expect(tokens[shade], `shade ${shade}`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('sidebar background is significantly darker than the primary', () => {
    const tokens = generateThemeFromColor(blue)
    const [, , sidebarL] = hexToHsl(tokens.sidebarBg)
    const [, , primaryL] = hexToHsl(tokens.primary)
    expect(sidebarL).toBeLessThan(primaryL - 10)
  })

  it('produces different themes for different hues', () => {
    const t1 = generateThemeFromColor(blue)
    const t2 = generateThemeFromColor(orange)
    expect(t1.primary).not.toBe(t2.primary)
    expect(t1.sidebarBg).not.toBe(t2.sidebarBg)
  })

  it('primary text has sufficient contrast with button background', () => {
    for (const color of [teal, blue, orange, '#8b5cf6', '#22c55e']) {
      const tokens = validateAndAdjust(generateThemeFromColor(color))
      const ratio = getContrastRatio(tokens.buttonBg, tokens.buttonText)
      expect(ratio, `contrast for ${color}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('sidebar text has sufficient contrast with sidebar background', () => {
    for (const color of [teal, blue, orange]) {
      const tokens = validateAndAdjust(generateThemeFromColor(color))
      const ratio = getContrastRatio(tokens.sidebarBg, tokens.sidebarText)
      expect(ratio, `sidebar contrast for ${color}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('badge text has sufficient contrast with badge background', () => {
    for (const color of [teal, blue, orange]) {
      const tokens = validateAndAdjust(generateThemeFromColor(color))
      const ratio = getContrastRatio(tokens.badgeBg, tokens.badgeText)
      expect(ratio, `badge contrast for ${color}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('buildThemeFromColor', () => {
  it('returns null for unsuitable colors', () => {
    expect(buildThemeFromColor('#ffffff')).toBeNull()
    expect(buildThemeFromColor('#000000')).toBeNull()
    expect(buildThemeFromColor('#aaaaaa')).toBeNull()
  })

  it('returns FullThemeTokens for suitable colors', () => {
    const tokens = buildThemeFromColor('#3b82f6')
    expect(tokens).not.toBeNull()
    expect(tokens!.primary).toBeTruthy()
  })
})

// ── findClosestPreset ─────────────────────────────────────────────────────────

describe('findClosestPreset', () => {
  it('maps teal to nuroo', () => {
    expect(findClosestPreset('#14b8a6')).toBe('nuroo')
  })

  it('maps blue to ocean', () => {
    expect(findClosestPreset('#3b82f6')).toBe('ocean')
  })

  it('maps green to forest', () => {
    expect(findClosestPreset('#22c55e')).toBe('forest')
  })

  it('maps orange to sunset', () => {
    expect(findClosestPreset('#f97316')).toBe('sunset')
  })

  it('maps purple to violet', () => {
    expect(findClosestPreset('#8b5cf6')).toBe('violet')
  })
})

// ── tokensToCssVariables ──────────────────────────────────────────────────────

describe('tokensToCssVariables', () => {
  it('emits the same vars as presetToCssVariables for nuroo preset', () => {
    const fromPreset = presetToCssVariables(THEME_PRESETS.nuroo)
    const fromTokens = tokensToCssVariables(THEME_PRESETS.nuroo.tokens)
    expect(fromTokens).toEqual(fromPreset)
  })

  it('accepts generated tokens and emits all expected vars', () => {
    const tokens = generateThemeFromColor('#3b82f6')!
    const vars = tokensToCssVariables(tokens)
    expect(vars['--brand-sidebar-bg']).toBeTruthy()
    expect(vars['--brand-button-bg']).toBeTruthy()
    expect(vars['--brand-primary-500']).toBeTruthy()
    // 10 scale + 24 semantic = 34
    expect(Object.keys(vars).length).toBe(34)
  })
})
