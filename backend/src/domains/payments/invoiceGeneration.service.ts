import admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'
import { getOrgPaymentProvider } from './providers/registry.js'
import { advanceNextInvoiceDate } from './billingProfile.service.js'
import { config } from '../../config/index.js'
import { dispatch as sendNotification } from '../../modules/notifications/notification.service.js'

export interface GenerationResult {
  orgId: string
  created: number
  skipped: number
  failed: number
  errors: string[]
}

export interface OverdueResult {
  marked: number
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export async function generateMonthlyInvoicesForOrg(
  db: Firestore,
  orgId: string,
  now = new Date()
): Promise<GenerationResult> {
  const result: GenerationResult = { orgId, created: 0, skipped: 0, failed: 0, errors: [] }

  // Fetch all active profiles — filter nextInvoiceDate in-memory to avoid composite index
  const profilesSnap = await db
    .collection(`organizations/${orgId}/childBillingProfiles`)
    .where('status', '==', 'active')
    .get()

  const dueProfiles = profilesSnap.docs
    .map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        childId: d.childId as string,
        parentId: d.parentId as string,
        amount: d.amount as number,
        currency: d.currency as 'KGS',
        dueDayOfMonth: d.dueDayOfMonth as number,
        nextInvoiceDate: (d.nextInvoiceDate?.toDate() ?? new Date()) as Date,
      }
    })
    .filter((p) => p.nextInvoiceDate <= now)

  console.info(
    JSON.stringify({
      event: 'monthly_invoice_generation_started',
      orgId,
      count: dueProfiles.length,
    })
  )

  for (const profile of dueProfiles) {
    try {
      const periodStart = new Date(
        profile.nextInvoiceDate.getFullYear(),
        profile.nextInvoiceDate.getMonth(),
        1
      )
      const periodEnd = new Date(
        profile.nextInvoiceDate.getFullYear(),
        profile.nextInvoiceDate.getMonth() + 1,
        0 // last day of month
      )
      const periodStartISO = periodStart.toISOString().split('T')[0]
      const periodEndISO = periodEnd.toISOString().split('T')[0]
      const dueDateISO = profile.nextInvoiceDate.toISOString().split('T')[0]

      // Idempotency: check if invoice for this profile + period already exists
      const existingSnap = await db
        .collection(`organizations/${orgId}/invoices`)
        .where('billingProfileId', '==', profile.id)
        .limit(50)
        .get()

      const existingDoc = existingSnap.docs.find((d) => d.data().periodStart === periodStartISO)

      if (existingDoc) {
        if (existingDoc.data().status !== 'upcoming') {
          // Already generated as pending/paid/etc — skip entirely
          result.skipped++
          console.info(
            JSON.stringify({
              event: 'monthly_invoice_generation_skipped_duplicate',
              orgId,
              profileId: profile.id,
              periodStart: periodStartISO,
            })
          )
          continue
        }

        // Invoice exists with 'upcoming' status — due date has arrived, upgrade it
        const upcomingId = existingDoc.id
        const backendUrl = (config.BACKEND_PUBLIC_URL ?? 'http://localhost:3101').replace(/\/$/, '')
        let upgradeUrl: string | null = null
        let upgradeProviderId: string | null = null
        const upgradeProvider = await getOrgPaymentProvider(db, orgId, 'finik')
        if (upgradeProvider) {
          try {
            const pr = await upgradeProvider.createInvoice({
              orgId,
              parentId: profile.parentId,
              childId: profile.childId,
              amount: profile.amount,
              currency: profile.currency,
              description: `Ежемесячный платёж — ${getMonthLabel(profile.nextInvoiceDate)}`,
              dueDate: dueDateISO,
              invoiceId: upcomingId,
              callbackUrl: `${backendUrl}/webhooks/finik`,
              // returnUrl redirects the parent back to the mobile app after payment
              returnUrl: `nuroo://invoices/${upcomingId}?status=paid`,
            })
            upgradeUrl = pr.paymentUrl
            upgradeProviderId = pr.providerPaymentId
          } catch (providerErr) {
            console.warn(
              JSON.stringify({
                event: 'monthly_invoice_upgrade_provider_error',
                orgId,
                profileId: profile.id,
                error: providerErr instanceof Error ? providerErr.message : String(providerErr),
              })
            )
          }
        }
        const tsUpgrade = admin.firestore.FieldValue.serverTimestamp()
        const nextDateAdvanced = advanceNextInvoiceDate(
          profile.nextInvoiceDate,
          profile.dueDayOfMonth
        )
        // Atomic batch: upgrade invoice + advance nextInvoiceDate together.
        // If the server crashes between two separate writes, the profile could
        // stay at the old date and be reprocessed — with a batch either both
        // writes land or neither does, preventing a permanent stuck state.
        const upgradeBatch = db.batch()
        upgradeBatch.update(existingDoc.ref, {
          status: 'pending',
          paymentUrl: upgradeUrl ?? null,
          providerPaymentId: upgradeProviderId ?? null,
          updatedAt: tsUpgrade,
        })
        upgradeBatch.update(db.doc(`organizations/${orgId}/childBillingProfiles/${profile.id}`), {
          nextInvoiceDate: nextDateAdvanced,
          updatedAt: tsUpgrade,
        })
        await upgradeBatch.commit()

        // Push notification to parent — invoice is now due
        try {
          await sendNotification({
            userId: profile.parentId,
            orgId,
            role: 'parent',
            type: 'invoice_due',
            category: 'billingUpdates',
            title: '💳 Счёт к оплате',
            body: `Срок оплаты ${profile.amount} ${profile.currency} — ${dueDateISO}. Нажмите, чтобы оплатить.`,
            metadata: { orgId, parentId: profile.parentId, childId: profile.childId },
            channel: 'both',
            priority: 'high',
            dedupKey: `invoice_due_${upcomingId}`,
          })
        } catch {
          /* best-effort — don't block invoice creation */
        }

        try {
          await db.collection(`children/${profile.childId}/activityFeed`).add({
            organizationId: orgId,
            childId: profile.childId,
            type: 'system_event',
            visibility: 'parent_visible',
            authorId: 'system',
            authorRole: 'system',
            authorName: 'System',
            title: 'Выставлен счёт',
            body: `Ежемесячный платёж на ${profile.amount} ${profile.currency} выставлен.`,
            relatedEntityType: 'child',
            relatedEntityId: upcomingId,
            metadata: { invoiceId: upcomingId, amount: profile.amount },
            unreadBy: [profile.parentId],
            commentCount: 0,
            hasParentComment: false,
            createdAt: tsUpgrade,
            updatedAt: tsUpgrade,
          })
        } catch {
          /* best-effort */
        }
        result.created++
        continue
      }

      // No existing invoice — allocate a new ID and proceed
      const invoiceRef = db.collection(`organizations/${orgId}/invoices`).doc()
      const invoiceId = invoiceRef.id

      // Try to get payment URL from provider (optional — don't fail without it)
      let paymentUrl: string | null = null
      let providerPaymentId: string | null = null

      const provider = await getOrgPaymentProvider(db, orgId, 'finik')
      if (provider) {
        try {
          const backendUrl = (config.BACKEND_PUBLIC_URL ?? 'http://localhost:3101').replace(
            /\/$/,
            ''
          )
          const providerResult = await provider.createInvoice({
            orgId,
            parentId: profile.parentId,
            childId: profile.childId,
            amount: profile.amount,
            currency: profile.currency,
            description: `Ежемесячный платёж — ${getMonthLabel(profile.nextInvoiceDate)}`,
            dueDate: dueDateISO,
            invoiceId,
            callbackUrl: `${backendUrl}/webhooks/finik`,
            // returnUrl redirects the parent back to the mobile app after payment
            returnUrl: `nuroo://invoices/${invoiceId}?status=paid`,
          })
          paymentUrl = providerResult.paymentUrl
          providerPaymentId = providerResult.providerPaymentId
        } catch (providerErr) {
          // Provider error is non-fatal — create invoice without payment URL
          console.warn(
            JSON.stringify({
              event: 'monthly_invoice_generation_provider_error',
              orgId,
              profileId: profile.id,
              error: providerErr instanceof Error ? providerErr.message : String(providerErr),
            })
          )
        }
      }

      const ts = admin.firestore.FieldValue.serverTimestamp()
      // Advance nextInvoiceDate to next billing cycle
      const nextDate = advanceNextInvoiceDate(profile.nextInvoiceDate, profile.dueDayOfMonth)
      // Atomic batch: write invoice + advance nextInvoiceDate together
      const createBatch = db.batch()
      createBatch.set(invoiceRef, {
        orgId,
        parentId: profile.parentId,
        childId: profile.childId,
        billingProfileId: profile.id,
        amount: profile.amount,
        currency: profile.currency,
        description: `Ежемесячный платёж — ${getMonthLabel(profile.nextInvoiceDate)}`,
        dueDate: dueDateISO,
        periodStart: periodStartISO,
        periodEnd: periodEndISO,
        status: 'pending',
        paymentUrl: paymentUrl ?? null,
        providerPaymentId: providerPaymentId ?? null,
        provider: 'finik',
        createdBy: 'system',
        createdAt: ts,
        updatedAt: ts,
      })
      createBatch.update(db.doc(`organizations/${orgId}/childBillingProfiles/${profile.id}`), {
        nextInvoiceDate: nextDate,
        updatedAt: ts,
      })
      await createBatch.commit()

      // Push notification to parent — new invoice due
      try {
        await sendNotification({
          userId: profile.parentId,
          orgId,
          role: 'parent',
          type: 'invoice_due',
          category: 'billingUpdates',
          title: '💳 Счёт к оплате',
          body: `Срок оплаты ${profile.amount} ${profile.currency} — ${dueDateISO}. Нажмите, чтобы оплатить.`,
          metadata: { orgId, parentId: profile.parentId, childId: profile.childId },
          channel: 'both',
          priority: 'high',
          dedupKey: `invoice_due_${invoiceId}`,
        })
      } catch {
        /* best-effort */
      }

      // Activity feed — best-effort
      try {
        await db.collection(`children/${profile.childId}/activityFeed`).add({
          organizationId: orgId,
          childId: profile.childId,
          type: 'system_event',
          visibility: 'parent_visible',
          authorId: 'system',
          authorRole: 'system',
          authorName: 'System',
          title: 'Выставлен счёт',
          body: `Ежемесячный платёж на ${profile.amount} ${profile.currency} выставлен.`,
          relatedEntityType: 'invoice',
          relatedEntityId: invoiceId,
          metadata: {
            invoiceId,
            amount: profile.amount,
            currency: profile.currency,
            periodStart: periodStartISO,
            periodEnd: periodEndISO,
          },
          unreadBy: [profile.parentId],
          commentCount: 0,
          hasParentComment: false,
          createdAt: ts,
          updatedAt: ts,
        })
      } catch {
        // best-effort
      }

      result.created++
      console.info(
        JSON.stringify({
          event: 'monthly_invoice_created',
          orgId,
          profileId: profile.id,
          invoiceId,
          periodStart: periodStartISO,
        })
      )
    } catch (err) {
      result.failed++
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(msg)
      console.error(
        JSON.stringify({
          event: 'monthly_invoice_generation_failed',
          orgId,
          profileId: profile.id,
          error: msg,
        })
      )
    }
  }

  return result
}

