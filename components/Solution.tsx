'use client'

import { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

export function Solution() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    const element = document.getElementById('solution-section')
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  const stats = [
    { number: '90%', label: 'Parent Satisfaction' },
    { number: '3x', label: 'Faster Progress' },
    { number: '85%', label: 'Cost Reduction' },
    { number: '24/7', label: 'Available Support' },
  ]

  return (
    <section id="solution-section" className="section-padding bg-white dark:bg-gray-900">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center mb-12 md:mb-16">
          <div
            className={`inline-flex items-center px-3 md:px-4 py-2 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs md:text-sm font-medium mb-6 md:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            The Solution
          </div>

          <h2
            className={`text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Introducing
            <span className="gradient-text ml-2 md:ml-3">Nuroo</span>
          </h2>

          <p
            className={`text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-8 md:mb-12 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            The first AI-powered platform that brings professional support for children with special
            needs directly to your home, making therapy accessible, affordable, and effective for
            every child.
          </p>
        </div>

        {/* Mobile App Preview */}
        <div
          className={`mb-16 md:mb-20 transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* App Screenshots Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12 md:mb-16">
            {/* Welcome Screen */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/welcome.png"
                    alt="Nuroo Welcome Screen - Personalized onboarding for special needs support"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  Welcome & Setup
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  Personalized onboarding experience
                </p>
              </div>
            </div>

            {/* Progress Screen */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/progress.png"
                    alt="Nuroo Progress Dashboard - Track your child's development journey with AI-powered support"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-secondary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  Progress Tracking
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  Real-time development insights
                </p>
              </div>
            </div>

            {/* AskNuroo Screen */}
            <div className="relative group sm:col-span-2 lg:col-span-1">
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/asknuroo-screen.png"
                    alt="NurooAi Chat Support - AI-powered assistance for special needs guidance"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-accent-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  NurooAi Chat
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  AI-powered support 24/7
                </p>
              </div>
            </div>
          </div>

          {/* Features Description */}
          <div className="text-center max-w-4xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">
              Everything Your Child Needs,
              <span className="gradient-text">All in One App</span>
            </h3>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 mb-6 md:mb-8 leading-relaxed">
              Nuroo combines the power of artificial intelligence with personalized support to
              create a comprehensive platform for children with special needs that works around your
              schedule.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    Personalized Learning
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    AI adapts to your child's unique learning style and pace
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    NurooAi Support
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    AI-powered chat assistance available 24/7 for guidance and support
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    Real-time Progress
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    Track milestones and celebrate achievements together
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className={`bg-gradient-to-r from-primary-100 to-secondary-100 rounded-2xl md:rounded-3xl p-6 md:p-8 border border-primary-200 transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2">
                  {stat.number}
                </div>
                <div className="text-primary-600 text-xs md:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
