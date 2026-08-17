import type { Metadata } from 'next'
import { AmplitudeProvider } from '@/components/providers/AmplitudeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nuroo — Маркетплейс детского развития',
    template: '%s | Nuroo',
  },
  description:
    'Nuroo — маркетплейс для поиска логопедов, психологов, дефектологов, детских центров и программ развития. Онлайн-запись, управление занятиями и прогресс ребёнка в одном приложении.',
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
  metadataBase: new URL('https://usenuroo.com'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: ['en_US', 'ky_KG'],
    url: 'https://usenuroo.com',
    siteName: 'Nuroo',
    title: 'Nuroo — Маркетплейс детского развития',
    description:
      'Найдите логопеда, психолога, дефектолога, детский центр или программу развития. Онлайн-запись и управление занятиями в Nuroo.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nuroo — Маркетплейс детского развития',
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var path = window.location.pathname || '/';
                var publicPath = !/^\\/(en|ru|ky)\\/b2b(\\/|$)/.test(path);
                if (!publicPath) return;
                var root = document.documentElement;
                root.classList.remove('dark');
                root.classList.add('light');
                root.style.colorScheme = 'light';
              })();
            `,
          }}
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#14b8a6" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
      </head>
      <body className="font-sans overflow-x-hidden">
        <AmplitudeProvider />
        {children}
      </body>
    </html>
  )
}
