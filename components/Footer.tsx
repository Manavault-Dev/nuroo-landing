'use client'

import Link from 'next/link'
import { Heart, Mail, Phone, MapPin, Linkedin, Instagram, ArrowUp } from 'lucide-react'
import { useState, useEffect } from 'react'

export function Footer() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const footerLinks = {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'How It Works', href: '#solution' },
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Contact Us', href: '/contact' },
    ],
  }

  const socialLinks = [
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/nuroo-ai/', icon: Linkedin },
    { name: 'Instagram', href: 'https://www.instagram.com/nuroo.global/', icon: Instagram },
  ]

  return (
    <footer className="bg-primary-600 text-white relative">
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-12 h-12 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}

      <div className="container-custom">
        {/* Main Footer Content */}
        <div className="py-6 md:py-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="Nuroo Logo" className="w-6 h-6 md:w-8 md:h-8 rounded-lg" />
              <span className="text-white font-semibold text-base md:text-lg">Nuroo</span>
            </Link>

            <p className="text-white/80 text-xs md:text-sm text-center md:text-left">
              AI-powered support for children with special needs
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              <Link
                href="#features"
                className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
              >
                Features
              </Link>
              <Link
                href="#solution-section"
                className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/help"
                className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
              >
                Help
              </Link>
              <Link
                href="/privacy"
                className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
              >
                Privacy
              </Link>
              <a
                href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white text-xs md:text-sm transition-colors"
              >
                Download App
              </a>
            </div>

            {/* Social Media Icons */}
            <div className="flex items-center space-x-2 md:space-x-3">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 md:w-8 md:h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                    aria-label={social.name}
                  >
                    <Icon className="w-3 h-3 md:w-4 md:h-4" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Copyright Line */}
          <div className="border-t border-white/20 mt-4 md:mt-6 pt-4 md:pt-6">
            <div className="text-center text-white/80 text-xs md:text-sm w-full">
              © 2025 Created by Manavault Studio
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
