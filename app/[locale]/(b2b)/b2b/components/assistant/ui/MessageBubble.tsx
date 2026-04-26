'use client'

import { Bot, User, Loader2 } from 'lucide-react'
import { Message, ParsedAction, TranslationSet } from '../types'
import { ConfirmationCard } from './ConfirmationCard'
import { ActionFeedback } from './ActionFeedback'
import { FormMessage } from '../ui'

interface MessageBubbleProps {
  message: Message
  t: TranslationSet
  onFormSubmit: (action: ParsedAction) => void
  onFormCancel: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function MessageBubble({
  message,
  t,
  onFormSubmit,
  onFormCancel,
  onConfirm,
  onCancel,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isUser ? 'bg-primary-100' : 'bg-gray-100'
          }`}
        >
          {isUser ? (
            <User className="h-3 w-3 text-primary-600" />
          ) : (
            <Bot className="h-3 w-3 text-gray-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {message.status === 'form' && message.form ? (
            <FormMessage
              form={message.form}
              t={t}
              onSubmit={onFormSubmit}
              onCancel={onFormCancel}
            />
          ) : message.status === 'confirming' && message.pending ? (
            <ConfirmationCard
              action={message.pending.action}
              t={t}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ) : message.status === 'executing' ? (
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">{t.thinking}</span>
            </div>
          ) : message.status === 'done' && !isUser && message.content !== t.cancelled ? (
            <ActionFeedback
              type={message.isError ? 'error' : 'success'}
              message={message.content}
            />
          ) : (
            <div
              className={`px-3 py-2 rounded-xl text-sm whitespace-pre-line break-words ${
                isUser
                  ? 'bg-primary-600 text-white'
                  : message.status === 'cancelled'
                    ? 'bg-gray-100 text-gray-400 italic'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {message.content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