export async function markOverdueInvoicesForOrg(
  db: Firestore,
  orgId: string,
  now = new Date()
): Promise<OverdueResult> {
  const todayISO = now.toISOString().split('T')[0]

  // Query all pending invoices; filter overdue in-memory to avoid composite index
  const snap = await db
    .collection(`organizations/${orgId}/invoices`)
    .where('status', '==', 'pending')
    .get()

  const overdueIds = snap.docs
    .filter((d) => {
      const dueDate = d.data().dueDate as string | undefined
      return dueDate && dueDate < todayISO
    })
    .map((d) => d.id)

  if (overdueIds.length === 0) return { marked: 0 }

  const BATCH_SIZE = 500
  let marked = 0
  const ts = admin.firestore.FieldValue.serverTimestamp()

  for (let i = 0; i < overdueIds.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const id of overdueIds.slice(i, i + BATCH_SIZE)) {
      batch.update(db.doc(`organizations/${orgId}/invoices/${id}`), {
        status: 'overdue',
        updatedAt: ts,
      })
      marked++
    }
    await batch.commit()
  }

  if (marked > 0) {
    console.info(JSON.stringify({ event: 'invoice_marked_overdue', orgId, count: marked }))

    // Notify each parent whose invoice went overdue
    const overdueSnap = await db
      .collection(`organizations/${orgId}/invoices`)
      .where('status', '==', 'overdue')
      .get()
    const notifiedParents = new Set<string>()
    for (const d of overdueSnap.docs) {
      const data = d.data()
      const parentId = data.parentId as string | undefined
      if (!parentId || notifiedParents.has(parentId)) continue
      notifiedParents.add(parentId)
      try {
        await sendNotification({
          userId: parentId,
          orgId,
          role: 'parent',
          type: 'invoice_overdue',
          category: 'billingUpdates',
          title: '⚠️ Просроченный платёж',
          body: `У вас есть просроченный счёт. Пожалуйста, оплатите как можно скорее.`,
          metadata: { orgId, parentId },
          channel: 'both',
          priority: 'high',
          dedupKey: `invoice_overdue_${orgId}_${parentId}_${todayISO}`,
        })
      } catch {
        /* best-effort */
      }
    }
  }

  return { marked }
}
