'use client'

import { useState, useEffect } from 'react'
import { Star, Quote } from 'lucide-react'

export function Testimonials() {
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

    const element = document.getElementById('testimonials-section')
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  // Placeholder for future testimonials - will be added when we have real user feedback
  const testimonials = []

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ))
  }

  return (
    <section id="testimonials-section" className="section-padding bg-white dark:bg-gray-900">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div
            className={`inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-sm font-medium mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Star className="w-4 h-4 mr-2" />
            Loved by Families
          </div>

          <h2
            className={`text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Stories from
            <span className="gradient-text ml-3">Our Community</span>
          </h2>

          <p
            className={`text-xl text-gray-600 dark:text-gray-300 mb-12 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            We're building something special. Join our beta program to be among the first to
            experience Nuroo.
          </p>
        </div>

        {/* Stats */}
        <div
          className={`mt-16 text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 rounded-3xl p-8 border border-primary-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                  Available
                </div>
                <div className="text-primary-600 dark:text-primary-400">App Store</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                  AI-Powered
                </div>
                <div className="text-primary-600 dark:text-primary-400">Technology</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-white">
                  Join Now
                </div>
                <div className="text-primary-600 dark:text-primary-400">Early Access</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
