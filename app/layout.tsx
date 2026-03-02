import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: {
    default: 'Nuroo — AI Support for Children with Special Needs',
    template: '%s | Nuroo',
  },
  description:
    'Nuroo — AI-powered exercises, NurooAi chat and progress tracking for children with autism, ADHD and developmental delays. Platform for families, specialists and organizations.',
  keywords: [
    // English
    'special needs app',
    'AI therapy children',
    'autism app',
    'ADHD children',
    'child development platform',
    'therapy at home',
    // Russian (high search volume in CIS)
    'приложение для детей с особыми потребностями',
    'аутизм приложение',
    'ЗПР упражнения',
    'СДВГ ребёнок',
    'детская реабилитация',
    'Nuroo',
  ],
  authors: [{ name: 'Nuroo Team' }],
  creator: 'Nuroo',
  publisher: 'Nuroo',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://usenuroo.com'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: ['en_US', 'ky_KG'],
    url: 'https://usenuroo.com',
    siteName: 'Nuroo',
    title: 'Nuroo — AI Support for Children with Special Needs',
    description:
      'AI-powered exercises, NurooAi chat and progress tracking for children with autism, ADHD and developmental delays.',
    images: [
      {
        url: '/mother-and-child.png',
        width: 1200,
        height: 630,
        alt: 'Nuroo — AI Support for Children with Special Needs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nuroo — AI Support for Children with Special Needs',
    description:
      'AI-powered exercises and support for children with autism, ADHD and developmental delays.',
    images: ['/mother-and-child.png'],
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#14b8a6" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
