import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../shared/guards/index.js'
import { createInvoice, listInvoices, getInvoice, cancelInvoice } from './invoice.service.js'
import type { PaymentStatus } from './providers/PaymentProvider.interface.js'

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /orgs/:orgId/invoices
  fastify.post<{
    Params: { orgId: string }
    Body: {
      parentId: string
      childId: string
      amount: number
      currency: 'KGS'
      description: string
      dueDate: string
    }
  }>(
    '/orgs/:orgId/invoices',
    {
      schema: {
        body: {
          type: 'object',
          required: ['parentId', 'childId', 'amount', 'currency', 'description', 'dueDate'],
          properties: {
            parentId: { type: 'string', minLength: 1 },
            childId: { type: 'string', minLength: 1 },
            amount: { type: 'number', exclusiveMinimum: 0 },
            currency: { type: 'string', enum: ['KGS'] },
            description: { type: 'string', minLength: 1, maxLength: 500 },
            dueDate: { type: 'string', minLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const body = request.body

      // Validate dueDate is a future date
      const due = new Date(body.dueDate)
      if (isNaN(due.getTime()) || due <= new Date()) {
        return reply.code(400).send({
          error: 'dueDate must be a valid future date',
          code: 'INVALID_DUE_DATE',
        })
      }

      const db = getFirestore()

      try {
        const invoice = await createInvoice(
          db,
          orgId,
          {
            parentId: body.parentId,
            childId: body.childId,
            amount: body.amount,
            currency: body.currency,
            description: body.description,
            dueDate: body.dueDate,
          },
          request.user!.uid
        )

        fastify.log.info({ event: 'finik_invoice_created', orgId, invoiceId: invoice.invoiceId })

        return reply.code(201).send({ ok: true, invoice })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create invoice'
        if (message.includes('Payment provider is not connected')) {
          return reply.code(422).send({
            error: message,
            code: 'PROVIDER_NOT_CONNECTED',
          })
        }
        fastify.log.error({ event: 'finik_invoice_create_failed', orgId })
        return reply.code(500).send({ error: message, code: 'INVOICE_CREATE_FAILED' })
      }
    }
  )

  // GET /orgs/:orgId/invoices
  fastify.get<{
    Params: { orgId: string }
    Querystring: { parentId?: string; status?: string; limit?: string; month?: string }
  }>('/orgs/:orgId/invoices', async (request, reply) => {
    const { orgId } = request.params
    await requireOrgMember(request, reply, orgId)

    const { parentId, status, limit, month } = request.query
    const db = getFirestore()

    const invoices = await listInvoices(db, orgId, {
      parentId,
      status: status as PaymentStatus | undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      month,
    })

    return { ok: true, invoices }
  })

  // GET /orgs/:orgId/invoices/:invoiceId
  fastify.get<{
    Params: { orgId: string; invoiceId: string }
  }>('/orgs/:orgId/invoices/:invoiceId', async (request, reply) => {
    const { orgId, invoiceId } = request.params
    await requireOrgMember(request, reply, orgId)

    const db = getFirestore()
    const invoice = await getInvoice(db, orgId, invoiceId)

    if (!invoice) {
      return reply.code(404).send({ error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' })
    }

    return { ok: true, invoice }
  })

  // PATCH /orgs/:orgId/invoices/:invoiceId/cancel
  fastify.patch<{
    Params: { orgId: string; invoiceId: string }
  }>('/orgs/:orgId/invoices/:invoiceId/cancel', async (request, reply) => {
    const { orgId, invoiceId } = request.params
    await requireOrgMember(request, reply, orgId)

    const db = getFirestore()

    try {
      const invoice = await cancelInvoice(db, orgId, invoiceId)
      return { ok: true, invoice }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel invoice'
      if (message.includes('Invoice not found')) {
        return reply.code(404).send({ error: message, code: 'INVOICE_NOT_FOUND' })
      }
      if (message.includes('Cannot cancel')) {
        return reply.code(409).send({ error: message, code: 'INVALID_STATUS' })
      }
      return reply.code(500).send({ error: message, code: 'CANCEL_FAILED' })
    }
  })
}
