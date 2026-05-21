import OpenAI from 'openai'
import { SYSTEM_PROMPT, VOICE_PROMPT } from './prompt.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY

const ALLOWED_ACTIONS = new Set([
  'create_task',
  'update_task',
  'delete_task',
  'create_group',
  'update_group',
  'delete_group',
  'assign_task',
  'complete_task',
  'get_report',
  'list_children',
  'list_groups',
])

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|prior|above)\s+instructions?/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+(?:a|an)\s+\w+/i,
  /act\s+as\s+(?:a|an)\s+\w+/i,
  /pretend\s+you\s+are/i,
  /\bDAN\b/,
  /jailbreak/i,
  /system\s*prompt/i,
]

function sanitizeMessage(message: string): string {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return '[Message blocked: contains disallowed content]'
    }
  }
  return message.slice(0, 2000)
}

export interface AIRequest {
  message: string
  orgId: string
  userId: string
  role: string
  mode?: 'chat' | 'voice'
}

export interface AIResponse {
  response: string
  action?: {
    type: string
    params: Record<string, string>
  }
  speakText?: string
}

export class AIAssistantService {
  private client: OpenAI | null = null
  private initialized = false

  private async initialize() {
    if (this.initialized) return
    if (!OPENAI_API_KEY) {
      console.warn('[AI] No OPENAI_API_KEY configured')
      return
    }
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY })
    this.initialized = true
    console.log('[AI] Assistant initialized with GPT')
  }

  async process(request: AIRequest): Promise<AIResponse> {
    await this.initialize()
    if (!this.client) {
      return {
        response:
          'AI assistant is not configured. Please add OPENAI_API_KEY to environment variables.',
      }
    }

    const isVoice = request.mode === 'voice'
    const systemPrompt = isVoice ? VOICE_PROMPT : SYSTEM_PROMPT

    const safeMessage = sanitizeMessage(request.message)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: safeMessage },
    ]

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: isVoice ? 300 : 500,
      })

      const response = completion.choices[0]?.message?.content || ''
      return this.parseResponse(response, isVoice)
    } catch (error) {
      console.error('[AI] OpenAI error:', error)
      return {
        response: 'Sorry, I encountered an error. Please try again.',
      }
    }
  }

  private parseResponse(response: string, isVoice: boolean): AIResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.action && ALLOWED_ACTIONS.has(parsed.action)) {
          return {
            response: response.replace(jsonMatch[0], '').trim(),
            action: {
              type: parsed.action,
              params: parsed.params || {},
            },
            speakText: isVoice ? this.extractSpeakText(response) : undefined,
          }
        }
      }
    } catch {}

    return {
      response,
      speakText: isVoice ? response.slice(0, 200) : undefined,
    }
  }

  private extractSpeakText(response: string): string {
    const cleaned = response
      .replace(/\{[\s\S]*\}/, '')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim()
    return cleaned.slice(0, 200)
  }
}

export const aiAssistant = new AIAssistantService()
