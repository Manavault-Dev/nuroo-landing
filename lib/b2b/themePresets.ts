import { type PresetId } from './types'

export interface ThemeTokens {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
}

export interface ThemePreset {
  id: PresetId
  tokens: ThemeTokens
}

export const THEME_PRESETS: Record<PresetId, ThemePreset> = {
  nuroo: {
    id: 'nuroo',
    tokens: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
  },
  ocean: {
    id: 'ocean',
    tokens: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
  },
  forest: {
    id: 'forest',
    tokens: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
  },
  sunset: {
    id: 'sunset',
    tokens: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
  },
  violet: {
    id: 'violet',
    tokens: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
  },
}

export const DEFAULT_PRESET_ID: PresetId = 'nuroo'

export function resolvePreset(presetId?: PresetId | null): ThemePreset {
  if (presetId && presetId in THEME_PRESETS) {
    return THEME_PRESETS[presetId]
  }
  return THEME_PRESETS[DEFAULT_PRESET_ID]
}

export function presetToCssVariables(preset: ThemePreset): Record<string, string> {
  return {
    '--brand-primary-50': preset.tokens[50],
    '--brand-primary-100': preset.tokens[100],
    '--brand-primary-200': preset.tokens[200],
    '--brand-primary-300': preset.tokens[300],
    '--brand-primary-400': preset.tokens[400],
    '--brand-primary-500': preset.tokens[500],
    '--brand-primary-600': preset.tokens[600],
    '--brand-primary-700': preset.tokens[700],
    '--brand-primary-800': preset.tokens[800],
    '--brand-primary-900': preset.tokens[900],
  }
}
