import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Hero } from '@/components/landing/Hero'
import { setRequestLocale } from 'next-intl/server'

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

const Solution = dynamic(() => import('@/components/landing/Solution').then((m) => m.Solution), {
  loading: () => <SectionSkeleton />,
})
const IndependentPath = dynamic(
  () => import('@/components/landing/IndependentPath').then((m) => m.IndependentPath),
  { loading: () => <SectionSkeleton /> }
)
const Platform = dynamic(() => import('@/components/landing/Platform').then((m) => m.Platform), {
  loading: () => <SectionSkeleton />,
})
const Pricing = dynamic(() => import('@/components/landing/Pricing').then((m) => m.Pricing), {
  loading: () => <SectionSkeleton />,
})
const Footer = dynamic(() => import('@/components/layout/Footer').then((m) => m.Footer))

type Props = { params: { locale: string } }

const BASE = 'https://usenuroo.com'

const LOCALE_META = {
  ru: {
    title: 'Nuroo — ИИ-поддержка для детей с особыми потребностями',
    description:
      'Nuroo — персонализированные упражнения, ИИ-чат и трекинг прогресса для детей с аутизмом, ЗПР, СДВГ. Платформа для семей, реабилитационных центров и специалистов в Кыргызстане и СНГ.',
    keywords: [
      'Nuroo',
      'приложение для детей с особыми потребностями',
      'аутизм приложение',
      'ЗПР упражнения',
      'СДВГ ребёнок',
      'логопед онлайн',
      'ABA терапия',
      'детская реабилитация',
      'особые дети',
      'ИИ помощник ребёнку',
      'прогресс ребёнка',
      'центр для детей',
      'дети с особыми потребностями Кыргызстан',
      'коррекционная педагогика',
      'дефектолог онлайн',
      'ранняя интервенция',
      'нейроразнообразие',
      'инклюзивное образование',
    ],
    ogLocale: 'ru_RU',
  },
  en: {
    title: 'Nuroo — AI Support for Children with Special Needs',
    description:
      'Nuroo delivers AI-powered exercises, 24/7 chat support, and real-time progress tracking for children with autism, ADHD, and developmental delays. Trusted by families, specialists and child development centers.',
    keywords: [
      'Nuroo',
      'special needs app',
      'AI therapy children',
      'autism support app',
      'ADHD children app',
      'developmental delays support',
      'ABA therapy online',
      'child development platform',
      'special education technology',
      'therapy at home',
      'neurodiversity app',
      'early intervention',
      'inclusive education',
      'speech therapy app',
      'occupational therapy app',
    ],
    ogLocale: 'en_US',
  },
  ky: {
    title: 'Nuroo — Атайын муктаждыктары бар балдар үчүн ЖИ колдоосу',
    description:
      'Nuroo — аутизм, ДДДС жана өнүгүү кечигүүлөрү бар балдар үчүн жекелештирилген көнүгүүлөр, ЖИ чат жана жетишкендиктерди байкоо. Үй-бүлөлөр, адистер жана борборлор үчүн платформа.',
    keywords: [
      'Nuroo',
      'атайын муктаждыктары бар балдар',
      'аутизм колдонмосу',
      'балдар үчүн ЖИ',
      'балдарды өнүктүрүү',
      'ДДДС балдар',
      'логопед онлайн',
      'реабилитация борбору',
      'инклюзивдүү билим берүү',
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
      alternateName: 'Nuroo by Manavault Studio',
      url: BASE,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE}/logo.png`,
        width: 512,
        height: 512,
      },
      description:
        'AI-powered platform for supporting children with special needs — autism, ADHD, developmental delays.',
      foundingDate: '2024',
      areaServed: ['KG', 'RU', 'KZ', 'UZ'],
      sameAs: ['https://apps.apple.com/us/app/nuroo-ai/id6753772410'],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'Nuroo',
      inLanguage: ['ru', 'en', 'ky'],
      publisher: { '@id': `${BASE}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE}/ru/help?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'MobileApplication',
      '@id': `${BASE}/#app`,
      name: 'Nuroo',
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
        'AI-powered exercises, progress tracking and Nuroo chat support for children with special needs.',
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
    {
      '@type': 'FAQPage',
      '@id': `${BASE}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Nuroo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Nuroo is an AI-powered platform for children with special needs — autism, ADHD, developmental delays. It provides personalized exercises, 24/7 AI chat support, and real-time progress tracking for families, specialists and organizations.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does Nuroo work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Nuroo uses AI to deliver personalized developmental exercises and 24/7 chat support tailored to each child's unique needs and learning style. Parents and specialists track progress in real time.",
          },
        },
        {
          '@type': 'Question',
          name: 'Where can I download Nuroo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Nuroo is available on the App Store and Google Play. Download the app to start personalized exercises and AI support for your child's development.",
          },
        },
        {
          '@type': 'Question',
          name: 'What special needs does Nuroo support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Nuroo supports children with autism, ADHD, learning difficulties, developmental delays, speech delays, and other special needs. The AI adapts to each child's unique needs and learning style.",
          },
        },
        {
          '@type': 'Question',
          name: 'Can Nuroo be used alongside traditional therapy?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! Nuroo complements traditional therapy rather than replacing it. Use the platform alongside existing therapy sessions for additional support and practice at home.',
          },
        },
      ],
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
        <IndependentPath />
        <Platform />
        <Pricing />
        <Footer />
      </div>
    </>
  )
}
