'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { parseIntent } from './nlp'
import { translations } from './translations'
import { ActionExecutor } from './executor'
import { Message, ParsedAction, ActionType, TranslationSet } from './types'
import { ChipRow, MessageBubble } from './ui'
import {
  Mic,
  MicOff,
  X,
  Loader2,
  MessageCircle,
  Volume2,
  VolumeX,
  Send,
  Bot,
  User,
  Keyboard,
  HelpCircle,
} from 'lucide-react'

interface AssistantProps {
  orgId: string
  onCommandExecuted?: () => void
}

export default function Assistant({ orgId, onCommandExecuted }: AssistantProps) {
  const [locale, setLocale] = useState<string>('en')
  const [t, setT] = useState<TranslationSet>(translations.en)

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'chat' | 'voice'>('chat')
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'error'>('idle')
  const [transcript, setTranscript] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [speakingEnabled, setSpeakingEnabled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const handleInputRef = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/ru')) {
      setLocale('ru')
      setT(translations.ru)
    } else if (path.startsWith('/ky')) {
      setLocale('ky')
      setT(translations.ky)
    } else {
      setLocale('en')
      setT(translations.en)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      setTranscript(last[0].transcript)
      if (last.isFinal) handleInputRef.current(last[0].transcript)
    }

    recognitionRef.current.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error !== 'no-speech') {
        setVoiceState('error')
        setVoiceError(t.noSupport)
      }
    }

    recognitionRef.current.onend = () => setVoiceState('idle')
    synthRef.current = window.speechSynthesis
  }, [locale, t.noSupport])

  const speak = useCallback(
    (text: string) => {
      if (!speakingEnabled || !synthRef.current) return
      synthRef.current.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = locale === 'ru' || locale === 'ky' ? 'ru-RU' : 'en-US'
      u.rate = 0.9
      synthRef.current.speak(u)
    },
    [speakingEnabled, locale]
  )

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>) => {
    const full: Message = {
      ...msg,
      id: `${Date.now()}${Math.random()}`,
      timestamp: new Date(),
    }
    setMessages((p) => [...p, full])
    return full.id
  }, [])

  const updateMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((p) => p.map((m) => (m.id !== id ? m : { ...m, ...patch })))
  }, [])

  const executeAction = useCallback(
    async (action: ParsedAction, msgId: string) => {
      updateMessage(msgId, { status: 'executing', pending: undefined, form: undefined })

      const executor = new ActionExecutor(orgId, t, onCommandExecuted)
      try {
        const result = await executor.execute(action)
        updateMessage(msgId, { content: result.content, status: 'done' })
        if (result.speakText) speak(result.speakText)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        updateMessage(msgId, { content: msg, status: 'done' })
        speak(msg)
      }
    },
    [orgId, t, onCommandExecuted, updateMessage, speak]
  )

  const handleInput = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return

      addMessage({ role: 'user', content: text })
      setInputText('')
      setIsProcessing(true)

      const action = parseIntent(text)

      if (action.type === 'unknown') {
        addMessage({ role: 'assistant', content: t.unknownCmd, status: 'done' })
      } else if (action.type === 'list_groups' || action.type === 'list_children') {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        await executeAction(action, mid)
      } else {
        addMessage({ role: 'assistant', content: '', pending: { action }, status: 'confirming' })
      }

      setIsProcessing(false)
    },
    [isProcessing, t, addMessage, executeAction]
  )

  useEffect(() => {
    handleInputRef.current = handleInput
  }, [handleInput])

  const handleFormSubmit = useCallback(
    (msgId: string, action: ParsedAction) => {
      updateMessage(msgId, {
        form: undefined,
        pending: { action },
        status: 'confirming',
        content: '',
      })
    },
    [updateMessage]
  )

  const handleConfirm = useCallback(
    async (msgId: string, action: ParsedAction) => executeAction(action, msgId),
    [executeAction]
  )

  const handleCancel = useCallback(
    (msgId: string) =>
      updateMessage(msgId, {
        content: t.cancelled,
        status: 'cancelled',
        pending: undefined,
        form: undefined,
      }),
    [t, updateMessage]
  )

  const handleChipAction = useCallback(
    (actionType: string) => {
      if (actionType === 'list_groups' || actionType === 'list_children') {
        const mid = addMessage({ role: 'assistant', content: '', status: 'executing' })
        executeAction({ type: actionType as ActionType, params: {}, raw: '' }, mid)
        return
      }
      const formConfig = t.forms[actionType]
      if (!formConfig) return

      addMessage({
        role: 'assistant',
        content: '',
        form: { ...formConfig, actionType: actionType as Exclude<ActionType, 'unknown'> },
        status: 'form',
      })
    },
    [t, addMessage, executeAction]
  )

  const startListening = () => {
    if (!recognitionRef.current) {
      setVoiceError(t.noSupport)
      return
    }
    setVoiceError(null)
    setTranscript('')
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
                onClick={() => setMode(mode === 'voice' ? 'chat' : 'voice')}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                {mode === 'voice' ? <Keyboard className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setSpeakingEnabled(!speakingEnabled)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                {speakingEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setMessages([])
                  setShowHelp(false)
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

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

          {mode === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 text-center pt-2">
                      {t.howCanHelp}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
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
                              amber:
                                'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700',
                              violet:
                                'bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-700',
                              rose: 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700',
                              green:
                                'bg-green-50 border-green-200 hover:bg-green-100 text-green-700',
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
                      onConfirm={() => handleConfirm(msg.id, msg.pending!.action)}
                      onCancel={() => handleCancel(msg.id)}
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

              <div className="border-t border-gray-100 p-3 space-y-2 shrink-0 bg-gray-50">
                <ChipRow chips={t.chips} onChip={handleChipAction} />
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleInput(inputText)
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.type}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isProcessing}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
              <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                <Mic className="h-3 w-3" />
                {t.voiceLang}
              </div>
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                  voiceState === 'listening'
                    ? 'animate-pulse bg-red-100 ring-4 ring-red-200'
                    : voiceState === 'error'
                      ? 'bg-red-100'
                      : 'bg-gray-100'
                }`}
              >
                {voiceState === 'listening' ? (
                  <Mic className="h-10 w-10 text-red-600" />
                ) : voiceState === 'error' ? (
                  <MicOff className="h-10 w-10 text-red-600" />
                ) : (
                  <Mic className="h-10 w-10 text-gray-400" />
                )}
              </div>
              {transcript && (
                <p className="text-sm text-center text-gray-700 bg-gray-50 rounded-lg px-3 py-2 max-w-full">
                  &ldquo;{transcript}&rdquo;
                </p>
              )}
              {voiceError && (
                <p className="text-sm text-center text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {voiceError}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {voiceState === 'listening' ? t.listening : t.tapToSpeak}
              </p>
              <button
                onClick={voiceState === 'listening' ? stopListening : startListening}
                className={`flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${
                  voiceState === 'listening'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {voiceState === 'listening' ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    {t.stopListen}
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    {t.startListen}
                  </>
                )}
              </button>
              <ChipRow
                chips={t.chips}
                onChip={(type) => {
                  setMode('chat')
                  handleChipAction(type)
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
