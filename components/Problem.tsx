'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, DollarSign, Clock, MapPin, Users, Heart } from 'lucide-react'

export function Problem() {
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

    const element = document.getElementById('problem-section')
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  const problems = [
    {
      icon: <Users className="w-8 h-8 text-red-500" />,
      title: 'Limited Access',
      description: 'Only 1 in 4 children receive the support they need.',
      stat: '75%',
    },
    {
      icon: <DollarSign className="w-8 h-8 text-red-500" />,
      title: 'High Costs',
      description: 'Therapy costs can reach $60,000/year per child.',
      stat: '$60k/year',
    },
    {
      icon: <MapPin className="w-8 h-8 text-red-500" />,
      title: 'Long Wait Times',
      description: 'Wait times for specialists exceed 12 months.',
      stat: '12+ months',
    },
    {
      icon: <Clock className="w-8 h-8 text-red-500" />,
      title: 'Parent Overload',
      description: 'Parents juggle work, family, and multiple appointments.',
      stat: '70% stressed',
    },
  ]

  return (
    <section id="problem-section" className="section-padding bg-gray-50 dark:bg-gray-800">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div
            className={`inline-flex items-center px-4 py-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm font-medium mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            The Challenge
          </div>

          <h2
            className={`text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Special Needs Support is
            <span className="text-red-500 ml-3">Out of Reach</span>
          </h2>

          <p
            className={`text-xl text-gray-600 dark:text-gray-300 mb-12 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            With 240+ million children worldwide living with disabilities and developmental
            challenges, access to quality support remains a significant barrier for most families.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 delay-${(index + 1) * 100} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              } card-hover`}
            >
              <div className="flex items-center justify-center w-16 h-16 bg-red-50 dark:bg-red-900 rounded-2xl mb-6 mx-auto">
                {problem.icon}
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-red-500 mb-2">{problem.stat}</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {problem.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Impact Statement */}
        <div
          className={`mt-16 text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-6">
              <Heart className="w-12 h-12 text-red-500 mr-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">The Real Impact</h3>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              Every day without proper support, children with special needs miss critical
              developmental opportunities. Families face emotional and financial stress while
              struggling to provide the care their children need.
              <strong className="text-gray-900 dark:text-white">
                {' '}
                We believe every child deserves access to quality support, regardless of location or
                financial circumstances.
              </strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
