import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Nuroo - AI-Powered Support for Children with Special Needs',
    template: '%s | Nuroo'
  },
  description: 'Nuroo provides AI-powered exercises, NurooAi chat support, and progress tracking for children with special needs. Making therapy accessible and affordable for every family.',
  keywords: [
    'special needs support',
    'AI therapy',
    'developmental exercises',
    'child development',
    'special needs app',
    'therapy at home',
    'autism support',
    'learning disabilities',
    'developmental support',
    'AI chat support'
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
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://usenuroo.com',
    siteName: 'Nuroo',
    title: 'Nuroo - AI-Powered Support for Children with Special Needs',
    description: 'Nuroo provides AI-powered exercises, NurooAi chat support, and progress tracking for children with special needs. Making therapy accessible and affordable for every family.',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Nuroo - AI-Powered Support for Children with Special Needs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nuroo - AI-Powered Support for Children with Special Needs',
    description: 'Nuroo provides AI-powered exercises, NurooAi chat support, and progress tracking for children with special needs. Making therapy accessible and affordable for every family.',
    images: ['/logo.png'],
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
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#14b8a6" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  )
}
