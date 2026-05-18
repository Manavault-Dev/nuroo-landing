import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

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

function buildSystemPrompt(
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
        const systemPrompt = buildSystemPrompt(language, childData)
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
        const systemPrompt = buildSystemPrompt(language, childData)
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
