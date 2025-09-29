'use client'

import Link from 'next/link'
import { 
  Heart, 
  Mail, 
  Phone, 
  MapPin, 
  Linkedin,
  ArrowUp
} from 'lucide-react'
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
      { name: 'Waitlist', href: '#waitlist' },
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Contact Us', href: '/contact' },
    ]
  }

  const socialLinks = [
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/nuroo-ai/', icon: Linkedin },
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
        <div className="py-8">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <img
                src="/logo.png"
                alt="Nuroo Logo"
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-white font-semibold text-lg">Nuroo</span>
            </Link>
            
            <p className="text-white/80 text-sm hidden md:block">
              AI-powered support for children with special needs
            </p>
            
            <Link href="#features" className="text-white/80 hover:text-white text-sm transition-colors">
              Features
            </Link>
            <Link href="#solution" className="text-white/80 hover:text-white text-sm transition-colors">
              How It Works
            </Link>
            <div className="text-white/50 text-sm">
              Coming Soon
            </div>
            
            {/* Social Media Icons */}
            <div className="flex items-center space-x-3">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                    aria-label={social.name}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                )
              })}
            </div>
          </div>
          
          {/* Copyright Line */}
          <div className="border-t border-white/20 mt-6 pt-6">
            <div className="text-center text-white/80 text-sm w-full">
              © 2025 Created by Manavault Studio
            </div>
          </div>
        </div>


      </div>
    </footer>
  )
}
