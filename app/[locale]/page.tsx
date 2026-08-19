import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Hero } from '@/components/landing/Hero'
import { setRequestLocale } from 'next-intl/server'
import { getAbsoluteUrl, getSiteUrl } from '@/lib/seo/site'

function SectionSkeleton() {
  return (
    <div className="py-16 md:py-24 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mx-auto mb-6" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mx-auto mb-12" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

const ProductShowcase = dynamic(
  () => import('@/components/landing/ProductShowcase').then((m) => m.ProductShowcase),
  { loading: () => <SectionSkeleton /> }
)
const BusinessDashboard = dynamic(
  () => import('@/components/landing/BusinessDashboard').then((m) => m.BusinessDashboard),
  { loading: () => <SectionSkeleton /> }
)
const SocialBooking = dynamic(
  () => import('@/components/landing/SocialBooking').then((m) => m.SocialBooking),
  { loading: () => <SectionSkeleton /> }
)
const HowItWorks = dynamic(
  () => import('@/components/landing/HowItWorks').then((m) => m.HowItWorks),
  { loading: () => <SectionSkeleton /> }
)
const Pricing = dynamic(() => import('@/components/landing/Pricing').then((m) => m.Pricing), {
  loading: () => <SectionSkeleton />,
})
const Footer = dynamic(() => import('@/components/layout/Footer').then((m) => m.Footer))

type Props = { params: { locale: string } }

const BASE = getSiteUrl()

const LOCALE_META = {
  ru: {
    title: 'Nuroo | Маркетплейс детского развития',
    description:
      'Найдите логопеда, психолога, дефектолога, детский центр или программу развития. Записывайтесь онлайн, управляйте занятиями и следите за прогрессом ребёнка. Всё в Nuroo.',
    keywords: [
      'маркетплейс детского развития',
      'логопед онлайн запись',
      'детский центр Бишкек',
      'психолог для ребёнка',
      'дефектолог онлайн',
      'записать ребёнка к специалисту',
      'детские программы развития',
      'групповые занятия дети',
      'Nuroo',
      'развитие ребёнка',
      'детские мастер-классы',
      'онлайн запись специалист',
    ],
    ogLocale: 'ru_RU',
  },
  en: {
    title: 'Nuroo | Child Development Marketplace',
    description:
      'Find speech therapists, psychologists, child development centers and programs. Book consultations and group sessions online through Nuroo.',
    keywords: [
      'child development marketplace',
      'book speech therapist online',
      'child development center',
      'find psychologist for child',
      'kids programs booking',
      'Nuroo',
      'child specialist booking',
      'group classes children',
    ],
    ogLocale: 'en_US',
  },
  ky: {
    title: 'Nuroo | Балдарды өнүктүрүү маркетплейси',
    description:
      'Логопед, психолог, дефектолог, балдар борборун жана өнүктүрүү программаларын табыңыз. Nuroo аркылуу онлайн жазылыңыз.',
    keywords: ['балдарды өнүктүрүү', 'логопед онлайн', 'балдар борбору', 'Nuroo маркетплейс'],
    ogLocale: 'ky_KG',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale
  const meta = LOCALE_META[locale as keyof typeof LOCALE_META] ?? LOCALE_META.en
  const alternateLocales = (['ru', 'en', 'ky'] as const)
    .filter((l) => l !== locale)
    .map((l) => LOCALE_META[l].ogLocale)

  return {
    title: meta.title,
    description: meta.description,
    keywords: [...meta.keywords],
    alternates: {
      canonical: `${BASE}/${locale}`,
      languages: {
        ru: getAbsoluteUrl('/ru'),
        en: getAbsoluteUrl('/en'),
        ky: getAbsoluteUrl('/ky'),
        'x-default': getAbsoluteUrl('/ru'),
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE}/${locale}`,
      locale: meta.ogLocale,
      alternateLocale: alternateLocales,
    },
    twitter: {
      title: meta.title,
      description: meta.description,
    },
  }
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'Nuroo',
      url: BASE,
      logo: { '@type': 'ImageObject', url: getAbsoluteUrl('/logo.png'), width: 512, height: 512 },
      description:
        'Marketplace connecting parents with child development specialists, centers and programs.',
      foundingDate: '2024',
      areaServed: ['KG', 'RU', 'KZ', 'UZ'],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'Nuroo',
      inLanguage: ['ru', 'en', 'ky'],
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${BASE}/#marketplace`,
      name: 'Nuroo Marketplace',
      serviceType: 'Child Development Marketplace',
      description:
        'Online platform for discovering and booking child development specialists, centers, programs and group sessions.',
      provider: { '@id': `${BASE}/#organization` },
      areaServed: ['KG', 'RU', 'KZ', 'UZ'],
    },
  ],
}

export default function Home({ params }: Props) {
  setRequestLocale(params.locale)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-white dark:bg-gray-900 min-w-0 overflow-x-hidden">
        <Hero />
        <ProductShowcase />
        <BusinessDashboard />
        <SocialBooking />
        <HowItWorks />
        <Pricing />
        <Footer />
      </div>
    </>
  )
}
