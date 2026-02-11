import { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'

type Props = { params: { locale: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  const t = await getTranslations({ locale, namespace: 'privacyPage' })
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

export default async function PrivacyPage({ params }: Props) {
  const { locale } = params
  setRequestLocale(locale)
  const t = await getTranslations('privacyPage')

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
          <p className="text-sm text-gray-500 mt-4">{t('lastUpdated')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="h-6 w-6 text-primary-600 mr-3" />
            {t('securityPromise')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <Lock className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('hipaaTitle')}</h3>
              <p className="text-gray-600 text-sm">{t('hipaaDesc')}</p>
            </div>
            <div className="text-center p-6 bg-secondary-50 rounded-xl">
              <Eye className="h-8 w-8 text-secondary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('encryptionTitle')}</h3>
              <p className="text-gray-600 text-sm">{t('encryptionDesc')}</p>
            </div>
            <div className="text-center p-6 bg-gentle-50 rounded-xl">
              <Database className="h-8 w-8 text-gentle-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">{t('controlsTitle')}</h3>
              <p className="text-gray-600 text-sm">{t('controlsDesc')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section1Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('personalInfoTitle')}
                  </h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>{t('personalInfo1')}</li>
                    <li>{t('personalInfo2')}</li>
                    <li>{t('personalInfo3')}</li>
                    <li>{t('personalInfo4')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('usageInfoTitle')}
                  </h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>{t('usageInfo1')}</li>
                    <li>{t('usageInfo2')}</li>
                    <li>{t('usageInfo3')}</li>
                    <li>{t('usageInfo4')}</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section2Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>{t('use1Label')}</strong> {t('use1Text')}
                  </li>
                  <li>
                    <strong>{t('use2Label')}</strong> {t('use2Text')}
                  </li>
                  <li>
                    <strong>{t('use3Label')}</strong> {t('use3Text')}
                  </li>
                  <li>
                    <strong>{t('use4Label')}</strong> {t('use4Text')}
                  </li>
                  <li>
                    <strong>{t('use5Label')}</strong> {t('use5Text')}
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section3Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('securityMeasuresTitle')}
                  </h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>{t('security1')}</li>
                    <li>{t('security2')}</li>
                    <li>{t('security3')}</li>
                    <li>{t('security4')}</li>
                    <li>{t('security5')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('retentionTitle')}
                  </h3>
                  <p>{t('retentionText')}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section4Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>{t('right1Label')}</strong> {t('right1Text')}
                  </li>
                  <li>
                    <strong>{t('right2Label')}</strong> {t('right2Text')}
                  </li>
                  <li>
                    <strong>{t('right3Label')}</strong> {t('right3Text')}
                  </li>
                  <li>
                    <strong>{t('right4Label')}</strong> {t('right4Text')}
                  </li>
                  <li>
                    <strong>{t('right5Label')}</strong> {t('right5Text')}
                  </li>
                  <li>
                    <strong>{t('right6Label')}</strong> {t('right6Text')}
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section5Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <p>{t('childrenIntro')}</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>{t('children1')}</li>
                  <li>{t('children2')}</li>
                  <li>{t('children3')}</li>
                  <li>{t('children4')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section6Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <p>{t('thirdParty1')}</p>
                <p>{t('thirdParty2')}</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section7Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <p>{t('changesText')}</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('section8Title')}</h2>
              <div className="space-y-4 text-gray-600">
                <p>{t('contactIntro')}</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p>
                    <strong>{t('email')}</strong> tilek.dzenisev@gmail.com
                  </p>
                  <p>
                    <strong>{t('support')}</strong> tilek.dzenisev@gmail.com
                  </p>
                  <p>
                    <strong>{t('address')}</strong> Manavault Studio
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/help"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Shield className="h-5 w-5 mr-2" />
              {t('helpCenter')}
            </Link>
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
