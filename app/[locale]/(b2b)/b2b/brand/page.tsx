'use client'

import { FormEvent, type CSSProperties, useEffect, useRef, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/b2b/AuthContext'
import { useBranding, type OrgBranding } from '@/lib/b2b/brandingContext'
import { getCurrentUser } from '@/lib/b2b/authClient'
import { THEME_PRESETS, DEFAULT_PRESET_ID, resolvePreset } from '@/lib/b2b/themePresets'
import { type PresetId } from '@/lib/b2b/types'
import {
  Palette,
  Save,
  Loader2,
  Image as ImageIcon,
  Building2,
  Eye,
  CheckCircle2,
  RotateCcw,
  Check,
} from 'lucide-react'

const DEFAULT_IMAGE_POSITION = 50
const DEFAULT_IMAGE_SCALE = 1

function valueOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function imageCropStyle(
  x: number | null | undefined,
  y: number | null | undefined,
  scale: number | null | undefined
): CSSProperties {
  return {
    objectPosition: `${valueOrDefault(x, DEFAULT_IMAGE_POSITION)}% ${valueOrDefault(
      y,
      DEFAULT_IMAGE_POSITION
    )}%`,
    transform: `scale(${valueOrDefault(scale, DEFAULT_IMAGE_SCALE)})`,
  }
}

function CropControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
        <span>{label}</span>
        <span className="font-mono text-gray-400">
          {step < 1 ? value.toFixed(2) : Math.round(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary-600"
      />
    </label>
  )
}

export default function BrandSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading } = useAuth()
  const { branding, updateBranding } = useBranding()
  const t = useTranslations('b2b.pages.brand')

  const currentOrgId = searchParams.get('orgId') || profile?.organizations?.[0]?.orgId || undefined
  const currentOrg =
    profile?.organizations?.find((o) => o.orgId === currentOrgId) || profile?.organizations?.[0]
  const isAdmin = currentOrg?.role === 'admin'

  const [form, setForm] = useState<OrgBranding>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!isLoading && !getCurrentUser()) {
      router.push('/b2b/login')
    }
  }, [isLoading, router])

  useEffect(() => {
    if (!isLoading && profile && !isAdmin) {
      router.push(currentOrgId ? `/b2b?orgId=${currentOrgId}` : '/b2b')
    }
  }, [isLoading, profile, isAdmin, currentOrgId, router])

  useEffect(() => {
    if (!initialized.current && branding) {
      setForm(branding)
      initialized.current = true
    } else if (!initialized.current && !branding && currentOrg) {
      setForm({ name: currentOrg.orgName })
      initialized.current = true
    }
  }, [branding, currentOrg])

  const set =
    (key: keyof OrgBranding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const setPresetId = (presetId: PresetId) => {
    setForm((f) => ({ ...f, presetId }))
  }

  const setNumber = (key: keyof OrgBranding) => (value: number) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const resetCoverCrop = () => {
    setForm((f) => ({
      ...f,
      coverPositionX: DEFAULT_IMAGE_POSITION,
      coverPositionY: DEFAULT_IMAGE_POSITION,
      coverScale: DEFAULT_IMAGE_SCALE,
    }))
  }

  const resetLogoCrop = () => {
    setForm((f) => ({
      ...f,
      logoPositionX: DEFAULT_IMAGE_POSITION,
      logoPositionY: DEFAULT_IMAGE_POSITION,
      logoScale: DEFAULT_IMAGE_SCALE,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const selectedPresetId: PresetId = form.presetId ?? DEFAULT_PRESET_ID
      await updateBranding({
        name: form.name?.trim() || null,
        description: form.description?.trim() || null,
        logo: form.logo?.trim() || null,
        logoPositionX: form.logo?.trim()
          ? valueOrDefault(form.logoPositionX, DEFAULT_IMAGE_POSITION)
          : null,
        logoPositionY: form.logo?.trim()
          ? valueOrDefault(form.logoPositionY, DEFAULT_IMAGE_POSITION)
          : null,
        logoScale: form.logo?.trim() ? valueOrDefault(form.logoScale, DEFAULT_IMAGE_SCALE) : null,
        coverImage: form.coverImage?.trim() || null,
        coverPositionX: form.coverImage?.trim()
          ? valueOrDefault(form.coverPositionX, DEFAULT_IMAGE_POSITION)
          : null,
        coverPositionY: form.coverImage?.trim()
          ? valueOrDefault(form.coverPositionY, DEFAULT_IMAGE_POSITION)
          : null,
        coverScale: form.coverImage?.trim()
          ? valueOrDefault(form.coverScale, DEFAULT_IMAGE_SCALE)
          : null,
        presetId: selectedPresetId,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!isAdmin || !currentOrg) return null

  const previewName = form.name || currentOrg.orgName
  const activePreset = resolvePreset(form.presetId)
  const previewColor = activePreset.tokens[500]
  const previewCover = form.coverImage
  const coverCropStyle = imageCropStyle(form.coverPositionX, form.coverPositionY, form.coverScale)
  const logoCropStyle = imageCropStyle(form.logoPositionX, form.logoPositionY, form.logoScale)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <p className="text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewMode((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Eye className="w-4 h-4" />
          {previewMode ? t('hidePreview') : t('showPreview')}
        </button>
      </div>

      <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Identity */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary-600" />
              <h3 className="text-base font-semibold text-gray-900">{t('sectionIdentity')}</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('fieldName')}
              </label>
              <input
                type="text"
                value={form.name ?? ''}
                onChange={set('name')}
                maxLength={120}
                placeholder={currentOrg.orgName}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('fieldDescription')}
              </label>
              <textarea
                value={form.description ?? ''}
                onChange={set('description')}
                rows={2}
                maxLength={300}
                placeholder={t('descriptionPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>

          {/* Visual */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-primary-600" />
              <h3 className="text-base font-semibold text-gray-900">{t('sectionVisual')}</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <ImageIcon className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                {t('fieldLogo')}
              </label>
              <input
                type="url"
                value={form.logo ?? ''}
                onChange={set('logo')}
                placeholder={t('logoPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500">{t('logoHint')}</p>
              {form.logo && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {t('logoCrop')}
                    </p>
                    <button
                      type="button"
                      onClick={resetLogoCrop}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('resetCrop')}
                    </button>
                  </div>
                  <div className="mb-4 flex justify-center">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <img
                        src={form.logo}
                        alt=""
                        className="h-full w-full object-cover"
                        style={logoCropStyle}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CropControl
                      label={t('cropHorizontal')}
                      min={0}
                      max={100}
                      value={valueOrDefault(form.logoPositionX, DEFAULT_IMAGE_POSITION)}
                      onChange={setNumber('logoPositionX')}
                    />
                    <CropControl
                      label={t('cropVertical')}
                      min={0}
                      max={100}
                      value={valueOrDefault(form.logoPositionY, DEFAULT_IMAGE_POSITION)}
                      onChange={setNumber('logoPositionY')}
                    />
                    <CropControl
                      label={t('cropZoom')}
                      min={1}
                      max={2}
                      step={0.05}
                      value={valueOrDefault(form.logoScale, DEFAULT_IMAGE_SCALE)}
                      onChange={setNumber('logoScale')}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <ImageIcon className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                {t('fieldCover')}
              </label>
              <input
                type="url"
                value={form.coverImage ?? ''}
                onChange={set('coverImage')}
                placeholder={t('coverPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {form.coverImage && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {t('coverCrop')}
                    </p>
                    <button
                      type="button"
                      onClick={resetCoverCrop}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('resetCrop')}
                    </button>
                  </div>
                  <div className="mb-4 h-36 overflow-hidden rounded-2xl border border-gray-200 bg-slate-900 shadow-sm">
                    <img
                      src={form.coverImage}
                      alt=""
                      className="h-full w-full object-cover"
                      style={coverCropStyle}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CropControl
                      label={t('cropHorizontal')}
                      min={0}
                      max={100}
                      value={valueOrDefault(form.coverPositionX, DEFAULT_IMAGE_POSITION)}
                      onChange={setNumber('coverPositionX')}
                    />
                    <CropControl
                      label={t('cropVertical')}
                      min={0}
                      max={100}
                      value={valueOrDefault(form.coverPositionY, DEFAULT_IMAGE_POSITION)}
                      onChange={setNumber('coverPositionY')}
                    />
                    <CropControl
                      label={t('cropZoom')}
                      min={1}
                      max={2}
                      step={0.05}
                      value={valueOrDefault(form.coverScale, DEFAULT_IMAGE_SCALE)}
                      onChange={setNumber('coverScale')}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sectionPreset')}
              </label>
              <p className="mb-3 text-xs text-gray-500">{t('presetHint')}</p>
              <div className="grid grid-cols-5 gap-2">
                {Object.values(THEME_PRESETS).map((preset) => {
                  const isSelected = (form.presetId ?? DEFAULT_PRESET_ID) === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPresetId(preset.id as PresetId)}
                      title={t(`preset_${preset.id}` as Parameters<typeof t>[0])}
                      className={[
                        'relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all',
                        isSelected
                          ? 'border-gray-900 shadow-md'
                          : 'border-transparent hover:border-gray-300',
                      ].join(' ')}
                    >
                      <div
                        className="w-full h-8 rounded-lg"
                        style={{ background: preset.tokens[500] }}
                      />
                      {isSelected && (
                        <span
                          className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: preset.tokens[700] }}
                        >
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">
                        {t(`preset_${preset.id}` as Parameters<typeof t>[0])}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>{t('poweredByNote')}</strong> {t('poweredByDesc')}
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {t('saved')}
            </div>
          )}

          {saveError && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {saveError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>

        {/* Preview panel */}
        {previewMode && (
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {t('preview')}
              </p>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="relative overflow-hidden px-4 py-4 border-b border-gray-100"
                  style={{
                    backgroundColor: '#0f172a',
                    backgroundImage: previewCover
                      ? undefined
                      : `linear-gradient(135deg, #0f172a 0%, #1e293b 55%, ${previewColor} 100%)`,
                  }}
                >
                  {previewCover && (
                    <>
                      <img
                        src={previewCover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        style={coverCropStyle}
                      />
                      <div className="absolute inset-0 bg-slate-950/70" />
                    </>
                  )}
                  <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {t('dashboardHero')}
                  </p>
                  <div className="relative mt-3 flex items-center gap-2.5">
                    {form.logo ? (
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                        <img
                          src={form.logo}
                          alt="logo"
                          className="h-full w-full object-cover"
                          style={logoCropStyle}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: previewColor }}
                      >
                        {previewName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{previewName}</p>
                      <p className="text-xs text-white/70 truncate">
                        {form.description || t('workspacePreview')}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-100"
                  style={{ background: `${previewColor}10` }}
                >
                  {form.logo ? (
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={form.logo}
                        alt="logo"
                        className="h-full w-full object-cover"
                        style={logoCropStyle}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: previewColor }}
                    >
                      {previewName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{previewName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <img
                        src="/Logo.svg"
                        alt="Nuroo"
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                      <p className="text-xs text-gray-400 leading-none">{t('poweredBy')}</p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-1.5">
                  {[t('previewDashboard'), t('previewChildren'), t('previewReports')].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        {item}
                      </div>
                    )
                  )}
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium"
                    style={{ background: `${previewColor}15`, color: previewColor }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: previewColor }}
                    />
                    {t('previewBrandSettings')}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">{t('colorPreview')}</p>
                <div className="flex gap-1">
                  {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).map((shade) => (
                    <div
                      key={shade}
                      className="flex-1 h-6 rounded"
                      style={{ background: activePreset.tokens[shade] }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">{previewColor}</span>
                  <span className="text-xs text-gray-400">
                    {t(`preset_${activePreset.id}` as Parameters<typeof t>[0])}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
