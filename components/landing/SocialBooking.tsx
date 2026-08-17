import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, Clock, QrCode } from 'lucide-react'

function SocialIcon({ src, alt, size = 22 }: { src: string; alt: string; size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="flex-shrink-0 relative">
      <Image src={src} alt={alt} width={size} height={size} className="object-contain" />
    </div>
  )
}

// Share channels with real SVG logos
function ShareChannelsMockup() {
  const channels = [
    {
      icon: <SocialIcon src="/instagram.svg" alt="Instagram" size={22} />,
      name: 'Instagram',
      sub: 'Поделиться в сторис',
    },
    {
      icon: <SocialIcon src="/whatsapp.svg" alt="WhatsApp" size={22} />,
      name: 'WhatsApp',
      sub: 'Отправить контактам',
    },
    {
      icon: <SocialIcon src="/telegram.svg" alt="Telegram" size={22} />,
      name: 'Telegram',
      sub: 'Отправить в канал',
    },
    {
      icon: (
        <div className="w-[22px] h-[22px] rounded-[4px] bg-gray-800 flex items-center justify-center">
          <QrCode className="w-3.5 h-3.5 text-white" />
        </div>
      ),
      name: 'QR-код',
      sub: 'Для офлайн-рекламы',
    },
  ]
  return (
    <div className="flex flex-col gap-2 w-full max-w-[190px]">
      {channels.map((c) => (
        <div
          key={c.name}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-teal-300 dark:hover:border-teal-700 transition-colors cursor-default"
        >
          {c.icon}
          <div>
            <div className="text-xs font-semibold text-gray-800 dark:text-white">{c.name}</div>
            <div className="text-[9px] text-gray-400">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export async function SocialBooking() {
  const t = await getTranslations('landing.social')
  return (
    <section className="py-20 lg:py-28 bg-gray-50 dark:bg-gray-900">
      <div className="container-custom">
        {/* Header */}
        <div className="max-w-2xl mb-10">
          <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">
            {t('eyebrow')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {t('title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-5">
            {t('subtitle')}
          </p>
          <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold">
            <Clock className="w-4 h-4" />
            <span>{t('comingSoon')}</span>
          </div>
        </div>

        {/* Flow — full width, horizontal from md (768px gives ~720px, items need ~637px) */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-3 overflow-x-auto pb-2">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {t('step1')}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow p-4 w-[160px]">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3">
                <Image
                  src="/prog-school.png"
                  alt="Программа"
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
              <div className="text-xs font-bold text-gray-900 dark:text-white mb-0.5">
                Подготовка к школе
              </div>
              <div className="text-[10px] text-gray-400 mb-2">5–7 лет · Пн, Ср 17:00</div>
              <div className="text-xs font-semibold text-teal-600 mb-3">3 500 сом / мес</div>
              <button className="w-full py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-semibold">
                {t('createCta')}
              </button>
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 rotate-90 sm:rotate-0 flex-shrink-0" />

          {/* Step 2: Generated promo mockup */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {t('step2')}
            </div>
            <div className="relative w-[140px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
              <Image
                src="/prog-school.png"
                alt="Promo"
                fill
                className="object-cover"
                sizes="140px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="text-white text-[10px] font-bold leading-tight mb-1">
                  Happy Kids
                </div>
                <div className="text-white/90 text-[9px] mb-2">Подготовка к школе · 5–7 лет</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-teal-500 rounded-lg py-1 text-center text-[8px] font-bold text-white">
                    Записаться
                  </div>
                  <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                    <QrCode className="w-3.5 h-3.5 text-gray-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 rotate-90 sm:rotate-0 flex-shrink-0" />

          {/* Step 3: Share channels */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {t('step3')}
            </div>
            <ShareChannelsMockup />
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600 rotate-90 sm:rotate-0 flex-shrink-0" />

          {/* Step 4: Results */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {t('step4')}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow p-4 w-[120px]">
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">56</div>
                <div className="text-[9px] text-gray-400">Переходов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-600">12</div>
                <div className="text-[9px] text-gray-400">Записей</div>
              </div>
              {/* Mini trend line */}
              <svg viewBox="0 0 80 30" className="w-full mt-3" fill="none">
                <polyline
                  points="0,25 15,18 30,20 45,10 60,14 80,4"
                  stroke="#14b8a6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
