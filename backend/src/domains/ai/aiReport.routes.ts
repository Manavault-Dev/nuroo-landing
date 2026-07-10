import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { LogEvent, logEvent } from '../../shared/observability/logger.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4.1-mini'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const generateSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  specialistType: z.enum([
    'speech_therapist',
    'psychologist',
    'aba_specialist',
    'defectologist',
    'ot_specialist',
  ]),
  language: z.enum(['ru', 'en', 'ky']).default('ru'),
  selectedMetrics: z.record(z.string(), z.array(z.string())),
  additionalNotes: z.string().max(1000).optional().nullable(),
  childName: z.string().min(1).max(200),
  childAge: z.coerce.number().int().min(0).max(30).optional().nullable(),
})

const saveSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  specialistType: z.enum([
    'speech_therapist',
    'psychologist',
    'aba_specialist',
    'defectologist',
    'ot_specialist',
  ]),
  language: z.enum(['ru', 'en', 'ky']).default('ru'),
  selectedMetrics: z.record(z.string(), z.array(z.string())),
  additionalNotes: z.string().max(1000).optional(),
  aiGeneratedText: z.string(),
  finalText: z.string(),
  status: z.enum(['draft', 'sent']).default('draft'),
})

const updateSchema = z.object({
  finalText: z.string().optional(),
  status: z.enum(['draft', 'sent']).optional(),
})

// ─── AI prompts ───────────────────────────────────────────────────────────────

function buildReportSystemPrompt(language: string): string {
  if (language === 'en') {
    return `You are a professional child development report writer. Based on structured assessment data from a specialist, generate a warm, professional parent progress report.

Rules:
- Write for parents, not specialists. Use simple language.
- Do NOT make medical diagnoses or unsupported claims.
- Only describe what the specialist selected — do not invent progress.
- Tone: warm, encouraging, professional.
- Include: brief summary, strengths observed, areas of continued focus, specific home recommendations.
- Length: 200–350 words.
- Return plain text only, no markdown, no headers with symbols.`
  }

  if (language === 'ky') {
    return `Сиз балдардын өнүгүүсү боюнча профессионал отчёт жазучусусуз. Адистин структуралаштырылган баалоо маалыматтарына негизделип, ата-эне үчүн жылуу, профессионал жетишкендик отчётун даярда.

Эрежелер:
- Адистер үчүн эмес, ата-энелер үчүн жазыңыз. Жөнөкөй тил колдонуңуз.
- Медициналык диагноз же тастыкталбаган талаптарды коюуга БОЛБОЙТ.
- Адис тандаган нерсени гана сүрөттөңүз — жетишкендиктерди ойлоп тапкан.
- Тон: жылуу, жакшы, профессионал.
- Кириңиз: кыскача жыйынтык, байкалган күчтүү жактары, улантылуучу иш багыттары, конкреттүү үй сунуштары.
- Узундугу: 200–350 сөз.
- Жөнөкөй текст гана кайтарыңыз, маркдаун эмес.`
  }

  return `Ты — профессиональный автор отчётов о развитии ребёнка. На основе структурированных данных оценки от специалиста создай тёплый, профессиональный отчёт о прогрессе для родителей.

Правила:
- Пиши для родителей, не для специалистов. Простой язык.
- НЕ делай медицинских диагнозов и необоснованных заключений.
- Описывай только то, что выбрал специалист — не придумывай прогресс.
- Тон: тёплый, ободряющий, профессиональный.
- Включи: краткое резюме, отмеченные сильные стороны, области продолжения работы, конкретные рекомендации для дома.
- Длина: 200–350 слов.
- Возвращай только обычный текст, без markdown, без символов заголовков.`
}

