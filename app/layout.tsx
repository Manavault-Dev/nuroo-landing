import type { Metadata } from 'next'
import { getSiteUrl } from '@/lib/seo/site'
import './globals.css'

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  title: {
    default: 'Nuroo | Маркетплейс детского развития',
    template: '%s | Nuroo',
  },
  description:
    'Nuroo: маркетплейс для поиска логопедов, психологов, дефектологов, детских центров и программ развития. Онлайн-запись, управление занятиями и прогресс ребёнка в одном приложении.',
  keywords: [
    'Nuroo',
    'маркетплейс детского развития',
    'логопед онлайн запись',
    'детский центр Бишкек',
    'психолог для ребёнка',
    'дефектолог онлайн',
    'детские программы развития',
    'child development marketplace',
    'speech therapist online booking',
    'child development center',
    'балдарды өнүктүрүү',
  ],
  authors: [{ name: 'Nuroo by Manavault Studio' }],
  creator: 'Nuroo',
  publisher: 'Nuroo',
  category: 'Education',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: ['en_US', 'ky_KG'],
    url: SITE_URL,
    siteName: 'Nuroo',
    title: 'Nuroo | Маркетплейс детского развития',
    description:
      'Найдите логопеда, психолога, дефектолога, детский центр или программу развития. Онлайн-запись и управление занятиями в Nuroo.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nuroo | Маркетплейс детского развития',
    description:
      'Найдите логопеда, психолога, детский центр или программу развития. Онлайн-запись в Nuroo.',
    creator: '@nuroo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'yxwxk4p78_GGey4ZCj-VaVm5BxvhEfRqk3IvBgbNq5A',
  },
}

// The <html> tag with the correct lang attribute is rendered in app/[locale]/layout.tsx
// so each locale page gets lang="ru" / lang="en" / lang="ky" properly.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
