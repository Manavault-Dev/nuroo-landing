import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { LogEvent, logEvent } from '../../shared/observability/logger.js'

const improveBodySchema = z.object({
  roughText: z
    .string()
    .min(10, 'Description too short')
    .max(650, 'Description too long — max 600 characters'),
  language: z.enum(['ru', 'en', 'ky']).default('ru'),
  context: z
    .object({
      title: z.string().max(200).optional(),
      category: z.string().max(100).optional(),
      ageMin: z.number().int().min(0).max(18).optional(),
      ageMax: z.number().int().min(0).max(18).optional(),
    })
    .optional(),
})

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4.1-mini'

function buildSystemPrompt(language: string): string {
  if (language === 'en') {
    return `You are a child development specialist assistant. Transform a rough task description into a clear, structured instruction for parents.

Return ONLY valid JSON with this exact structure:
{
  "title": "Clear task name (max 80 chars)",
  "description": "1-2 sentences describing the task for the parent",
  "instructions": ["Step 1", "Step 2", "Step 3"],
  "parentTip": "Practical tip for the parent (or empty string)",
  "expectedResult": "What success looks like (or empty string)"
}

Rules: instructions must have 3-6 concrete steps. Use simple language any parent understands.`
  }

  if (language === 'ky') {
    return `Сен — балдардын өнүгүүсү боюнча адиске жардамчысың. Тапшырманын болжолдуу сыпаттамасын ата-эне үчүн так, структураланган нускамага айлантуу.

Төмөнкү структурада ГАНА валиддүү JSON кайтар:
{
  "title": "Тапшырманын так аталышы (максимум 80 символ)",
  "description": "Ата-энеге тапшырма сыпаттамасы менен 1-2 сүйлөм",
  "instructions": ["Кадам 1", "Кадам 2", "Кадам 3"],
  "parentTip": "Ата-энеге практикалык кеңеш (же бош сап)",
  "expectedResult": "Ийгилик кандай көрүнөт (же бош сап)"
}

Эрежелер: нускамада 3-6 конкреттүү кадам болуш керек. Каалаган ата-эне түшүнө тургандай жөнөкөй тил.`
  }

  // Default: Russian
  return `Ты — помощник специалиста по развитию детей. Преврати черновое описание задания в чёткую, структурированную инструкцию для родителей.

Верни ТОЛЬКО валидный JSON строго в таком формате:
{
  "title": "Понятное название задания (максимум 80 символов)",
  "description": "1-2 предложения с описанием задания для родителя",
  "instructions": ["Шаг 1", "Шаг 2", "Шаг 3"],
  "parentTip": "Практический совет родителю (или пустая строка)",
  "expectedResult": "Как выглядит успех (или пустая строка)"
}

Правила: 3-6 конкретных шагов, простой язык для любого родителя.`
}

function buildUserPrompt(
  roughText: string,
  context?: { title?: string; category?: string; ageMin?: number; ageMax?: number }
): string {
  const parts = [`Черновое описание:\n"${roughText}"`]
  if (context?.title) parts.push(`Рабочее название: ${context.title}`)
  if (context?.category) parts.push(`Категория: ${context.category}`)
  if (context?.ageMin !== undefined || context?.ageMax !== undefined) {
    const age = [context.ageMin, context.ageMax].filter((v) => v !== undefined).join('–')
    if (age) parts.push(`Возраст: ${age} лет`)
  }
  parts.push('\nОформи в структурированную инструкцию. Верни только JSON.')
  return parts.join('\n')
}

export const specialistAiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/specialist/ai/improve-instruction',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parse = improveBodySchema.safeParse(request.body)
      if (!parse.success) {
        const firstIssue = parse.error.issues[0]
        const message =
          firstIssue?.path?.[0] === 'roughText' ? firstIssue.message : 'Invalid request'
        return reply.code(400).send({ error: message, details: parse.error.issues })
      }

      const { roughText, language, context } = parse.data
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return reply.code(503).send({ error: 'AI service not configured' })

      const messages = [
        { role: 'system', content: buildSystemPrompt(language) },
        { role: 'user', content: buildUserPrompt(roughText, context) },
      ]

      const startMs = Date.now()

      try {
        const res = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.5,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(30_000),
        })

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: { message?: string }
          }
          const detail = errBody?.error?.message || `OpenAI status ${res.status}`
          fastify.log.error({ status: res.status, detail }, 'OpenAI error in specialistAi')
          logEvent({
            event: LogEvent.AI_GENERATION_FAILED,
            feature: 'assignment_generation',
            model: MODEL,
            endpoint: '/api/specialist/ai/improve-instruction',
            durationMs: Date.now() - startMs,
            inputLength: roughText.length,
            errorCode: res.status,
            errorMessage: 'OpenAI returned non-2xx',
          })
          return reply.code(502).send({ error: `AI service error: ${detail}` })
        }

        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        const content = data.choices?.[0]?.message?.content
        if (!content) return reply.code(502).send({ error: 'Empty AI response' })

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(content)
        } catch {
          fastify.log.error({ content }, 'AI returned invalid JSON')
          return reply.code(502).send({ error: 'AI returned invalid JSON' })
        }

        logEvent({
          event: LogEvent.AI_GENERATION_SUCCESS,
          feature: 'assignment_generation',
          model: MODEL,
          endpoint: '/api/specialist/ai/improve-instruction',
          durationMs: Date.now() - startMs,
          inputLength: roughText.length,
          tokenUsage: data.usage
            ? {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens,
              }
            : undefined,
        })

        return reply.send({
          ok: true,
          result: {
            title: String(parsed.title || '').trim(),
            description: String(parsed.description || '').trim(),
            instructions: Array.isArray(parsed.instructions)
              ? (parsed.instructions as unknown[]).map((s) => String(s).trim()).filter(Boolean)
              : [],
            parentTip: String(parsed.parentTip || '').trim(),
            expectedResult: String(parsed.expectedResult || '').trim(),
          },
        })
      } catch (err) {
        fastify.log.error(err, 'specialistAi error')
        logEvent({
          event: LogEvent.AI_GENERATION_FAILED,
          feature: 'assignment_generation',
          model: MODEL,
          endpoint: '/api/specialist/ai/improve-instruction',
          durationMs: Date.now() - startMs,
          inputLength: roughText.length,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        })
        return reply.code(500).send({ error: 'Internal error' })
      }
    }
  )
}