function buildReportUserPrompt(data: z.infer<typeof generateSchema>): string {
  const {
    childName,
    childAge,
    periodStart,
    periodEnd,
    specialistType,
    selectedMetrics,
    additionalNotes,
    language,
  } = data

  const typeLabels: Record<string, Record<string, string>> = {
    ru: {
      speech_therapist: 'Логопед',
      psychologist: 'Психолог',
      aba_specialist: 'АBA-специалист',
      defectologist: 'Дефектолог',
      ot_specialist: 'Эрготерапевт',
    },
    en: {
      speech_therapist: 'Speech Therapist',
      psychologist: 'Psychologist',
      aba_specialist: 'ABA Specialist',
      defectologist: 'Defectologist',
      ot_specialist: 'Occupational Therapist',
    },
    ky: {
      speech_therapist: 'Логопед',
      psychologist: 'Психолог',
      aba_specialist: 'АBA-адис',
      defectologist: 'Дефектолог',
      ot_specialist: 'Эрготерапевт',
    },
  }
  const typeLabel = typeLabels[language]?.[specialistType] ?? specialistType

  const sectionLabels: Record<string, Record<string, string>> = {
    ru: {
      speech_sounds: 'Речевые звуки',
      articulation: 'Артикуляция',
      phonemic: 'Фонематический слух',
      communication: 'Коммуникация',
      attention: 'Внимание',
      home_practice: 'Домашние занятия',
      general_progress: 'Общий прогресс',
      emotional_state: 'Эмоциональное состояние',
      anxiety_level: 'Тревожность',
      self_regulation: 'Саморегуляция',
      social_skills: 'Социальные навыки',
      cognitive: 'Когнитивные функции',
      target_behaviors: 'Целевое поведение',
      skill_acquisition: 'Освоение навыков',
      prompt_dependency: 'Подсказки',
      generalization: 'Генерализация',
      cognitive_dev: 'Когнитивное развитие',
      perception: 'Восприятие',
      fine_motor: 'Мелкая моторика',
      learning_activity: 'Учебная деятельность',
      sensory: 'Сенсорная интеграция',
      gross_motor: 'Крупная моторика',
      fine_motor_ot: 'Мелкая моторика',
      daily_living: 'Навыки самообслуживания',
      coordination: 'Координация',
      general_progress_ot: 'Общий прогресс',
    },
    en: {
      speech_sounds: 'Speech sounds',
      articulation: 'Articulation exercises',
      phonemic: 'Phonemic hearing',
      communication: 'Communication',
      attention: 'Attention and engagement',
      home_practice: 'Home practice',
      general_progress: 'General progress',
      emotional_state: 'Emotional state',
      anxiety_level: 'Anxiety level',
      self_regulation: 'Self-regulation',
      social_skills: 'Social skills',
      cognitive: 'Cognitive functions',
      target_behaviors: 'Target behaviors',
      skill_acquisition: 'Skill acquisition',
      prompt_dependency: 'Prompt dependency',
      generalization: 'Skill generalization',
      cognitive_dev: 'Cognitive development',
      perception: 'Perception & thinking',
      fine_motor: 'Fine motor skills',
      learning_activity: 'Learning activity',
      sensory: 'Sensory integration',
      gross_motor: 'Gross motor skills',
      fine_motor_ot: 'Fine motor skills',
      daily_living: 'Daily living skills',
      coordination: 'Coordination & balance',
    },
    ky: {
      speech_sounds: 'Сүйлөө үндөрү',
      articulation: 'Артикуляция көнүгүүлөрү',
      phonemic: 'Фонемалык угуу',
      communication: 'Байланыш',
      attention: 'Дикат жана катышуу',
      home_practice: 'Үй тапшырмалары',
      general_progress: 'Жалпы жетишкендик',
      emotional_state: 'Эмоционалдык абал',
      anxiety_level: 'Тынчсыздануу деңгээли',
      self_regulation: 'Өзүн-өзү жөнгө салуу',
      social_skills: 'Социалдык көндүмдөр',
      cognitive: 'Когнитивдик функциялар',
      target_behaviors: 'Максаттуу жүрүм-турум',
      skill_acquisition: 'Көндүмдөрдү өздөштүрүү',
      prompt_dependency: 'Жардамга көзкарандылык',
      generalization: 'Жалпылоо',
      cognitive_dev: 'Когнитивдик өнүгүү',
      perception: 'Кабыл алуу жана ой жүгүртүү',
      fine_motor: 'Майда моторика',
      learning_activity: 'Окуу иш-аракети',
      sensory: 'Сенсордук интеграция',
      gross_motor: 'Ири моторика',
      fine_motor_ot: 'Майда моторика',
      daily_living: 'Өзүнө кам көрүү',
      coordination: 'Координация жана тең салмак',
    },
  }

  const labels = sectionLabels[language] || sectionLabels.ru

  const intro =
    language === 'ru'
      ? `Ребёнок: ${childName}${childAge !== undefined ? `, ${childAge} лет` : ''}\nСпециалист: ${typeLabel}\nПериод: ${periodStart} — ${periodEnd}\n\nРезультаты оценки по разделам:`
      : language === 'ky'
        ? `Бала: ${childName}${childAge !== undefined ? `, ${childAge} жаш` : ''}\nАдис: ${typeLabel}\nМезгил: ${periodStart} — ${periodEnd}\n\nБагыттар боюнча баалоо натыйжалары:`
        : `Child: ${childName}${childAge !== undefined ? `, age ${childAge}` : ''}\nSpecialist: ${typeLabel}\nPeriod: ${periodStart} — ${periodEnd}\n\nAssessment results by section:`

  const sections = Object.entries(selectedMetrics)
    .filter(([, opts]) => opts.length > 0)
    .map(([key, opts]) => `${labels[key] || key}:\n${opts.map((o) => `  • ${o}`).join('\n')}`)
    .join('\n\n')

  const notesLine = additionalNotes
    ? language === 'ru'
      ? `\n\nДополнительные заметки специалиста:\n${additionalNotes}`
      : language === 'ky'
        ? `\n\nАдистин кошумча эскертүүлөрү:\n${additionalNotes}`
        : `\n\nAdditional specialist notes:\n${additionalNotes}`
    : ''

  const instruction =
    language === 'ru'
      ? '\n\nНапиши отчёт для родителей на основе этих данных.'
      : language === 'ky'
        ? '\n\nОшол маалыматтарга негизделип ата-энелер үчүн отчёт жаз.'
        : '\n\nWrite a parent report based on this data.'

  return `${intro}\n\n${sections}${notesLine}${instruction}`
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const aiReportRoute: FastifyPluginAsync = async (fastify) => {
  // Generate AI report text (no save)
  fastify.post<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/ai-reports/generate',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)

      const parse = generateSchema.safeParse(request.body)
      if (!parse.success) {
        fastify.log.warn(
          { body: request.body, issues: parse.error.issues },
          'aiReport generate validation failed'
        )
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return reply.code(503).send({ error: 'AI service not configured' })

      const data = parse.data
      const startMs = Date.now()

      try {
        const res = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: buildReportSystemPrompt(data.language) },
              { role: 'user', content: buildReportUserPrompt(data) },
            ],
            temperature: 0.6,
            max_tokens: 700,
          }),
          signal: AbortSignal.timeout(30_000),
        })

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
          logEvent({
            event: LogEvent.AI_GENERATION_FAILED,
            feature: 'parent_report',
            model: MODEL,
            endpoint: '/ai-reports/generate',
            durationMs: Date.now() - startMs,
            errorCode: res.status,
            errorMessage: err?.error?.message || 'OpenAI error',
          })
          return reply.code(502).send({ error: 'AI service error' })
        }

        const json = (await res.json()) as {
          choices: Array<{ message: { content: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        const text = json.choices?.[0]?.message?.content?.trim() || ''

        logEvent({
          event: LogEvent.AI_GENERATION_SUCCESS,
          feature: 'parent_report',
          model: MODEL,
          endpoint: '/ai-reports/generate',
          durationMs: Date.now() - startMs,
          tokenUsage: json.usage
            ? {
                prompt: json.usage.prompt_tokens,
                completion: json.usage.completion_tokens,
                total: json.usage.total_tokens,
              }
            : undefined,
        })

        return { ok: true, childId, text }
      } catch (err) {
        fastify.log.error(err, 'aiReport generate error')
        logEvent({
          event: LogEvent.AI_GENERATION_FAILED,
          feature: 'parent_report',
          model: MODEL,
          endpoint: '/ai-reports/generate',
          durationMs: Date.now() - startMs,
          errorMessage: err instanceof Error ? err.message : 'Unknown',
        })
        return reply.code(500).send({ error: 'Internal error' })
      }
    }
  )

  // Save report (draft or sent)
  fastify.post<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/ai-reports',
    async (request, reply) => {
      const { orgId, childId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      const parse = saveSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parse.error.issues })
      }

      const db = getFirestore()
      const now = new Date()
      const doc = {
        ...parse.data,
        childId,
        organizationId: orgId,
        specialistId: request.user!.uid,
        specialistName: (member as any).name || '',
        createdAt: now.toISOString(),
        sentAt: parse.data.status === 'sent' ? now.toISOString() : null,
      }

      const ref = await db.collection(`organizations/${orgId}/aiReports`).add(doc)

      // If status=sent, also post to child activity feed so parent sees it
      if (parse.data.status === 'sent') {
        await db.collection(`organizations/${orgId}/children/${childId}/feed`).add({
          type: 'progress_update',
          visibility: 'parent_visible',
          authorId: request.user!.uid,
          authorRole: 'specialist',
          authorName: (member as any).name || 'Специалист',
          title: buildFeedTitle(parse.data.language, parse.data.periodStart, parse.data.periodEnd),
          body: parse.data.finalText,
          relatedEntityType: 'ai_report',
          relatedEntityId: ref.id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          unreadBy: [],
        })
      }

      return reply.code(201).send({ ok: true, reportId: ref.id })
    }
  )

  // List reports for child
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/ai-reports',
    async (request, reply) => {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      const snap = await db
        .collection(`organizations/${orgId}/aiReports`)
        .where('childId', '==', childId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()

      const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      return { ok: true, reports }
    }
  )

  // Update report (edit final text or send)
  fastify.patch<{ Params: { orgId: string; childId: string; reportId: string } }>(
    '/orgs/:orgId/children/:childId/ai-reports/:reportId',
    async (request, reply) => {
      const { orgId, childId, reportId } = request.params
      const member = await requireOrgMember(request, reply, orgId)

      const parse = updateSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({ error: 'Invalid input' })
      }

      const db = getFirestore()
      const ref = db.doc(`organizations/${orgId}/aiReports/${reportId}`)
      const snap = await ref.get()
      if (!snap.exists) return reply.code(404).send({ error: 'Report not found' })

      const now = new Date()
      const updates: Record<string, unknown> = { ...parse.data, updatedAt: now.toISOString() }
      if (parse.data.status === 'sent') updates.sentAt = now.toISOString()

      await ref.update(updates)

      // Post to feed when sending
      if (parse.data.status === 'sent' && parse.data.finalText) {
        const reportData = snap.data()!
        await db.collection(`organizations/${orgId}/children/${childId}/feed`).add({
          type: 'progress_update',
          visibility: 'parent_visible',
          authorId: request.user!.uid,
          authorRole: 'specialist',
          authorName: (member as any).name || 'Специалист',
          title: buildFeedTitle(
            reportData.language || 'ru',
            reportData.periodStart,
            reportData.periodEnd
          ),
          body: parse.data.finalText,
          relatedEntityType: 'ai_report',
          relatedEntityId: reportId,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          unreadBy: [],
        })
      }

      return { ok: true }
    }
  )
}

function buildFeedTitle(language: string, periodStart: string, periodEnd: string): string {
  const start = periodStart.slice(0, 10)
  const end = periodEnd.slice(0, 10)
  if (language === 'en') return `Progress Report ${start} – ${end}`
  if (language === 'ky') return `Жетишкендик отчёту ${start} – ${end}`
  return `Отчёт о прогрессе ${start} – ${end}`
}
