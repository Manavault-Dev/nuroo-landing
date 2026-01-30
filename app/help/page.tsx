import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Mail, Phone, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Help Center - Nuroo',
  description:
    'Get help with Nuroo. Find answers to frequently asked questions, contact support, and learn how to use our AI-powered platform for children with special needs.',
  keywords: 'Nuroo help, support, FAQ, special needs, AI therapy, assistance',
  openGraph: {
    title: 'Help Center - Nuroo',
    description:
      'Get help with Nuroo. Find answers to frequently asked questions, contact support, and learn how to use our AI-powered platform.',
    type: 'website',
    locale: 'en_US',
    url: 'https://usenuroo.com/help',
    siteName: 'Nuroo',
    images: [
      {
        url: '/mother-and-child.png',
        width: 1200,
        height: 630,
        alt: 'Nuroo Help Center - Support for families',
      },
    ],
  },
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gentle-50 via-white to-primary-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-primary-600" />
              <span className="text-gray-600 hover:text-primary-600 transition-colors">
                Back to Home
              </span>
            </Link>
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="Nuroo" className="h-8 w-8" />
              <span className="text-xl font-bold text-primary-600">Nuroo</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Help Center</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions and get the support you need for your Nuroo journey.
          </p>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <MessageCircle className="h-6 w-6 text-primary-600 mr-3" />
            Contact Support
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <Mail className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Email Support</h3>
              <p className="text-gray-600 text-sm mb-3">Get detailed help via email</p>
              <a
                href="mailto:support@usenuroo.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                tilek.dzenisev@gmail.com
              </a>
            </div>
            <div className="text-center p-6 bg-secondary-50 rounded-xl">
              <MessageCircle className="h-8 w-8 text-secondary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">NurooAi Chat</h3>
              <p className="text-gray-600 text-sm mb-3">24/7 AI-powered assistance</p>
              <span className="text-secondary-600 font-medium">Available in app</span>
            </div>
            <div className="text-center p-6 bg-gentle-50 rounded-xl">
              <Clock className="h-8 w-8 text-gentle-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Response Time</h3>
              <p className="text-gray-600 text-sm mb-3">We aim to respond quickly</p>
              <span className="text-gentle-600 font-medium">Within 24 hours</span>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What is Nuroo?</h3>
              <p className="text-gray-600">
                Nuroo is an AI-powered platform designed to support children with special needs
                through personalized exercises, NurooAi chat support, and real-time progress
                tracking. Our goal is to make therapy accessible and affordable for every family.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How does NurooAi work?</h3>
              <p className="text-gray-600">
                NurooAi is our AI-powered chat assistant that provides 24/7 support specifically
                designed for special needs care. It offers instant responses, personalized guidance,
                and is always available to help parents and caregivers.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                When will Nuroo be available?
              </h3>
              <p className="text-gray-600">
                Nuroo is launching in 2025 and will be available on both the App Store and Google
                Play. We're currently in development and working hard to bring you the best possible
                experience.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Is my child's data safe?</h3>
              <p className="text-gray-600">
                Yes, absolutely. We use enterprise-grade security with HIPAA-compliant encryption
                and privacy controls. Your child's data is protected with end-to-end encryption and
                we never share personal information without consent.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What types of special needs does Nuroo support?
              </h3>
              <p className="text-gray-600">
                Nuroo is designed to support children with various special needs including autism,
                ADHD, learning disabilities, developmental delays, and other conditions. Our AI
                adapts to each child's unique needs and learning style.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                How much will Nuroo cost?
              </h3>
              <p className="text-gray-600">
                We're committed to making Nuroo affordable and accessible. Pricing details will be
                announced closer to our launch. We're working to ensure that quality support doesn't
                come with a high price tag.
              </p>
            </div>

            <div className="pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I use Nuroo alongside traditional therapy?
              </h3>
              <p className="text-gray-600">
                Yes! Nuroo is designed to complement traditional therapy, not replace it. Our
                platform can be used alongside existing therapy sessions to provide additional
                support and practice opportunities at home.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Still Need Help?</h2>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? We're here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:tilek.dzenisev@gmail.com"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Mail className="h-5 w-5 mr-2" />
              Contact Support
            </a>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
