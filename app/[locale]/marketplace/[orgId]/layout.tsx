import type { Metadata } from 'next'
import { getAbsoluteUrl } from '@/lib/seo/site'

type Props = {
  params: { locale: string; orgId: string }
  children: React.ReactNode
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3101'

const LOCALE_OG: Record<string, string> = { ru: 'ru_RU', en: 'en_US', ky: 'ky_KG' }

const FALLBACK: Record<string, { title: string; description: string }> = {
  ru: {
    title: 'Детский центр | Nuroo',
    description: 'Запишитесь онлайн на занятия в детский центр через Nuroo.',
  },
  en: {
    title: 'Child Development Center | Nuroo',
    description: 'Book sessions at a child development center through Nuroo.',
  },
  ky: {
    title: 'Балдар борбору | Nuroo',
    description: 'Nuroo аркылуу балдар борборуна онлайн жазылыңыз.',
  },
}

async function fetchOrgMeta(
  orgId: string
): Promise<{ name: string | null; description: string | null } | null> {
  try {
    const res = await fetch(`${API_URL}/organizations/${orgId}/public`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return { name: data?.name ?? null, description: data?.branding?.description ?? null }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, orgId } = params
  const fallback = FALLBACK[locale] ?? FALLBACK.en
  const ogLocale = LOCALE_OG[locale] ?? 'en_US'

  const org = await fetchOrgMeta(orgId)

  const title = org?.name ? `${org.name} | Nuroo` : fallback.title
  const description = org?.description || fallback.description
  const pageUrl = getAbsoluteUrl(`/${locale}/marketplace/${orgId}`)

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
      languages: {
        ru: getAbsoluteUrl(`/ru/marketplace/${orgId}`),
        en: getAbsoluteUrl(`/en/marketplace/${orgId}`),
        ky: getAbsoluteUrl(`/ky/marketplace/${orgId}`),
        'x-default': getAbsoluteUrl(`/ru/marketplace/${orgId}`),
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Nuroo',
      url: pageUrl,
      locale: ogLocale,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return children
}
