import { type PresetId } from './types'

export interface FullThemeTokens {
  // App shell
  appBg: string
  pageBg: string
  surface: string
  // Cards
  cardBg: string
  cardBorder: string
  // Sidebar
  sidebarBg: string
  sidebarText: string
  sidebarMutedText: string
  sidebarActiveBg: string
  sidebarActiveText: string
  sidebarHoverBg: string
  // Topbar
  topbarBg: string
  topbarBorder: string
  // Primary action color (10-shade scale)
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
  // Semantic tokens derived from primary
  primary: string
  primaryHover: string
  primaryText: string
  secondary: string
  // Buttons
  buttonBg: string
  buttonText: string
  // Badges
  badgeBg: string
  badgeText: string
  // Inputs
  inputBg: string
  inputBorder: string
  inputFocusBorder: string
  // Notifications
  notificationBg: string
  notificationBorder: string
  // Gradient
  gradientFrom: string
  gradientTo: string
}

export interface ThemePreset {
  id: PresetId
  tokens: FullThemeTokens
}

/** Kept for backward compat with tests that reference `.tokens[500]` etc. */
export type ThemeTokens = FullThemeTokens

export const THEME_PRESETS: Record<PresetId, ThemePreset> = {
  nuroo: {
    id: 'nuroo',
    tokens: {
      // App shell — clean slate/white
      appBg: '#f8fafc',
      pageBg: '#f1f5f9',
      surface: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      // Sidebar — light white sidebar (keeps the current look)
      sidebarBg: '#ffffff',
      sidebarText: '#111827',
      sidebarMutedText: '#6b7280',
      sidebarActiveBg: '#f0fdfa',
      sidebarActiveText: '#0f766e',
      sidebarHoverBg: '#f9fafb',
      // Topbar
      topbarBg: '#ffffff',
      topbarBorder: '#e5e7eb',
      // Teal scale
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
      primary: '#14b8a6',
      primaryHover: '#0d9488',
      primaryText: '#ffffff',
      secondary: '#f28232',
      buttonBg: '#14b8a6',
      buttonText: '#ffffff',
      badgeBg: '#ccfbf1',
      badgeText: '#0f766e',
      inputBg: '#ffffff',
      inputBorder: '#d1d5db',
      inputFocusBorder: '#14b8a6',
      notificationBg: '#f0fdfa',
      notificationBorder: '#99f6e4',
      gradientFrom: '#14b8a6',
      gradientTo: '#0d9488',
    },
  },

  ocean: {
    id: 'ocean',
    tokens: {
      // App shell — light icy blue
      appBg: '#f0f7ff',
      pageBg: '#e8f1ff',
      surface: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#bfdbfe',
      // Sidebar — deep navy
      sidebarBg: '#1e3a8a',
      sidebarText: '#e0eaff',
      sidebarMutedText: '#93c5fd',
      sidebarActiveBg: 'rgba(59,130,246,0.22)',
      sidebarActiveText: '#bfdbfe',
      sidebarHoverBg: '#1d4ed8',
      // Topbar
      topbarBg: '#eff6ff',
      topbarBorder: '#bfdbfe',
      // Blue scale
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
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryText: '#ffffff',
      secondary: '#f59e0b',
      buttonBg: '#3b82f6',
      buttonText: '#ffffff',
      badgeBg: '#dbeafe',
      badgeText: '#1e40af',
      inputBg: '#ffffff',
      inputBorder: '#bfdbfe',
      inputFocusBorder: '#3b82f6',
      notificationBg: '#eff6ff',
      notificationBorder: '#93c5fd',
      gradientFrom: '#3b82f6',
      gradientTo: '#1d4ed8',
    },
  },

  forest: {
    id: 'forest',
    tokens: {
      // App shell — light mint
      appBg: '#f0fdf4',
      pageBg: '#dcfce7',
      surface: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#bbf7d0',
      // Sidebar — deep forest green
      sidebarBg: '#14532d',
      sidebarText: '#d1fae5',
      sidebarMutedText: '#6ee7b7',
      sidebarActiveBg: 'rgba(34,197,94,0.22)',
      sidebarActiveText: '#bbf7d0',
      sidebarHoverBg: '#166534',
      // Topbar
      topbarBg: '#f0fdf4',
      topbarBorder: '#bbf7d0',
      // Green scale
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
      primary: '#22c55e',
      primaryHover: '#16a34a',
      primaryText: '#ffffff',
      secondary: '#f59e0b',
      buttonBg: '#22c55e',
      buttonText: '#ffffff',
      badgeBg: '#dcfce7',
      badgeText: '#166534',
      inputBg: '#ffffff',
      inputBorder: '#bbf7d0',
      inputFocusBorder: '#22c55e',
      notificationBg: '#f0fdf4',
      notificationBorder: '#86efac',
      gradientFrom: '#22c55e',
      gradientTo: '#16a34a',
    },
  },

  sunset: {
    id: 'sunset',
    tokens: {
      // App shell — warm amber/cream
      appBg: '#fff7ed',
      pageBg: '#ffedd5',
      surface: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#fed7aa',
      // Sidebar — deep burnt sienna
      sidebarBg: '#7c2d12',
      sidebarText: '#fef3c7',
      sidebarMutedText: '#fdba74',
      sidebarActiveBg: 'rgba(249,115,22,0.25)',
      sidebarActiveText: '#fed7aa',
      sidebarHoverBg: '#9a3412',
      // Topbar
      topbarBg: '#fff7ed',
      topbarBorder: '#fed7aa',
      // Orange scale
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
      primary: '#f97316',
      primaryHover: '#ea580c',
      primaryText: '#ffffff',
      secondary: '#14b8a6',
      buttonBg: '#f97316',
      buttonText: '#ffffff',
      badgeBg: '#ffedd5',
      badgeText: '#c2410c',
      inputBg: '#ffffff',
      inputBorder: '#fed7aa',
      inputFocusBorder: '#f97316',
      notificationBg: '#fff7ed',
      notificationBorder: '#fdba74',
      gradientFrom: '#f97316',
      gradientTo: '#ea580c',
    },
  },

  violet: {
    id: 'violet',
    tokens: {
      // App shell — soft lavender
      appBg: '#f5f3ff',
      pageBg: '#ede9fe',
      surface: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#ddd6fe',
      // Sidebar — deep indigo/violet
      sidebarBg: '#1e1b4b',
      sidebarText: '#ede9fe',
      sidebarMutedText: '#a5b4fc',
      sidebarActiveBg: 'rgba(139,92,246,0.25)',
      sidebarActiveText: '#c4b5fd',
      sidebarHoverBg: '#312e81',
      // Topbar
      topbarBg: '#f5f3ff',
      topbarBorder: '#ddd6fe',
      // Violet scale
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
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      primaryText: '#ffffff',
      secondary: '#f59e0b',
      buttonBg: '#8b5cf6',
      buttonText: '#ffffff',
      badgeBg: '#ede9fe',
      badgeText: '#6d28d9',
      inputBg: '#ffffff',
      inputBorder: '#ddd6fe',
      inputFocusBorder: '#8b5cf6',
      notificationBg: '#f5f3ff',
      notificationBorder: '#c4b5fd',
      gradientFrom: '#8b5cf6',
      gradientTo: '#6d28d9',
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
  const t = preset.tokens
  return {
    // Primary scale
    '--brand-primary-50': t[50],
    '--brand-primary-100': t[100],
    '--brand-primary-200': t[200],
    '--brand-primary-300': t[300],
    '--brand-primary-400': t[400],
    '--brand-primary-500': t[500],
    '--brand-primary-600': t[600],
    '--brand-primary-700': t[700],
    '--brand-primary-800': t[800],
    '--brand-primary-900': t[900],
    // App shell
    '--brand-app-bg': t.appBg,
    '--brand-page-bg': t.pageBg,
    '--brand-surface': t.surface,
    // Cards
    '--brand-card-bg': t.cardBg,
    '--brand-card-border': t.cardBorder,
    // Sidebar
    '--brand-sidebar-bg': t.sidebarBg,
    '--brand-sidebar-text': t.sidebarText,
    '--brand-sidebar-muted': t.sidebarMutedText,
    '--brand-sidebar-active-bg': t.sidebarActiveBg,
    '--brand-sidebar-active-text': t.sidebarActiveText,
    '--brand-sidebar-hover-bg': t.sidebarHoverBg,
    // Topbar
    '--brand-topbar-bg': t.topbarBg,
    '--brand-topbar-border': t.topbarBorder,
    // Actions
    '--brand-button-bg': t.buttonBg,
    '--brand-button-text': t.buttonText,
    '--brand-badge-bg': t.badgeBg,
    '--brand-badge-text': t.badgeText,
    // Inputs
    '--brand-input-bg': t.inputBg,
    '--brand-input-border': t.inputBorder,
    '--brand-input-focus-border': t.inputFocusBorder,
    // Notifications
    '--brand-notification-bg': t.notificationBg,
    '--brand-notification-border': t.notificationBorder,
    // Gradient
    '--brand-gradient-from': t.gradientFrom,
    '--brand-gradient-to': t.gradientTo,
  }
}
