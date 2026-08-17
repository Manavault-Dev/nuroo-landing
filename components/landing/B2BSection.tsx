import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Globe, CalendarDays, Users, BellRing, BarChart3, Share2 } from 'lucide-react'

const FEATURE_ICONS = [Globe, CalendarDays, Users, BellRing, BarChart3, Share2]

export async function B2BSection() {
  const t = await getTranslations('landing.b2b')

  return (
    <section className="py-20 md:py-28 bg-gray-950 dark:bg-gray-950 text-white">
      <div className="container-custom">
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-teal-400 mb-3">
            {t('eyebrow')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl">{t('subtitle')}</p>
          <Link
            href="/b2b/register"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-base transition-colors"
          >
            {t('cta')}
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([1, 2, 3, 4, 5, 6] as const).map((i) => {
            const Icon = FEATURE_ICONS[i - 1]
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-teal-500/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{t(`f${i}Title`)}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{t(`f${i}Desc`)}</p>
              </div>
            )
          })}
        </div>

        {/* Social booking highlight */}
        <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-teal-600/20 to-teal-500/10 border border-teal-500/20">
          <div className="max-w-2xl">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{t('socialTitle')}</h3>
            <p className="text-gray-400 mb-4">{t('socialDesc')}</p>
            <div className="flex flex-wrap gap-2">
              {['Instagram', 'WhatsApp', 'Telegram', 'QR-код'].map((ch) => (
                <span
                  key={ch}
                  className="px-3 py-1 bg-white/10 rounded-full text-sm text-gray-300 font-medium border border-white/10"
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
