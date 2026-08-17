import { getTranslations } from 'next-intl/server'
import { Search, Star, CalendarCheck, RefreshCw } from 'lucide-react'

const ICONS = [Search, Star, CalendarCheck, RefreshCw]

export async function HowItWorks() {
  const t = await getTranslations('landing.howItWorks')

  return (
    <section className="py-20 md:py-28 bg-white dark:bg-gray-950">
      <div className="container-custom">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-3">
            {t('eyebrow')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-base md:text-lg">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {([1, 2, 3, 4] as const).map((step) => {
            const Icon = ICONS[step - 1]
            return (
              <div key={step} className="relative">
                {step < 4 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%-16px)] w-8 border-t-2 border-dashed border-gray-200 dark:border-gray-700 z-10" />
                )}
                <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 h-full">
                  <div className="w-14 h-14 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-800 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-2">
                    {t('stepLabel')} {step}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">
                    {t(`step${step}Title`)}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t(`step${step}Desc`)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
