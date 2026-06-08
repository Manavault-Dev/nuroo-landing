import { describe, it, expect } from 'vitest'
import {
  THEME_PRESETS,
  DEFAULT_PRESET_ID,
  resolvePreset,
  presetToCssVariables,
} from '../lib/b2b/themePresets'

describe('themePresets', () => {
  it('resolvePreset returns nuroo default when presetId is null', () => {
    const preset = resolvePreset(null)
    expect(preset.id).toBe(DEFAULT_PRESET_ID)
    expect(preset.tokens[500]).toBe('#14b8a6')
  })

  it('resolvePreset returns nuroo default when presetId is undefined', () => {
    const preset = resolvePreset(undefined)
    expect(preset.id).toBe('nuroo')
  })

  it('resolvePreset resolves each named preset correctly', () => {
    expect(resolvePreset('ocean').tokens[500]).toBe('#3b82f6')
    expect(resolvePreset('forest').tokens[500]).toBe('#22c55e')
    expect(resolvePreset('sunset').tokens[500]).toBe('#f97316')
    expect(resolvePreset('violet').tokens[500]).toBe('#8b5cf6')
  })

  it('presetToCssVariables maps all 10 shades to CSS variable names', () => {
    const vars = presetToCssVariables(THEME_PRESETS.nuroo)
    expect(vars['--brand-primary-50']).toBe('#f0fdfa')
    expect(vars['--brand-primary-500']).toBe('#14b8a6')
    expect(vars['--brand-primary-900']).toBe('#134e4a')
    expect(Object.keys(vars)).toHaveLength(10)
  })

  it('all presets define complete color scales without gaps', () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    for (const preset of Object.values(THEME_PRESETS)) {
      for (const shade of shades) {
        expect(preset.tokens[shade]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })
})
