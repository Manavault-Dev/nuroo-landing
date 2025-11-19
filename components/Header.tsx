'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { clsx } from 'clsx'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])


  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      )}
    >
      <nav className="container-custom">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl md:text-2xl font-bold gradient-text"
          >
            <img 
              src="/logo.png" 
              alt="Nuroo Logo" 
              className="w-6 h-6 md:w-8 md:h-8 rounded-lg"
            />
            <span>Nuroo</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="#features"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              Features
            </Link>
            <Link
              href="#solution-section"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              How It Works
            </Link>
            <Link
              href="/help"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              Help
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              Privacy
            </Link>
            <a
              href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
            >
              Download App
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-4 w-4 md:h-5 md:w-5" /> : <Menu className="h-4 w-4 md:h-5 md:w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white rounded-lg mt-2 shadow-lg border border-gray-200">
              <Link
                href="#features"
                className="block px-3 py-2 text-gray-600 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#solution-section"
                className="block px-3 py-2 text-gray-600 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="/help"
                className="block px-3 py-2 text-gray-600 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Help
              </Link>
              <Link
                href="/privacy"
                className="block px-3 py-2 text-gray-600 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Privacy
              </Link>
              <a
                href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
                target="_blank"
                rel="noopener noreferrer"
                className="block mx-3 my-2 btn-primary text-center text-sm py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Download App
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
