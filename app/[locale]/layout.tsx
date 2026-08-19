import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { ConditionalHeader } from '@/components/layout/ConditionalHeader'
import { LandingOnlyEffects } from '@/components/effects/LandingOnlyEffects'
import { AmplitudeProvider } from '@/components/providers/AmplitudeProvider'

type Props = { children: React.ReactNode; params: { locale: string } }

// Maps Next.js locale codes to BCP-47 lang attribute values
const LOCALE_LANG: Record<string, string> = {
  ru: 'ru',
  en: 'en',
  ky: 'ky',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }
  setRequestLocale(locale)
  const messages = await getMessages()
  const lang = LOCALE_LANG[locale] ?? 'ru'

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Inline theme-init: force light mode on public pages before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=window.location.pathname||'/';if(/^\\/(en|ru|ky)\\/b2b(\\/|$)/.test(p))return;var r=document.documentElement;r.classList.remove('dark');r.classList.add('light');r.style.colorScheme='light'})();`,
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
        <NextIntlClientProvider messages={messages} locale={locale}>
          <LandingOnlyEffects />
          <ConditionalHeader />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
