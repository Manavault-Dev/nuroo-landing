'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Star, Users, Heart } from 'lucide-react'
import Link from 'next/link'

export function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gentle-50 via-white to-primary-50 pt-20 md:pt-0">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-4 md:left-10 w-48 md:w-72 h-48 md:h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-30"></div>
        <div className="absolute top-40 right-4 md:right-10 w-48 md:w-72 h-48 md:h-72 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-30" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-8 left-8 md:left-20 w-48 md:w-72 h-48 md:h-72 bg-gentle-300 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-20" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left Column - Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className={`inline-flex items-center px-3 md:px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-xs md:text-sm font-medium mb-6 md:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Star className="w-3 h-3 md:w-4 md:h-4 mr-2" />
              <span className="hidden sm:inline">Coming Soon to App Store & Google Play</span>
              <span className="sm:hidden">Coming Soon</span>
            </div>

            {/* Main Headline */}
            <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <span className="gradient-text">AI-Powered Support</span>
              <br />
              <span className="text-gray-900">for Every Child</span>
              <br />
              <span className="text-gray-600">with Special Needs</span>
            </h1>

            {/* Subtitle */}
            <p className={`text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 md:mb-8 leading-relaxed transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              Personalized AI exercises, chat support, and progress tracking—all from home.
            </p>

            {/* CTA Button */}
            <div className={`flex justify-center lg:justify-start items-center mb-8 md:mb-12 transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="btn-primary text-base md:text-lg px-6 md:px-8 py-3 md:py-4 flex items-center group opacity-75 cursor-not-allowed">
                Coming Soon
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-primary-500 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">240M+</span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight">Children worldwide</p>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Heart className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-secondary-400 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">$60k</span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight">Yearly therapy cost</p>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-primary-400 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">2025</span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight">Launch Year</p>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Image */}
          <div className={`relative transition-all duration-700 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="relative">
              {/* Background decoration */}
              <div className="absolute -top-2 md:-top-4 -right-2 md:-right-4 w-20 md:w-32 h-20 md:h-32 bg-primary-200 rounded-full opacity-20"></div>
              <div className="absolute -bottom-2 md:-bottom-4 -left-2 md:-left-4 w-16 md:w-24 h-16 md:h-24 bg-secondary-200 rounded-full opacity-20"></div>
              
              {/* Main image */}
              <div className="relative bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl">
                <img 
                  src="/mother-and-child.png" 
                  alt="Mother and child using Nuroo app for special needs support" 
                  className="w-full h-auto rounded-xl md:rounded-2xl shadow-lg"
                />
                
                {/* Floating elements */}
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-12 md:w-16 h-12 md:h-16 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <img src="/globe.png" alt="Global reach" className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="absolute -bottom-1 md:-bottom-2 -left-1 md:-left-2 w-10 md:w-12 h-10 md:h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 md:w-6 md:h-6 text-primary-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-400 dark:border-gray-500 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 dark:bg-gray-500 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  )
}
