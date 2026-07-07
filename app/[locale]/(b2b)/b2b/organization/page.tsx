'use client'

import { ChangeEvent, FormEvent, type CSSProperties, useEffect, useRef, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { useAuth } from '@/lib/b2b/AuthContext'
import { apiClient } from '@/lib/b2b/api'
import { isOrgAdminRole } from '@/lib/b2b/roleUtils'
import { Select } from '@/components/ui/Select'
import {
  Building2,
  Users,
  UserCog,
  Key,
  Save,
  Loader2,
  Globe,
  Eye,
  EyeOff,
  Phone,
  MessageCircle,
  MapPin,
  Image as ImageIcon,
  AlignLeft,
  Upload,
  X,
  RotateCcw,
} from 'lucide-react'
import { COUNTRIES, ORG_CATEGORIES } from '@/lib/b2b/countries'

const DEFAULT_IMAGE_POSITION = 50
const DEFAULT_IMAGE_SCALE = 1
const IMAGE_SOURCE_PATTERN = /^(https?:\/\/.+|data:image\/.+)$/i

function valueOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function imageCropStyle(
  x: number | null | undefined,
  y: number | null | undefined,
  scale: number | null | undefined
): CSSProperties {
  const cropX = valueOrDefault(x, DEFAULT_IMAGE_POSITION)
  const cropY = valueOrDefault(y, DEFAULT_IMAGE_POSITION)
  const cropScale = valueOrDefault(scale, DEFAULT_IMAGE_SCALE)

  return {
    height: `${cropScale * 100}%`,
    left: `${cropX}%`,
    maxWidth: 'none',
    objectPosition: 'center',
    position: 'absolute',
    top: `${cropY}%`,
    transform: `translate(-${cropX}%, -${cropY}%)`,
    width: `${cropScale * 100}%`,
  }
}

function isValidImageSource(value: string) {
  return IMAGE_SOURCE_PATTERN.test(value.trim())
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

export default function OrganizationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading, currentOrgId: authOrgId, updateProfile } = useAuth()
  const t = useTranslations('b2b.pages.organization')
  const locale = useLocale()

  // Basic info
  const [orgName, setOrgName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  // Marketplace profile
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [logoPositionX, setLogoPositionX] = useState<number | null>(null)
  const [logoPositionY, setLogoPositionY] = useState<number | null>(null)
  const [logoScale, setLogoScale] = useState<number | null>(null)
  const [coverPositionX, setCoverPositionX] = useState<number | null>(null)
  const [coverPositionY, setCoverPositionY] = useState<number | null>(null)
  const [coverScale, setCoverScale] = useState<number | null>(null)
  const [isPublicMarketplaceEnabled, setIsPublicMarketplaceEnabled] = useState(false)

  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'cover' | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set())
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [demoSeeding, setDemoSeeding] = useState(false)
  const [demoClearing, setDemoClearing] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const currentOrg =
    profile?.organizations?.find((org) => org.orgId === (searchParams.get('orgId') || authOrgId)) ||
    profile?.organizations?.[0]
  const currentOrgId = currentOrg?.orgId
  const isAdmin = isOrgAdminRole(currentOrg?.role)

  useEffect(() => {
    if (!isLoading && !getCurrentUser()) router.push('/b2b/login')
  }, [isLoading, router])

  useEffect(() => {
    if (!isLoading && profile) {
      if (!profile.organizations?.length) {
        router.push('/b2b/onboarding')
        return
      }
      if (!isAdmin) {
        router.push(
          profile.organizations[0] ? `/b2b?orgId=${profile.organizations[0].orgId}` : '/b2b'
        )
      }
    }
  }, [isLoading, profile, isAdmin, router])

  useEffect(() => {
    if (!currentOrg) return
    const o = currentOrg as any
    setOrgName(currentOrg.orgName)
    setCountry(o.country || '')
    setCity(o.city || '')
    setCategories(o.categories || [])
    setDescription(o.description || '')
    setAddress(o.address || '')
    setContactPhone(o.contactPhone || '')
    setWhatsappNumber(o.whatsappNumber || '')
    setWebsiteUrl(o.websiteUrl || '')
    setLogoUrl(o.logoUrl || '')
    setCoverImageUrl(o.coverImageUrl || '')
    setLogoPositionX(o.logoPositionX ?? null)
    setLogoPositionY(o.logoPositionY ?? null)
    setLogoScale(o.logoScale ?? null)
    setCoverPositionX(o.coverPositionX ?? null)
    setCoverPositionY(o.coverPositionY ?? null)
    setCoverScale(o.coverScale ?? null)
    setIsPublicMarketplaceEnabled(o.isPublicMarketplaceEnabled ?? false)
  }, [currentOrg])

  const toggleCategory = (cat: string) =>
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentOrgId || !currentOrg) return

    // Validate URL if provided
    if (websiteUrl && !/^https?:\/\/.+/.test(websiteUrl)) {
      setError(t('invalidUrl'))
      return
    }
    if (logoUrl && !isValidImageSource(logoUrl)) {
      setError(t('invalidImageSource'))
      return
    }
    if (coverImageUrl && !isValidImageSource(coverImageUrl)) {
      setError(t('invalidImageSource'))
      return
    }

    const o = currentOrg as any
    const updates: Record<string, unknown> = {}

    const nextName = orgName.trim()
    if (nextName && nextName !== currentOrg.orgName) updates.name = nextName
    const nextCountry = country.trim()
    if (nextCountry !== (o.country || '')) updates.country = nextCountry
    const nextCity = city.trim()
    if (nextCity !== (o.city || '')) updates.city = nextCity
    const prevCats: string[] = o.categories || []
    if (JSON.stringify([...categories].sort()) !== JSON.stringify([...prevCats].sort()))
      updates.categories = categories

    if (description.trim() !== (o.description || '')) updates.description = description.trim()
    if (address.trim() !== (o.address || '')) updates.address = address.trim()
    if (contactPhone.trim() !== (o.contactPhone || '')) updates.contactPhone = contactPhone.trim()
    if (whatsappNumber.trim() !== (o.whatsappNumber || ''))
      updates.whatsappNumber = whatsappNumber.trim()
    if (websiteUrl.trim() !== (o.websiteUrl || '')) updates.websiteUrl = websiteUrl.trim()
    if (logoUrl.trim() !== (o.logoUrl || '')) updates.logoUrl = logoUrl.trim()
    if (coverImageUrl.trim() !== (o.coverImageUrl || ''))
      updates.coverImageUrl = coverImageUrl.trim()
    if (
      valueOrDefault(logoPositionX, DEFAULT_IMAGE_POSITION) !==
      valueOrDefault(o.logoPositionX, DEFAULT_IMAGE_POSITION)
    )
      updates.logoPositionX = logoUrl.trim()
        ? valueOrDefault(logoPositionX, DEFAULT_IMAGE_POSITION)
        : null
    if (
      valueOrDefault(logoPositionY, DEFAULT_IMAGE_POSITION) !==
      valueOrDefault(o.logoPositionY, DEFAULT_IMAGE_POSITION)
    )
      updates.logoPositionY = logoUrl.trim()
        ? valueOrDefault(logoPositionY, DEFAULT_IMAGE_POSITION)
        : null
    if (
      valueOrDefault(logoScale, DEFAULT_IMAGE_SCALE) !==
      valueOrDefault(o.logoScale, DEFAULT_IMAGE_SCALE)
    )
      updates.logoScale = logoUrl.trim() ? valueOrDefault(logoScale, DEFAULT_IMAGE_SCALE) : null
    if (
      valueOrDefault(coverPositionX, DEFAULT_IMAGE_POSITION) !==
      valueOrDefault(o.coverPositionX, DEFAULT_IMAGE_POSITION)
    )
      updates.coverPositionX = coverImageUrl.trim()
        ? valueOrDefault(coverPositionX, DEFAULT_IMAGE_POSITION)
        : null
    if (
      valueOrDefault(coverPositionY, DEFAULT_IMAGE_POSITION) !==
      valueOrDefault(o.coverPositionY, DEFAULT_IMAGE_POSITION)
    )
      updates.coverPositionY = coverImageUrl.trim()
        ? valueOrDefault(coverPositionY, DEFAULT_IMAGE_POSITION)
        : null
    if (
      valueOrDefault(coverScale, DEFAULT_IMAGE_SCALE) !==
      valueOrDefault(o.coverScale, DEFAULT_IMAGE_SCALE)
    )
      updates.coverScale = coverImageUrl.trim()
        ? valueOrDefault(coverScale, DEFAULT_IMAGE_SCALE)
        : null
    if (isPublicMarketplaceEnabled !== (o.isPublicMarketplaceEnabled ?? false))
      updates.isPublicMarketplaceEnabled = isPublicMarketplaceEnabled

    if (Object.keys(updates).length === 0 || uploadingImage) return

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const idToken = await getIdToken(true)
      if (!idToken) {
        router.push('/b2b/login')
        return
      }

      apiClient.setToken(idToken)
      const { org } = await apiClient.updateOrganization(currentOrgId, updates as any)

      updateProfile((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          organizations: prev.organizations.map((item) =>
            item.orgId === org.id
              ? {
                  ...item,
                  orgName: org.name,
                  country: org.country ?? null,
                  city: org.city ?? null,
                  categories: org.categories ?? null,
                  description: org.description ?? null,
                  address: org.address ?? null,
                  contactPhone: org.contactPhone ?? null,
                  whatsappNumber: org.whatsappNumber ?? null,
                  websiteUrl: org.websiteUrl ?? null,
                  logoUrl: org.logoUrl ?? null,
                  coverImageUrl: org.coverImageUrl ?? null,
                  logoPositionX: org.logoPositionX ?? null,
                  logoPositionY: org.logoPositionY ?? null,
                  logoScale: org.logoScale ?? null,
                  coverPositionX: org.coverPositionX ?? null,
                  coverPositionY: org.coverPositionY ?? null,
                  coverScale: org.coverScale ?? null,
                  isPublicMarketplaceEnabled: org.isPublicMarketplaceEnabled ?? false,
                }
              : item
          ),
        }
      })

      setOrgName(org.name)
      setCountry(org.country || '')
      setCity(org.city || '')
      setCategories(org.categories || [])
      setDescription(org.description || '')
      setAddress(org.address || '')
      setContactPhone(org.contactPhone || '')
      setWhatsappNumber(org.whatsappNumber || '')
      setWebsiteUrl(org.websiteUrl || '')
      setLogoUrl(org.logoUrl || '')
      setCoverImageUrl(org.coverImageUrl || '')
      setLogoPositionX(org.logoPositionX ?? null)
      setLogoPositionY(org.logoPositionY ?? null)
      setLogoScale(org.logoScale ?? null)
      setCoverPositionX(org.coverPositionX ?? null)
      setCoverPositionY(org.coverPositionY ?? null)
      setCoverScale(org.coverScale ?? null)
      setIsPublicMarketplaceEnabled(org.isPublicMarketplaceEnabled ?? false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('updateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload =
    (
      kind: 'logo' | 'cover',
      setter: (value: string) => void,
      inputRef: React.RefObject<HTMLInputElement | null>
    ) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        if (!currentOrgId) return
        const idToken = await getIdToken(true)
        if (!idToken) {
          router.push('/b2b/login')
          return
        }

        setUploadingImage(kind)
        apiClient.setToken(idToken)
        const { url } = await apiClient.uploadOrganizationImage(currentOrgId, file, kind)
        const defaultCrop =
          kind === 'logo'
            ? {
                logoUrl: url,
                logoPositionX: DEFAULT_IMAGE_POSITION,
                logoPositionY: DEFAULT_IMAGE_POSITION,
                logoScale: DEFAULT_IMAGE_SCALE,
              }
            : {
                coverImageUrl: url,
                coverPositionX: DEFAULT_IMAGE_POSITION,
                coverPositionY: DEFAULT_IMAGE_POSITION,
                coverScale: DEFAULT_IMAGE_SCALE,
              }
        const { org } = await apiClient.updateOrganization(currentOrgId, defaultCrop)

        setter(url)
        if (kind === 'logo') {
          setLogoPositionX(DEFAULT_IMAGE_POSITION)
          setLogoPositionY(DEFAULT_IMAGE_POSITION)
          setLogoScale(DEFAULT_IMAGE_SCALE)
        } else {
          setCoverPositionX(DEFAULT_IMAGE_POSITION)
          setCoverPositionY(DEFAULT_IMAGE_POSITION)
          setCoverScale(DEFAULT_IMAGE_SCALE)
        }
        setUploadedImages((prev) => new Set(prev).add(kind))
        updateProfile((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            organizations: prev.organizations.map((item) =>
              item.orgId === org.id
                ? {
                    ...item,
                    orgName: org.name,
                    country: org.country ?? null,
                    city: org.city ?? null,
                    categories: org.categories ?? null,
                    description: org.description ?? null,
                    address: org.address ?? null,
                    contactPhone: org.contactPhone ?? null,
                    whatsappNumber: org.whatsappNumber ?? null,
                    websiteUrl: org.websiteUrl ?? null,
                    logoUrl: org.logoUrl ?? null,
                    coverImageUrl: org.coverImageUrl ?? null,
                    logoPositionX: org.logoPositionX ?? null,
                    logoPositionY: org.logoPositionY ?? null,
                    logoScale: org.logoScale ?? null,
                    coverPositionX: org.coverPositionX ?? null,
                    coverPositionY: org.coverPositionY ?? null,
                    coverScale: org.coverScale ?? null,
                    isPublicMarketplaceEnabled: org.isPublicMarketplaceEnabled ?? false,
                  }
                : item
            ),
          }
        })
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('imageUploadError'))
      } finally {
        setUploadingImage(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    }

  const removeImage = async (kind: 'logo' | 'cover') => {
    if (!currentOrgId) return
    if (kind === 'logo') {
      setLogoUrl('')
      setLogoPositionX(null)
      setLogoPositionY(null)
      setLogoScale(null)
    } else {
      setCoverImageUrl('')
      setCoverPositionX(null)
      setCoverPositionY(null)
      setCoverScale(null)
    }

    try {
      const idToken = await getIdToken(true)
      if (!idToken) return
      apiClient.setToken(idToken)
      const field =
        kind === 'logo'
          ? { logoUrl: '', logoPositionX: null, logoPositionY: null, logoScale: null }
          : { coverImageUrl: '', coverPositionX: null, coverPositionY: null, coverScale: null }
      const { org } = await apiClient.updateOrganization(currentOrgId, field as any)
      updateProfile((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          organizations: prev.organizations.map((item) =>
            item.orgId === org.id
              ? {
                  ...item,
                  logoUrl: org.logoUrl ?? null,
                  coverImageUrl: org.coverImageUrl ?? null,
                  logoPositionX: org.logoPositionX ?? null,
                  logoPositionY: org.logoPositionY ?? null,
                  logoScale: org.logoScale ?? null,
                  coverPositionX: org.coverPositionX ?? null,
                  coverPositionY: org.coverPositionY ?? null,
                  coverScale: org.coverScale ?? null,
                }
              : item
          ),
        }
      })
    } catch {
      // non-critical, local state already cleared
    }
  }

  const resetImageCrop = (kind: 'logo' | 'cover') => {
    if (kind === 'logo') {
      setLogoPositionX(DEFAULT_IMAGE_POSITION)
      setLogoPositionY(DEFAULT_IMAGE_POSITION)
      setLogoScale(DEFAULT_IMAGE_SCALE)
      return
    }

    setCoverPositionX(DEFAULT_IMAGE_POSITION)
    setCoverPositionY(DEFAULT_IMAGE_POSITION)
    setCoverScale(DEFAULT_IMAGE_SCALE)
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!isAdmin || !currentOrg) return null

  const inputCls =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500'
  const iconInputCls =
    'flex-1 px-3 py-2.5 text-sm focus:outline-none disabled:text-gray-500 bg-transparent'
  const countryOptions = COUNTRIES.map((c) => ({
    value: c.code,
    label: locale === 'ru' ? c.ru : locale === 'ky' ? c.ky : c.en,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-600 mt-2">{t('subtitle')}</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Org header card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary-100 p-4 rounded-lg shrink-0">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                {currentOrg.orgName}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                {t('organizationId')} {currentOrg.orgId}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  {t('yourRole')}{' '}
                  <span className="font-medium text-gray-900">{t('administrator')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {t('changesSaved')}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ── Basic Info ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">{t('orgInfo')}</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('orgName')}
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  minLength={1}
                  maxLength={200}
                  disabled={saving}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('country')}
                  </label>
                  <Select
                    value={country}
                    onChange={setCountry}
                    disabled={saving}
                    placeholder={t('countryPlaceholder')}
                    options={[{ value: '', label: t('countryPlaceholder') }, ...countryOptions]}
                    buttonClassName="px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('city')}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={80}
                    disabled={saving}
                    placeholder={t('cityPlaceholder')}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('categories')}
                </label>
                <p className="text-xs text-gray-500 mb-3">{t('categoriesHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {ORG_CATEGORIES.map((cat) => {
                    const active = categories.includes(cat.key)
                    const label = locale === 'ru' ? cat.ru : locale === 'ky' ? cat.ky : cat.en
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        disabled={saving}
                        onClick={() => toggleCategory(cat.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Marketplace Profile ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{t('marketplaceTitle')}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('marketplaceSubtitle')}</p>
              </div>
              {/* Visibility toggle */}
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsPublicMarketplaceEnabled((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isPublicMarketplaceEnabled
                    ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {isPublicMarketplaceEnabled ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                {isPublicMarketplaceEnabled ? t('visible') : t('hidden')}
              </button>
            </div>

            {!isPublicMarketplaceEnabled && (
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-700">
                {t('marketplaceHiddenHint')}
              </div>
            )}

            <div className="mt-5 space-y-5">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5 text-gray-400" />
                  {t('description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  disabled={saving}
                  placeholder={t('descriptionPlaceholder')}
                  className={inputCls + ' resize-none'}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/1000</p>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {t('address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  disabled={saving}
                  placeholder={t('addressPlaceholder')}
                  className={inputCls}
                />
              </div>

              {/* Phone + WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {t('contactPhone')}
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      maxLength={50}
                      disabled={saving}
                      placeholder="+996 700 000 000"
                      className={iconInputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                    {t('whatsappNumber')}
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      maxLength={50}
                      disabled={saving}
                      placeholder="+996 700 000 000"
                      className={iconInputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-gray-400" />
                  {t('websiteUrl')}
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  maxLength={500}
                  disabled={saving}
                  placeholder="https://example.com"
                  className={inputCls}
                />
              </div>

              {/* Logo + Cover URLs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                    {t('logoUrl')}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      maxLength={500}
                      disabled={saving || uploadingImage === 'logo'}
                      placeholder="https://..."
                      className={inputCls}
                    />
                    <button
                      type="button"
                      disabled={saving || uploadingImage !== null}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingImage === 'logo' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>
                        {uploadingImage === 'logo' ? t('uploadingImage') : t('uploadImage')}
                      </span>
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload('logo', setLogoUrl, logoInputRef)}
                    />
                  </div>
                  {logoUrl && logoUrl !== ((currentOrg as any)?.logoUrl || '') && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
                      <span>
                        {uploadedImages.has('logo') ? t('imageSavedHint') : t('imageReadyHint')}
                      </span>
                      <button
                        type="button"
                        disabled={saving || uploadingImage !== null}
                        onClick={() => removeImage('logo')}
                        className="inline-flex items-center gap-1 font-medium text-primary-700 transition-colors hover:text-primary-900 disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>{t('removeImage')}</span>
                      </button>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{t('imageSourceHint')}</p>
                  {logoUrl && isValidImageSource(logoUrl) && (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                          {t('logoCrop')}
                        </p>
                        <button
                          type="button"
                          disabled={saving || uploadingImage !== null}
                          onClick={() => resetImageCrop('logo')}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t('resetCrop')}
                        </button>
                      </div>
                      <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <img
                          src={logoUrl}
                          alt={t('logoPreviewAlt')}
                          className="h-full w-full object-cover"
                          style={imageCropStyle(logoPositionX, logoPositionY, logoScale)}
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <CropControl
                          label={t('cropHorizontal')}
                          min={0}
                          max={100}
                          value={valueOrDefault(logoPositionX, DEFAULT_IMAGE_POSITION)}
                          onChange={setLogoPositionX}
                        />
                        <CropControl
                          label={t('cropVertical')}
                          min={0}
                          max={100}
                          value={valueOrDefault(logoPositionY, DEFAULT_IMAGE_POSITION)}
                          onChange={setLogoPositionY}
                        />
                        <CropControl
                          label={t('cropZoom')}
                          min={1}
                          max={2}
                          step={0.05}
                          value={valueOrDefault(logoScale, DEFAULT_IMAGE_SCALE)}
                          onChange={setLogoScale}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                    {t('coverImageUrl')}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="url"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      maxLength={500}
                      disabled={saving || uploadingImage === 'cover'}
                      placeholder="https://..."
                      className={inputCls}
                    />
                    <button
                      type="button"
                      disabled={saving || uploadingImage !== null}
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingImage === 'cover' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>
                        {uploadingImage === 'cover' ? t('uploadingImage') : t('uploadImage')}
                      </span>
                    </button>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload('cover', setCoverImageUrl, coverInputRef)}
                    />
                  </div>
                  {coverImageUrl &&
                    coverImageUrl !== ((currentOrg as any)?.coverImageUrl || '') && (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
                        <span>
                          {uploadedImages.has('cover') ? t('imageSavedHint') : t('imageReadyHint')}
                        </span>
                        <button
                          type="button"
                          disabled={saving || uploadingImage !== null}
                          onClick={() => removeImage('cover')}
                          className="inline-flex items-center gap-1 font-medium text-primary-700 transition-colors hover:text-primary-900 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{t('removeImage')}</span>
                        </button>
                      </div>
                    )}
                  <p className="mt-1 text-xs text-gray-500">{t('imageSourceHint')}</p>
                  {coverImageUrl && isValidImageSource(coverImageUrl) && (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                          {t('coverCrop')}
                        </p>
                        <button
                          type="button"
                          disabled={saving || uploadingImage !== null}
                          onClick={() => resetImageCrop('cover')}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t('resetCrop')}
                        </button>
                      </div>
                      <div className="relative mb-4 h-36 overflow-hidden rounded-2xl border border-gray-200 bg-slate-900 shadow-sm">
                        <img
                          src={coverImageUrl}
                          alt={t('coverPreviewAlt')}
                          className="h-full w-full object-cover"
                          style={imageCropStyle(coverPositionX, coverPositionY, coverScale)}
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <CropControl
                          label={t('cropHorizontal')}
                          min={0}
                          max={100}
                          value={valueOrDefault(coverPositionX, DEFAULT_IMAGE_POSITION)}
                          onChange={setCoverPositionX}
                        />
                        <CropControl
                          label={t('cropVertical')}
                          min={0}
                          max={100}
                          value={valueOrDefault(coverPositionY, DEFAULT_IMAGE_POSITION)}
                          onChange={setCoverPositionY}
                        />
                        <CropControl
                          label={t('cropZoom')}
                          min={1}
                          max={2}
                          step={0.05}
                          value={valueOrDefault(coverScale, DEFAULT_IMAGE_SCALE)}
                          onChange={setCoverScale}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || uploadingImage !== null}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('saving')}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('saveChanges')}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/b2b/team${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <UserCog className="w-5 h-5 text-primary-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{t('manageSpecialists')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('viewManageTeam')}</p>
              </div>
            </Link>
            <Link
              href={`/b2b/invites${currentOrgId ? `?orgId=${currentOrgId}` : ''}`}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <Key className="w-5 h-5 text-primary-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{t('inviteCodes')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('createManageInvites')}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Demo data seeder — admin only */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Демо-данные для показа</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Быстро заполните платформу тестовыми детьми и заданиями, чтобы показать клиенту
                  как всё работает.
                </p>
              </div>
            </div>

            {demoMessage && (
              <div className="mb-4 px-3 py-2 bg-white rounded-lg border border-violet-200 text-sm text-violet-700">
                {demoMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={demoSeeding || !currentOrgId}
                onClick={async () => {
                  if (!currentOrgId) return
                  setDemoSeeding(true)
                  setDemoMessage('')
                  try {
                    const res = await apiClient.seedDemoData(currentOrgId)
                    setDemoMessage(`✓ ${res.message}`)
                  } catch {
                    setDemoMessage('Ошибка при создании демо-данных')
                  } finally {
                    setDemoSeeding(false)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {demoSeeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                {demoSeeding ? 'Создаём...' : 'Загрузить демо-данные'}
              </button>

              <button
                type="button"
                disabled={demoClearing || !currentOrgId}
                onClick={async () => {
                  if (!currentOrgId) return
                  if (!confirm('Удалить все демо-данные (дети и задания с пометкой demo)?')) return
                  setDemoClearing(true)
                  setDemoMessage('')
                  try {
                    const res = await apiClient.clearDemoData(currentOrgId)
                    setDemoMessage(
                      `✓ Удалено: ${res.deleted.children} детей, ${res.deleted.tasks} заданий`
                    )
                  } catch {
                    setDemoMessage('Ошибка при удалении демо-данных')
                  } finally {
                    setDemoClearing(false)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {demoClearing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {demoClearing ? 'Удаляем...' : 'Очистить демо'}
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Создаёт 3 тестовых ребёнка и 5 заданий. Можно удалить одной кнопкой.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
