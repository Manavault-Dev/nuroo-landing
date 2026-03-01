import { Hero } from '@/components/Hero'
import { Solution } from '@/components/Solution'
import { Platform } from '@/components/Platform'
import { Pricing } from '@/components/Pricing'
import { Footer } from '@/components/Footer'
import { setRequestLocale } from 'next-intl/server'

type Props = { params: { locale: string } }

export default function Home({ params }: Props) {
  setRequestLocale(params.locale)
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 min-w-0 overflow-x-hidden">
      <Hero />
      <Solution />
      <Platform />
      <Pricing />
      <Footer />
    </div>
  )
}
