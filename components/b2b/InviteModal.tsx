'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Mail } from 'lucide-react'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  inviteCode: string
  orgId?: string
}

export function InviteModal({ isOpen, onClose, inviteCode }: InviteModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  if (!isOpen) return null

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (clipboardError) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
      } catch {
        alert('Please copy manually: ' + text)
      }
      document.body.removeChild(textarea)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-primary-600" />
            <h3 className="text-xl font-bold text-gray-900">Invite Parent</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          Share this invite code with parents to connect their child to your practice.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invite Code</label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3">
              <code className="text-2xl font-bold text-gray-900 tracking-wider">{inviteCode}</code>
            </div>
            <button
              onClick={() => handleCopy(inviteCode)}
              className="flex items-center justify-center w-12 h-12 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-colors"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

