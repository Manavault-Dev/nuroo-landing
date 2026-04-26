'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { translations } from './translations'
import { TranslationSet } from './types'
import { useAssistant } from './useAssistant'
import { ChipRow, MessageBubble, ContextBar } from './ui'
import { Mic, MicOff, X, Loader2, MessageCircle, Send, Bot, HelpCircle } from 'lucide-react'

interface AssistantProps {
  orgId: string
  /** App locale from `useLocale()` — keeps assistant copy in sync on first paint (no post-mount pathname race). */
  locale: string
  onCommandExecuted?: () => void
}

function translationForLocale(locale: string): TranslationSet {
  if (locale === 'ru' || locale === 'ky' || locale === 'en') {
    return translations[locale]
  }
  return translations.en
}

export default function Assistant({ orgId, locale, onCommandExecuted }: AssistantProps) {
  const t = useMemo(() => translationForLocale(locale), [locale])
  const [isOpen, setIsOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'error'>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const handleInputRef = useRef<(text: string) => Promise<void>>(async () => {})
  /** One auto `show_reports` per panel open when the thread is empty (avoids duplicate if `handleChipAction` identity changes mid-bootstrap). */
  const didBootstrapReportsRef = useRef(false)

  const {
    messages,
    inputText,
    setInputText,
    isProcessing,
    isClarifying,
    sessionCtx,
    messagesEndRef,
    handleInput,
    handleChipAction,
    handleSuggestionAction,
    handleFormSubmit,
    handleConfirm,
    handleCancel,
  } = useAssistant(orgId, t, onCommandExecuted)

  useEffect(() => {
    handleInputRef.current = handleInput
  }, [handleInput])

  useEffect(() => {
    if (!isOpen) {
      didBootstrapReportsRef.current = false
      return
    }
    if (messages.length === 0 && !didBootstrapReportsRef.current) {
      didBootstrapReportsRef.current = true
      handleChipAction('show_reports')
    }
  }, [isOpen, messages.length, handleChipAction])

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition
    if (!SR) return
    recognitionRef.current = new SR()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = locale === 'ru' || locale === 'ky' ? 'ru-RU' : 'en-US'
    recognitionRef.current.onresult = (ev: SpeechRecognitionEvent) => {
      const last = ev.results[ev.results.length - 1]
      if (last.isFinal) handleInputRef.current(last[0].transcript)
    }
    recognitionRef.current.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error !== 'no-speech') {
        setVoiceState('error')
        setVoiceError(t.noSupport)
      }
    }
    recognitionRef.current.onend = () => setVoiceState('idle')
  }, [locale, t.noSupport])

  const startListening = () => {
    if (!recognitionRef.current) {
      setVoiceError(t.noSupport)
      return
    }
    setVoiceError(null)
    setVoiceState('listening')
    try {
      recognitionRef.current.start()
    } catch {
      setVoiceState('error')
      setVoiceError(t.noSupport)
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setVoiceState('idle')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 shadow-lg hover:bg-primary-700 transition-all hover:scale-105"
        aria-label={t.open}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 flex flex-col"
          style={{ height: '580px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <Bot className="h-4 w-4 text-primary-600" />
              </div>
              <span className="font-semibold text-gray-900">{t.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`rounded-lg p-1.5 transition-colors ${
                  showHelp
                    ? 'bg-primary-100 text-primary-600'
                    : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                }`}
                title={t.help}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowHelp(false)
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Help panel */}
          {showHelp && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-3 shrink-0">
              <p className="text-xs font-semibold text-amber-800 mb-2">{t.help}</p>
              <div className="space-y-1.5">
                {t.helpContent.map((item, i) => (
                  <div key={i}>
                    <span className="text-xs font-medium text-gray-700">{item.cmd}: </span>
                    <span className="text-xs text-gray-500 italic">
                      &ldquo;{item.example}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context bar */}
          <ContextBar
            groupName={sessionCtx.lastGroupName}
            childNames={sessionCtx.lastChildNames ?? sessionCtx.lastResultChildren}
          />

          {/* Voice error */}
          {voiceError && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 shrink-0">
              <p className="text-xs text-red-700">{voiceError}</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 text-center pt-2">{t.howCanHelp}</p>
                <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
                  {t.chips.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleChipAction(chip.actionType)}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                        {
                          primary:
                            'bg-primary-50 border-primary-200 hover:bg-primary-100 text-primary-700',
                          blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700',
                          indigo:
                            'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-700',
                          amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700',
                          violet:
                            'bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-700',
                          rose: 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700',
                          green: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700',
                          teal: 'bg-teal-50 border-teal-200 hover:bg-teal-100 text-teal-700',
                        }[chip.color] || ''
                      }`}
                    >
                      <span className="text-xs font-semibold">{chip.label}</span>
                      <span className="text-xs opacity-60 leading-snug line-clamp-2">
                        {t.helpContent[i]?.example}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  t={t}
                  onFormSubmit={(action) => handleFormSubmit(msg.id, action)}
                  onFormCancel={() => handleCancel(msg.id)}
                  onConfirm={() => {
                    const action = msg.pending?.action
                    if (action) handleConfirm(msg.id, action)
                  }}
                  onCancel={() => handleCancel(msg.id)}
                  onSuggestion={handleSuggestionAction}
                />
              ))
            )}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg ml-8">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">{t.thinking}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 space-y-2 shrink-0 bg-gray-50">
            {!isClarifying && <ChipRow chips={t.chips} onChip={handleChipAction} />}
            {isClarifying && (
              <p className="text-xs text-primary-600 font-medium px-1">↩ Reply to continue</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleInput(inputText)
              }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isClarifying ? '...' : t.type}
                  disabled={isProcessing}
                  className={`w-full px-4 py-2.5 pr-11 border rounded-full text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    isClarifying ? 'border-primary-300' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => (voiceState === 'listening' ? stopListening() : startListening())}
                  disabled={isProcessing}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                    voiceState === 'listening'
                      ? 'text-red-600 bg-red-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {voiceState === 'listening' ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
