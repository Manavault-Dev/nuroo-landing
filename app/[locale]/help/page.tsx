import { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, MessageCircle, Mail, Clock } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'

type Props = { params: { locale: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  const t = await getTranslations({ locale, namespace: 'helpPage' })
  return {
    title: `${t('title')} - Nuroo`,
    description: t('subtitle'),
    openGraph: {
      title: `${t('title')} - Nuroo`,
      description: t('subtitle'),
      type: 'website',
      locale: locale === 'ru' ? 'ru_RU' : locale === 'ky' ? 'ky_KG' : 'en_US',
    },
  }
}

export default async function HelpPage({ params }: Props) {
  const { locale } = params
  setRequestLocale(locale)
  const t = await getTranslations('helpPage')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gentle-50 via-white to-primary-50">
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-primary-600" />
              <span className="text-gray-600 hover:text-primary-600 transition-colors">
                {t('backToHome')}
              </span>
            </Link>
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="Nuroo" className="h-8 w-8" />
              <span className="text-xl font-bold text-primary-600">Nuroo</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">{t('title')}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <MessageCircle className="h-6 w-6 text-primary-600 mr-3" />
            {t('contactSupport')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <Mail className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('emailSupport')}</h3>
              <p className="text-gray-600 text-sm mb-3">{t('emailSupportDesc')}</p>
              <a
                href="mailto:tilek.dzenisev@gmail.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                tilek.dzenisev@gmail.com
              </a>
            </div>
            <div className="text-center p-6 bg-secondary-50 rounded-xl">
              <MessageCircle className="h-8 w-8 text-secondary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('nurooAiChat')}</h3>
              <p className="text-gray-600 text-sm mb-3">{t('nurooAiChatDesc')}</p>
              <span className="text-secondary-600 font-medium">{t('availableInApp')}</span>
            </div>
            <div className="text-center p-6 bg-gentle-50 rounded-xl">
              <Clock className="h-8 w-8 text-gentle-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('responseTime')}</h3>
              <p className="text-gray-600 text-sm mb-3">{t('responseTimeDesc')}</p>
              <span className="text-gentle-600 font-medium">{t('within24Hours')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{t('faqTitle')}</h2>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq1Question')}</h3>
              <p className="text-gray-600">{t('faq1Answer')}</p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq2Question')}</h3>
              <p className="text-gray-600">{t('faq2Answer')}</p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq3Question')}</h3>
              <p className="text-gray-600">{t('faq3Answer')}</p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq4Question')}</h3>
              <p className="text-gray-600">{t('faq4Answer')}</p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq5Question')}</h3>
              <p className="text-gray-600">{t('faq5Answer')}</p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq6Question')}</h3>
              <p className="text-gray-600">{t('faq6Answer')}</p>
            </div>

            <div className="pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('faq7Question')}</h3>
              <p className="text-gray-600">{t('faq7Answer')}</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('stillNeedHelp')}</h2>
          <p className="text-gray-600 mb-6">{t('stillNeedHelpDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:tilek.dzenisev@gmail.com"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Mail className="h-5 w-5 mr-2" />
              {t('contactSupportBtn')}
            </a>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              {t('backToHomeBtn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
