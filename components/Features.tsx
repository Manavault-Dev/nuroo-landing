'use client'

import { useState, useEffect } from 'react'
import {
  Brain,
  MessageCircle,
  BarChart3,
  Shield,
  Clock,
  Users,
  Smartphone,
  Heart,
  Star,
  Zap,
  Target,
  Award,
} from 'lucide-react'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'

export function Features() {
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

    const element = document.getElementById('features-section')
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  const mainFeatures = [
    {
      icon: <Brain className="w-8 h-8 text-primary-500" />,
      title: 'AI-Powered Learning',
      description:
        "Advanced machine learning algorithms create personalized exercises that adapt to your child's unique learning style and pace.",
      benefits: ['Adaptive difficulty', 'Personalized content', 'Continuous improvement'],
      gradient: 'from-primary-300 to-primary-400',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-secondary-400" />,
      title: 'NurooAi Chat Support',
      description:
        'AI-powered chat assistant designed specifically for special needs care, available 24/7 for guidance and support.',
      benefits: ['Instant responses', 'Personalized guidance', 'Always available'],
      gradient: 'from-secondary-300 to-secondary-400',
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-accent-400" />,
      title: 'Progress Analytics',
      description:
        "Comprehensive tracking and analytics provide insights into your child's development with detailed reports and milestones.",
      benefits: ['Real-time metrics', 'Milestone tracking', 'Detailed reports'],
      gradient: 'from-accent-300 to-accent-400',
    },
    {
      icon: <Shield className="w-8 h-8 text-success-500" />,
      title: 'Privacy & Security',
      description:
        "Enterprise-grade security ensures your child's data is protected with HIPAA-compliant encryption and privacy controls.",
      benefits: ['HIPAA compliant', 'End-to-end encryption', 'Privacy controls'],
      gradient: 'from-success-300 to-success-400',
    },
  ]

  const additionalFeatures = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Flexible Scheduling',
      description: 'Access therapy anytime, anywhere',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Family Support',
      description: 'Resources for the whole family',
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: 'Mobile First',
      description: 'Optimized for all devices',
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: 'Emotional Support',
      description: 'Mental health resources included',
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: 'Gamification',
      description: 'Fun, engaging activities',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Quick Setup',
      description: 'Get started in minutes',
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Goal Setting',
      description: 'Set and track objectives',
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: 'Achievement System',
      description: 'Celebrate milestones together',
    },
  ]

  return (
    <section id="features-section" className="section-padding bg-gray-50 dark:bg-gray-800">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div
            className={`inline-flex items-center px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-sm font-medium mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Star className="w-4 h-4 mr-2" />
            Powerful Features
          </div>

          <h2
            className={`text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Everything You Need to
            <span className="gradient-text ml-3">Support Your Child</span>
          </h2>

          <p
            className={`text-xl text-gray-600 dark:text-gray-300 mb-12 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Nuroo combines cutting-edge AI technology with personalized support to create the most
            comprehensive platform for children with special needs.
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {mainFeatures.map((feature, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-500 delay-${(index + 1) * 100} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              } card-hover group`}
            >
              <div
                className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
              >
                {feature.icon}
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {feature.title}
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                {feature.description}
              </p>

              <div className="space-y-3">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <div key={benefitIndex} className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-2 bg-gradient-to-r ${feature.gradient} rounded-full`}
                    ></div>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Features */}
        <div
          className={`mb-16 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            And Much More...
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 group-hover:bg-primary-100 dark:group-hover:bg-primary-900 transition-colors">
                  <div className="text-primary-500 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  {feature.title}
                </h4>

                <p className="text-sm text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div
          className={`text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 rounded-3xl p-12 border border-primary-200">
            <h3 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white">
              Ready to Transform Your Child's Journey?
            </h3>
            <p className="text-xl mb-8 text-gray-700 dark:text-gray-300">
              Download Nuroo today and start your child's personalized development journey.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <AppStoreButton />
              <GooglePlayButton disabled />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
