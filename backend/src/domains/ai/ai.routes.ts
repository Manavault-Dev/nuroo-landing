import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// ─── Parent AI ────────────────────────────────────────────────────────────────

const askBodySchema = z.object({
  message: z.string().min(1).max(4000),
  language: z.enum(['en', 'ru', 'kg']).default('en'),
  childData: z
    .object({
      name: z.string().max(100).optional(),
      age: z.string().max(20).optional(),
      diagnosis: z.string().max(500).optional(),
      developmentAreas: z.array(z.string().max(100)).max(10).optional(),
    })
    .optional(),
})

const taskBodySchema = z.object({
  area: z.string().min(1).max(100),
  language: z.enum(['en', 'ru', 'kg']).default('en'),
  childData: z
    .object({
      name: z.string().max(100).optional(),
      age: z.string().max(20).optional(),
      diagnosis: z.string().max(500).optional(),
    })
    .optional(),
})

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4.1-mini'

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not configured on the server')
  return key
}

async function callOpenAI(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 500, temperature: 0.7 }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`)
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content?.trim() ?? ''
}

function buildParentSystemPrompt(
  language: string,
  childData?: z.infer<typeof askBodySchema>['childData']
): string {
  const roles: Record<string, string> = {
    en: 'You are Nuroo, a specialized AI assistant helping parents support child development. Be encouraging, specific, and practical.',
    ru: 'Вы — Nuroo, ИИ-помощник для поддержки родителей в развитии ребёнка. Будьте ободряющими, конкретными и практичными.',
    kg: 'Сиз — Nuroo, ата-энелерге баланын өнүгүүсүн колдоого жардам берген ИИ-жардамчы. Кубаттоочу, конкреттүү жана практикалык болуңуз.',
  }

  let prompt = roles[language] ?? roles.en

  if (childData?.name && childData?.age) {
    prompt += `\nChild: ${childData.name}, Age: ${childData.age}`
  }
  if (childData?.diagnosis) prompt += `\nDiagnosis: ${childData.diagnosis}`
  if (childData?.developmentAreas?.length) {
    prompt += `\nFocus areas: ${childData.developmentAreas.join(', ')}`
  }

  return prompt
}

export const parentAiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/parent/ai/ask',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
            language: { type: 'string' },
            childData: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = askBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() })
      }

      const { message, language, childData } = parsed.data

      try {
        const apiKey = getOpenAIKey()
        const systemPrompt = buildParentSystemPrompt(language, childData)
        const reply_ = await callOpenAI(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          apiKey
        )
        return { reply: reply_ }
      } catch (err: any) {
        fastify.log.error({ err }, 'parentAi /ask failed')
        if (err.message?.includes('not configured')) {
          return reply.code(503).send({ error: 'AI service is not configured' })
        }
        return reply.code(502).send({ error: 'AI service unavailable. Please try again.' })
      }
    }
  )

  fastify.post(
    '/api/parent/ai/generate-task',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['area'],
          properties: {
            area: { type: 'string' },
            language: { type: 'string' },
            childData: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = taskBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.flatten() })
      }

      const { area, language, childData } = parsed.data

      const taskPrompts: Record<string, string> = {
        en: `Create a fun, engaging ${area} development activity for a child. Make it specific, age-appropriate, and easy for parents to implement at home. Include: activity name, simple instructions, materials needed, and expected duration. Respond in English.`,
        ru: `Создайте веселое, увлекательное занятие по развитию ${area} для ребёнка. Сделайте его конкретным, соответствующим возрасту и простым для родителей. Включите: название, инструкции, материалы и продолжительность. Отвечайте на русском языке.`,
        kg: `${area} өнүгүүсү үчүн балага кызыктуу кызмат түзүңүз. Аталышын, инструкцияларын, керектүү материалдарды жана узактыгын камтыңыз. Кыргыз тилинде жооп бериңиз.`,
      }

      const userPrompt = taskPrompts[language] ?? taskPrompts.en

      try {
        const apiKey = getOpenAIKey()
        const systemPrompt = buildParentSystemPrompt(language, childData)
        const result = await callOpenAI(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          apiKey
        )
        return { reply: result }
      } catch (err: any) {
        fastify.log.error({ err }, 'parentAi /generate-task failed')
        return reply.code(502).send({ error: 'AI service unavailable. Please try again.' })
      }
    }
  )
}

// ─── Specialist AI ────────────────────────────────────────────────────────────

const improveBodySchema = z.object({
  roughText: z.string().min(1).max(2000),
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

function buildSpecialistSystemPrompt(language: string): string {
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

function buildSpecialistUserPrompt(
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
        return reply.code(400).send({ error: 'Invalid request', details: parse.error.issues })
      }

      const { roughText, language, context } = parse.data
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return reply.code(503).send({ error: 'AI service not configured' })

      const messages = [
        { role: 'system', content: buildSpecialistSystemPrompt(language) },
        { role: 'user', content: buildSpecialistUserPrompt(roughText, context) },
      ]

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
          return reply.code(502).send({ error: `AI service error: ${detail}` })
        }

        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
        const content = data.choices?.[0]?.message?.content
        if (!content) return reply.code(502).send({ error: 'Empty AI response' })

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(content)
        } catch {
          fastify.log.error({ content }, 'AI returned invalid JSON')
          return reply.code(502).send({ error: 'AI returned invalid JSON' })
        }

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
        return reply.code(500).send({ error: 'Internal error' })
      }
    }
  )
}
