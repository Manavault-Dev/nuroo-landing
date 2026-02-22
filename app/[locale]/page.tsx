import { Hero } from '@/components/Hero'
import { Problem } from '@/components/Problem'
import { Solution } from '@/components/Solution'
import { Platform } from '@/components/Platform'
import { Pricing } from '@/components/Pricing'
import { Features } from '@/components/Features'
import { Testimonials } from '@/components/Testimonials'
import { Footer } from '@/components/Footer'
import { setRequestLocale } from 'next-intl/server'

type Props = { params: { locale: string } }

export default function Home({ params }: Props) {
  setRequestLocale(params.locale)
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 min-w-0 overflow-x-hidden">
      <Hero />
      <Problem />
      <Solution />
      <Platform />
      <Pricing />
      <Features />
      <Testimonials />
      <Footer />
    </div>
  )
}
