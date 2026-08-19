import type { Metadata } from 'next'
import { getAbsoluteUrl } from '@/lib/seo/site'

type Props = { params: { locale: string }; children: React.ReactNode }

const LOCALE_OG: Record<string, string> = { ru: 'ru_RU', en: 'en_US', ky: 'ky_KG' }

const CONNECT_META: Record<string, { title: string; description: string; keywords: string[] }> = {
  ru: {
    title: 'Подключить центр к Nuroo | Партнёрство',
    description:
      'Подключите ваш детский центр или учреждение к платформе Nuroo. Управляйте записями, специалистами и клиентами в одном месте.',
    keywords: [
      'подключить центр Nuroo',
      'партнёрство Nuroo',
      'детский центр платформа',
      'Nuroo для организаций',
      'CRM детский центр',
    ],
  },
  en: {
    title: 'Connect your center to Nuroo | Partnership',
    description:
      'Connect your child development center or organization to the Nuroo platform. Manage bookings, specialists and clients in one place.',
    keywords: [
      'connect center Nuroo',
      'Nuroo partnership',
      'child center platform',
      'Nuroo for organizations',
      'childcare management',
    ],
  },
  ky: {
    title: 'Nuroo платформасына борборду туташтыруу | Өнөктөштүк',
    description:
      'Балдар борборуңузду же уюмуңузду Nuroo платформасына туташтырыңыз. Жазылууларды, адистерди жана кардарларды бир жерден башкарыңыз.',
    keywords: ['Nuroo борборго туташуу', 'Nuroo өнөктөштүк', 'балдар борбору платформасы'],
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  const meta = CONNECT_META[locale] ?? CONNECT_META.en
  const ogLocale = LOCALE_OG[locale] ?? 'en_US'
  const alternateLocales = Object.entries(LOCALE_OG)
    .filter(([l]) => l !== locale)
    .map(([, v]) => v)

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: getAbsoluteUrl(`/${locale}/connect`),
      languages: {
        ru: getAbsoluteUrl('/ru/connect'),
        en: getAbsoluteUrl('/en/connect'),
        ky: getAbsoluteUrl('/ky/connect'),
        'x-default': getAbsoluteUrl('/ru/connect'),
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: 'website',
      siteName: 'Nuroo',
      url: getAbsoluteUrl(`/${locale}/connect`),
      locale: ogLocale,
      alternateLocale: alternateLocales,
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
  }
}

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return children
}
