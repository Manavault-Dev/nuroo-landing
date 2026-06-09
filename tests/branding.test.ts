import { describe, it, expect } from 'vitest'
import {
  THEME_PRESETS,
  DEFAULT_PRESET_ID,
  resolvePreset,
  presetToCssVariables,
  resolveBrandingAccent,
  tokensToCssVariables,
} from '../lib/b2b/themePresets'
import { getContrastRatio } from '../lib/b2b/colorUtils'

describe('themePresets', () => {
  it('resolvePreset returns nuroo default when presetId is null', () => {
    const preset = resolvePreset(null)
    expect(preset.id).toBe(DEFAULT_PRESET_ID)
    expect(preset.tokens.primary).toBe('#14b8a6')
  })

  it('resolvePreset returns nuroo default when presetId is undefined', () => {
    const preset = resolvePreset(undefined)
    expect(preset.id).toBe('nuroo')
  })

  it('resolvePreset resolves each named preset with correct primary color', () => {
    expect(resolvePreset('ocean').tokens.primary).toBe('#3b82f6')
    expect(resolvePreset('forest').tokens.primary).toBe('#22c55e')
    expect(resolvePreset('sunset').tokens.primary).toBe('#f97316')
    expect(resolvePreset('violet').tokens.primary).toBe('#8b5cf6')
  })

  it('presetToCssVariables emits all primary scale + full semantic tokens', () => {
    const vars = presetToCssVariables(THEME_PRESETS.nuroo)
    // Primary scale
    expect(vars['--brand-primary-50']).toBe('#f0fdfa')
    expect(vars['--brand-primary-500']).toBe('#14b8a6')
    expect(vars['--brand-primary-900']).toBe('#134e4a')
    // Semantic tokens
    expect(vars['--brand-sidebar-bg']).toBe('#ffffff')
    expect(vars['--brand-topbar-bg']).toBe('#ffffff')
    expect(vars['--brand-app-bg']).toBe('#f8fafc')
    expect(vars['--brand-button-bg']).toBe('#0f766e')
    expect(vars['--brand-notification-bg']).toBe('#f0fdfa')
  })

  it('all presets define complete color scales and all semantic tokens without gaps', () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    const semanticKeys: (keyof typeof THEME_PRESETS.nuroo.tokens)[] = [
      'appBg',
      'pageBg',
      'surface',
      'cardBg',
      'cardBorder',
      'sidebarBg',
      'sidebarText',
      'sidebarMutedText',
      'sidebarActiveBg',
      'sidebarActiveText',
      'sidebarHoverBg',
      'topbarBg',
      'topbarBorder',
      'primary',
      'primaryHover',
      'primaryText',
      'buttonBg',
      'buttonText',
      'badgeBg',
      'badgeText',
      'inputBg',
      'inputBorder',
      'inputFocusBorder',
      'notificationBg',
      'notificationBorder',
      'gradientFrom',
      'gradientTo',
    ]
    for (const preset of Object.values(THEME_PRESETS)) {
      // Check numeric scale shades
      for (const shade of shades) {
        expect(preset.tokens[shade], `${preset.id}[${shade}]`).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
      // Check semantic keys (allow rgba for activeBg)
      for (const key of semanticKeys) {
        const val = preset.tokens[key] as string
        expect(val, `${preset.id}.${String(key)}`).toBeTruthy()
        expect(typeof val).toBe('string')
      }
    }
  })

  it('dark-sidebar presets have noticeably different sidebar vs topbar backgrounds', () => {
    for (const id of ['ocean', 'forest', 'sunset', 'violet'] as const) {
      const t = THEME_PRESETS[id].tokens
      expect(t.sidebarBg).not.toBe(t.topbarBg)
    }
  })

  it('all preset primary buttons keep white text readable', () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(preset.tokens.buttonText).toBe('#ffffff')
      expect(
        getContrastRatio(preset.tokens.buttonBg, preset.tokens.buttonText)
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('resolves runtime accent from current theme tokens instead of legacy primaryColor', () => {
    expect(resolveBrandingAccent({ presetId: 'ocean' })).toBe(THEME_PRESETS.ocean.tokens.buttonBg)
    expect(
      resolveBrandingAccent({
        presetId: 'ocean',
        generatedThemeTokens: tokensToCssVariables(THEME_PRESETS.forest.tokens),
      })
    ).toBe(THEME_PRESETS.forest.tokens.buttonBg)
  })
})
