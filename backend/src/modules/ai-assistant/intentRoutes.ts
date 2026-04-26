import { FastifyPluginAsync } from 'fastify'
import OpenAI from 'openai'
import { requireOrgMember } from '../../plugins/rbac.js'
import { aiAssistant } from './service.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY

const INTENT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_group',
      description: 'Create a new group or class for children',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the group' },
          schedule: { type: 'string', description: 'Schedule string, e.g. "Mon, Wed at 15:00"' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_child',
      description: 'Add one or more children to a group',
      parameters: {
        type: 'object',
        properties: {
          childNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of children to add',
          },
          groupName: { type: 'string', description: 'Name of the target group' },
        },
        required: ['childNames', 'groupName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_group_schedule',
      description: 'Change the schedule of an existing group',
      parameters: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'Name of the group' },
          newSchedule: { type: 'string', description: 'New schedule string' },
        },
        required: ['groupName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_homework',
      description: 'Assign homework or an exercise to one or more children',
      parameters: {
        type: 'object',
        properties: {
          childNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of children to assign homework to',
          },
          homeworkTitle: { type: 'string', description: 'Title of the homework or exercise' },
          homeworkDescription: { type: 'string', description: 'Optional details or instructions' },
        },
        required: ['childNames', 'homeworkTitle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_reminder',
      description: "Send a reminder message to a child's parent",
      parameters: {
        type: 'object',
        properties: {
          childNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Name(s) of children whose parents to notify',
          },
          message: { type: 'string', description: 'Reminder message text' },
        },
        required: ['childNames'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_groups',
      description: 'Show all groups in the organization',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_children',
      description: 'Show all children assigned to this specialist',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_reports',
      description:
        'Show operational analytics: completion rates, group performance, parent engagement. Use when asked about weekly summary, progress, who is doing well, how groups are performing, etc.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['7', '30', '90'],
            description: 'Period in days — "7" for weekly (default), "30" for monthly',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_children_without_homework',
      description:
        'Show children who have no assigned homework or have pending uncompleted tasks. Use when asked who has no homework, who needs tasks assigned, who has not submitted work, etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_low_activity',
      description:
        'Show parents and children with low engagement or activity this week. Use when asked about inactive families, who to follow up with, dropout risk, etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

const SYSTEM_PROMPT = `You are an operational copilot for a child development platform (speech therapy, tutoring, etc).
Extract the user's intent from their message and call the matching function with structured parameters.
The user is a specialist who writes naturally in Russian, Kyrgyz, or English.
Resolve pronouns and contextual references (like "them", "there", "that group") using the session context below if provided.
If the message clearly matches a function, call it. If ambiguous or nothing matches, call no function.`

interface SessionContext {
  lastGroupName?: string
  lastChildNames?: string[]
  lastResultChildren?: string[]
}

export const intentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { orgId: string }
    Body: { message: string; context?: SessionContext }
  }>('/orgs/:orgId/assistant/intent', async (request, reply) => {
    const { orgId } = request.params
    const { message, context } = request.body || {}

    if (!message?.trim()) {
      return reply.code(400).send({ error: 'message is required' })
    }

    await requireOrgMember(request, reply, orgId)

    if (!OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'AI not configured' })
    }

    // Build session context string for the LLM
    const ctxLines: string[] = []
    if (context?.lastGroupName) ctxLines.push(`Last referenced group: "${context.lastGroupName}"`)
    if (context?.lastChildNames?.length)
      ctxLines.push(`Last referenced children: ${context.lastChildNames.join(', ')}`)
    if (context?.lastResultChildren?.length)
      ctxLines.push(
        `Last query result (use as "them"/"those children"): ${context.lastResultChildren.join(', ')}`
      )
    const contextStr = ctxLines.length
      ? `\n\nSession context (resolve pronouns like "them", "there", "that group" using this):\n${ctxLines.join('\n')}`
      : ''

    const client = new OpenAI({ apiKey: OPENAI_API_KEY })

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextStr },
          { role: 'user', content: message },
        ],
        tools: INTENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0,
        max_tokens: 300,
      })

      const toolCall = completion.choices[0]?.message.tool_calls?.[0]
      if (!toolCall) {
        return { type: 'unknown', params: {}, raw: message }
      }

      let params: Record<string, unknown> = {}
      try {
        params = JSON.parse(toolCall.function.arguments)
      } catch {
        // keep empty params
      }

      return { type: toolCall.function.name, params, raw: message }
    } catch (error) {
      fastify.log.error({ error }, '[AI] Intent extraction failed')
      return reply.code(500).send({ error: 'Intent extraction failed' })
    }
  })

  // POST /orgs/:orgId/ai/chat — mobile-compatible AI assistant chat.
  // The original /ai/chat reads orgId from JWT custom claims which mobile users
  // don't have. This endpoint accepts orgId via the route param and uses the
  // same aiAssistant.process() service with no duplicated business logic.
  fastify.post<{
    Params: { orgId: string }
    Body: { message: string; mode?: 'chat' | 'voice' }
  }>('/orgs/:orgId/ai/chat', async (request, reply) => {
    const { orgId } = request.params
    const { message, mode = 'chat' } = request.body || {}

    if (!message?.trim()) {
      return reply.code(400).send({ error: 'message is required' })
    }

    const member = await requireOrgMember(request, reply, orgId)
    if (!member) return

    const { uid } = request.user!
    const role = member.role === 'org_admin' ? 'organizer' : 'specialist'

    try {
      const result = await aiAssistant.process({ message, orgId, userId: uid, role, mode })
      return result
    } catch (error) {
      fastify.log.error({ error }, '[AI] Mobile chat error')
      return reply.code(500).send({ error: 'AI assistant error' })
    }
  })
}
