import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy - Nuroo',
  description: 'Learn how Nuroo protects your privacy and handles your data. Our comprehensive privacy policy covers data collection, usage, and security measures.',
  keywords: 'Nuroo privacy policy, data protection, privacy, security, HIPAA, children privacy',
  openGraph: {
    title: 'Privacy Policy - Nuroo',
    description: 'Learn how Nuroo protects your privacy and handles your data with enterprise-grade security.',
    type: 'website',
    locale: 'en_US',
    url: 'https://usenuroo.com/privacy',
    siteName: 'Nuroo',
    images: [
      {
        url: '/mother-and-child.png',
        width: 1200,
        height: 630,
        alt: 'Nuroo Privacy Policy - Protecting your family',
      },
    ],
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gentle-50 via-white to-primary-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-primary-600" />
              <span className="text-gray-600 hover:text-primary-600 transition-colors">Back to Home</span>
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your privacy and your child's safety are our top priorities. Learn how we protect your data.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Last updated: January 2025
          </p>
        </div>

        {/* Security Highlights */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="h-6 w-6 text-primary-600 mr-3" />
            Our Security Promise
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-primary-50 rounded-xl">
              <Lock className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">HIPAA Compliant</h3>
              <p className="text-gray-600 text-sm">Enterprise-grade security standards</p>
            </div>
            <div className="text-center p-6 bg-secondary-50 rounded-xl">
              <Eye className="h-8 w-8 text-secondary-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">End-to-End Encryption</h3>
              <p className="text-gray-600 text-sm">Your data is protected in transit and at rest</p>
            </div>
            <div className="text-center p-6 bg-gentle-50 rounded-xl">
              <Database className="h-8 w-8 text-gentle-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Privacy Controls</h3>
              <p className="text-gray-600 text-sm">You control what data is shared</p>
            </div>
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="prose prose-lg max-w-none">
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Personal Information</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Child's name, age, and developmental information (with parent consent)</li>
                    <li>Parent/caregiver contact information</li>
                    <li>Progress tracking data and exercise results</li>
                    <li>Communication preferences and settings</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Usage Information</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>App usage patterns and feature interactions</li>
                    <li>NurooAi chat conversations (anonymized for improvement)</li>
                    <li>Device information and technical logs</li>
                    <li>Performance metrics and error reports</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
              <div className="space-y-4 text-gray-600">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Personalized Learning:</strong> Create customized exercises and activities for your child</li>
                  <li><strong>Progress Tracking:</strong> Monitor development and provide insights to parents</li>
                  <li><strong>AI Improvement:</strong> Enhance NurooAi responses and platform features</li>
                  <li><strong>Support Services:</strong> Provide customer support and technical assistance</li>
                  <li><strong>Safety:</strong> Ensure platform security and prevent misuse</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data Protection & Security</h2>
              <div className="space-y-4 text-gray-600">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Security Measures</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>End-to-end encryption for all data transmission</li>
                    <li>Secure cloud storage with industry-standard protection</li>
                    <li>Regular security audits and penetration testing</li>
                    <li>Access controls and authentication protocols</li>
                    <li>HIPAA-compliant infrastructure and processes</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Retention</h3>
                  <p>We retain your data only as long as necessary to provide our services and comply with legal obligations. You can request data deletion at any time.</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Your Rights & Choices</h2>
              <div className="space-y-4 text-gray-600">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your data</li>
                  <li><strong>Portability:</strong> Export your data in a portable format</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from communications</li>
                  <li><strong>Consent Withdrawal:</strong> Withdraw consent for data processing</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Children's Privacy</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Nuroo is designed for children with special needs, and we take extra care to protect their privacy. 
                  We never collect personal information from children without explicit parental consent.
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>All child data collection requires parental consent</li>
                  <li>Parents can review and delete their child's data at any time</li>
                  <li>We never share children's personal information with third parties</li>
                  <li>Child data is used only for educational and therapeutic purposes</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Third-Party Services</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  We may use third-party services for analytics, cloud storage, and communication. 
                  All third-party providers are carefully vetted and required to meet our security standards.
                </p>
                <p>
                  We never sell your personal information to third parties for marketing purposes.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Changes to This Policy</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any significant changes 
                  via email or through the app. Continued use of our services after changes constitutes acceptance.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Contact Us</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Email:</strong> privacy@usenuroo.com</p>
                  <p><strong>Support:</strong> support@usenuroo.com</p>
                  <p><strong>Address:</strong> Manavault Studio</p>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/help" 
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Shield className="h-5 w-5 mr-2" />
              Help Center
            </Link>
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
