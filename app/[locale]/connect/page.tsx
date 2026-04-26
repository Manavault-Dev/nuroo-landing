'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'

interface OrgBranding {
  logo?: string | null
  logoPositionX?: number | null
  logoPositionY?: number | null
  logoScale?: number | null
  name?: string | null
  description?: string | null
  primaryColor?: string | null
  welcomeMessage?: string | null
  coverImage?: string | null
  coverPositionX?: number | null
  coverPositionY?: number | null
  coverScale?: number | null
}

interface OrgInfo {
  orgName: string
  branding: OrgBranding | null
}

function usePrimaryColor(color: string | null | undefined) {
  const base = color || '#14b8a6'
  // Generate a light tint (15% opacity)
  const hex = base.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return {
    base,
    tint: `rgba(${r},${g},${b},0.12)`,
    tintStrong: `rgba(${r},${g},${b},0.2)`,
  }
}

function valueOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function imageCropStyle(
  x: number | null | undefined,
  y: number | null | undefined,
  scale: number | null | undefined
) {
  return {
    objectPosition: `${valueOrDefault(x, 50)}% ${valueOrDefault(y, 50)}%`,
    transform: `scale(${valueOrDefault(scale, 1)})`,
  }
}

function ConnectPageInner() {
  const t = useTranslations('b2b.connect')
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const specialistName = searchParams.get('specialist')
  const inviteCode = searchParams.get('code')

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      setError(true)
      return
    }

    fetch(`${API_BASE}/public/orgs/${orgId}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setOrg({ orgName: data.orgName, branding: data.branding })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [orgId])

  const displayName = org?.branding?.name || org?.orgName || t('yourCenter')
  const color = usePrimaryColor(org?.branding?.primaryColor)
  const coverCropStyle = imageCropStyle(
    org?.branding?.coverPositionX,
    org?.branding?.coverPositionY,
    org?.branding?.coverScale
  )
  const logoCropStyle = imageCropStyle(
    org?.branding?.logoPositionX,
    org?.branding?.logoPositionY,
    org?.branding?.logoScale
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">{t('linkNotFound')}</h1>
          <p className="text-sm text-gray-500">{t('linkInvalid')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Cover image */}
      {org.branding?.coverImage && (
        <div className="h-36 sm:h-48 w-full overflow-hidden">
          <img
            src={org.branding.coverImage}
            alt=""
            className="w-full h-full object-cover"
            style={coverCropStyle}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Org Logo */}
          <div className="flex justify-center mb-6">
            {org.branding?.logo ? (
              <div className="h-20 w-20 overflow-hidden rounded-2xl shadow-lg">
                <img
                  src={org.branding.logo}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  style={logoCropStyle}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                style={{ background: color.base }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Main card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Color accent top bar */}
            <div className="h-1.5 w-full" style={{ background: color.base }} />

            <div className="px-8 pt-8 pb-6 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h1>

              {org.branding?.description && (
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  {org.branding.description}
                </p>
              )}

              {/* Connected specialist */}
              {specialistName && (
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-6"
                  style={{ background: color.tint }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                    style={{ background: color.base }}
                  >
                    {specialistName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs text-gray-500 leading-none">{t('connectedWith')}</p>
                    <p className="text-sm font-semibold text-gray-900 leading-snug truncate">
                      {specialistName}
                    </p>
                  </div>
                </div>
              )}

              {/* Welcome message */}
              {org.branding?.welcomeMessage ? (
                <p className="text-sm text-gray-600 leading-relaxed mb-6 italic">
                  &ldquo;{org.branding.welcomeMessage}&rdquo;
                </p>
              ) : (
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  {t('invitedToConnect', { name: displayName })}
                </p>
              )}

              {/* Invite code display */}
              {inviteCode && (
                <div className="rounded-2xl px-4 py-3 mb-6" style={{ background: color.tint }}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{t('yourInviteCode')}</p>
                  <p
                    className="text-xl font-bold tracking-widest font-mono"
                    style={{ color: color.base }}
                  >
                    {inviteCode}
                  </p>
                </div>
              )}

              {/* CTA */}
              <button
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
                style={{ background: color.base }}
                onClick={() => {
                  // Opens App Store / Play Store or the Nuroo app
                  window.location.href = 'https://usenuroo.com'
                }}
              >
                {t('openApp')}
              </button>

              <p className="text-xs text-gray-400 mt-3">
                {t('enterCodePrefix')}{' '}
                <span className="font-mono font-medium">{inviteCode || '—'}</span>{' '}
                {t('enterCodeSuffix')}
              </p>
            </div>

            {/* Success indicators */}
            <div className="border-t border-gray-100 px-6 py-4 space-y-2.5">
              {[
                t('benefitSecureConnection'),
                t('benefitTrackProgress'),
                t('benefitReceiveHomework'),
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: color.base }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Powered by */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <img src="/Logo.svg" alt="Nuroo" className="h-5 w-5 shrink-0 object-contain" />
            <p className="text-xs text-gray-400 leading-none">
              {displayName} · {t('poweredBy')}{' '}
              <span className="font-semibold text-teal-600">Nuroo</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      }
    >
      <ConnectPageInner />
    </Suspense>
  )
}
