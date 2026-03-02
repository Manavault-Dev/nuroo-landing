import type { Metadata } from 'next'
import { Hero } from '@/components/Hero'
import { Solution } from '@/components/Solution'
import { Platform } from '@/components/Platform'
import { Pricing } from '@/components/Pricing'
import { Footer } from '@/components/Footer'
import { setRequestLocale } from 'next-intl/server'

type Props = { params: { locale: string } }

const BASE = 'https://usenuroo.com'

const LOCALE_META = {
  ru: {
    title: 'Nuroo — ИИ-поддержка для детей с особыми потребностями',
    description:
      'Персонализированные упражнения, ИИ-чат NurooAi и трекинг прогресса для детей с аутизмом, ЗПР, СДВГ и другими особенностями развития. Платформа для семей, центров и специалистов.',
    keywords: [
      'приложение для детей с особыми потребностями',
      'аутизм приложение',
      'ЗПР упражнения',
      'СДВГ ребёнок',
      'логопед онлайн',
      'ABA терапия',
      'детская реабилитация',
      'особые дети',
      'Nuroo',
      'ИИ помощник ребёнку',
      'прогресс ребёнка',
      'центр для детей',
      'дети с особыми потребностями Кыргызстан',
    ],
    ogLocale: 'ru_RU',
  },
  en: {
    title: 'Nuroo — AI Support for Children with Special Needs',
    description:
      'AI-powered exercises, NurooAi chat, and progress tracking for children with autism, ADHD, and developmental delays. Accessible therapy for every family, specialist and organization.',
    keywords: [
      'special needs app',
      'AI therapy children',
      'autism app',
      'ADHD children app',
      'developmental support',
      'ABA therapy online',
      'child development platform',
      'Nuroo',
      'special education',
      'therapy at home',
    ],
    ogLocale: 'en_US',
  },
  ky: {
    title: 'Nuroo — Атайын муктаждыктары бар балдар үчүн ЖИ колдоосу',
    description:
      'Персоналдаштырылган көнүгүүлөр, NurooAi ЖИ чаты жана аутизм, ЖАК жана ДДДС менен балдар үчүн жетишкендиктерди байкоо. Үй-бүлөлөр жана адистер үчүн платформа.',
    keywords: [
      'атайын муктаждыктары бар балдар',
      'аутизм колдонмосу',
      'балдар үчүн ЖИ',
      'Nuroo',
      'балдарды өнүктүрүү',
    ],
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
        ru: `${BASE}/ru`,
        en: `${BASE}/en`,
        ky: `${BASE}/ky`,
        'x-default': `${BASE}/ru`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE}/${locale}`,
      locale: meta.ogLocale,
      alternateLocale: alternateLocales,
      images: [
        {
          url: `${BASE}/mother-and-child.png`,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
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
      logo: {
        '@type': 'ImageObject',
        url: `${BASE}/logo.png`,
        width: 512,
        height: 512,
      },
      description:
        'AI-powered platform for supporting children with special needs — autism, ADHD, developmental delays.',
      sameAs: ['https://apps.apple.com/us/app/nuroo-ai/id6753772410'],
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
      '@type': 'MobileApplication',
      '@id': `${BASE}/#app`,
      name: 'Nuroo AI',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'EducationApplication',
      applicationSubCategory: 'Special Education',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '120',
      },
      description:
        'AI-powered exercises, progress tracking and NurooAi chat support for children with special needs.',
      url: 'https://apps.apple.com/us/app/nuroo-ai/id6753772410',
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE}/#b2b`,
      name: 'Nuroo Platform for Organizations',
      applicationCategory: 'BusinessApplication',
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '1500', priceCurrency: 'KGS' },
        { '@type': 'Offer', name: 'Growth', price: '3500', priceCurrency: 'KGS' },
        { '@type': 'Offer', name: 'Enterprise', price: '10000', priceCurrency: 'KGS' },
      ],
      description:
        'B2B platform for child development centers and specialists to manage children, assign content, and track attendance.',
      publisher: { '@id': `${BASE}/#organization` },
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
      <div className="min-h-screen bg-white dark:bg-gray-900 min-w-0 overflow-x-hidden">
        <Hero />
        <Solution />
        <Platform />
        <Pricing />
        <Footer />
      </div>
    </>
  )
}
