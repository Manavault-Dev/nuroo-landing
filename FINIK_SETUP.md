# Finik Payment Integration Setup

## Overview

This project integrates with Finik payment system for accepting subscription payments in Kyrgyzstan.

## Backend Configuration

### 1. Generate RSA keys (required for Finik auth)

Finik uses **RSA-SHA256** signature. Generate a key pair and send the **public** key to Finik (e.g. by email):

```bash
openssl genrsa -out finik_private.pem 2048
openssl rsa -in finik_private.pem -pubout > finik_public.pem
```

- Keep `finik_private.pem` secret.
- Send `finik_public.pem` to Finik (e.g. support / your manager) so they can verify your requests.

### 2. Environment Variables

Add the following to your backend `.env`:

```env
# Finik Payment System (see https://www.finik.kg/for-developers/)
FINIK_API_KEY=<from Finik>
FINIK_ACCOUNT_ID=<from Finik>
FINIK_API_URL=https://api.acquiring.averspay.kg
# Contents of finik_private.pem (one line with \n for newlines, or multiline in quotes)
FINIK_PRIVATE_PEM="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"

# Webhook Secret (от Finik или произвольная строка для теста)
FINIK_WEBHOOK_SECRET=dev_secret_key_12345

# URL фронтенда (редирект после оплаты)
NEXT_PUBLIC_B2B_URL=http://localhost:3000
```

**FINIK_PRIVATE_PEM:** Paste the full contents of `finik_private.pem`. In `.env` you can use multiline value in double quotes, or a single line with literal `\n` where the key has newlines.

### Webhook Configuration

**Важно:** Webhook нужен только после деплоя бэкенда!

1. После деплоя бэкенда, настройте webhook URL в панели Finik:

   ```
   https://your-backend-domain.com/webhooks/finik
   ```

   (замените `your-backend-domain.com` на реальный домен вашего бэкенда)

2. В панели Finik будет webhook secret - скопируйте его и добавьте в `FINIK_WEBHOOK_SECRET`

3. **Для локальной разработки:** webhook не будет работать (Finik не сможет достучаться до localhost). Можно использовать тестовый режим или временно оставить пустым.

## Frontend Configuration

### Environment Variables

**Важно:** Эта переменная нужна только в бэкенде! Во фронтенде она не используется напрямую.

Бэкенд использует `NEXT_PUBLIC_B2B_URL` чтобы знать, куда редиректить пользователя после оплаты.

- **Для локальной разработки:** `NEXT_PUBLIC_B2B_URL=http://localhost:3000` (в `backend/.env`)
- **Для продакшена:** `NEXT_PUBLIC_B2B_URL=https://your-frontend-domain.com` (в `backend/.env`)

Это URL вашего фронтенда (Next.js приложение), не бэкенда!

## Subscription Plans

Current plans configured:

- **Basic**: 1000 KGS/month
- **Professional**: 3000 KGS/month
- **Enterprise**: 8000 KGS/month

Plans can be modified in `backend/src/modules/payments/payments.service.ts`:

```typescript
const PLAN_PRICES: Record<string, number> = {
  basic: 1000,
  professional: 3000,
  enterprise: 8000,
}
```

## API Endpoints

### Get Available Plans

```
GET /plans
```

### Create Payment

```
POST /orgs/:orgId/payments
Body: { orgId: string, planId: 'basic' | 'professional' | 'enterprise' }
```

### Verify Payment

```
GET /payments/:paymentId/verify
```

### Webhook (Finik → Backend)

```
POST /webhooks/finik
Body: { paymentId, status, amount, currency, metadata }
```

## Payment Flow

1. User selects a plan on `/b2b/billing`
2. Frontend calls `POST /orgs/:orgId/payments`
3. Backend creates payment record and calls Finik API
4. Backend returns `paymentUrl` to frontend
5. User is redirected to Finik payment page
6. After payment, Finik redirects to:
   - Success: `/b2b/billing/success?paymentId=xxx`
   - Cancel: `/b2b/billing/cancel?paymentId=xxx`
7. Finik sends webhook to `/webhooks/finik`
8. Backend updates payment status and activates subscription

## Database Schema

### Payments Collection

```
payments/{paymentId}
  - paymentId: string
  - orgId: string
  - planId: string
  - amount: number
  - currency: string
  - status: 'pending' | 'completed' | 'failed' | 'cancelled'
  - finikTransactionId?: string
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - completedAt?: Timestamp
```

### Billing Collection

```
organizations/{orgId}/billing/current
  - planId: string
  - orgId: string
  - status: 'active' | 'expired' | 'cancelled'
  - currentPlan: 'basic' | 'professional' | 'enterprise' | null
  - expiresAt?: Timestamp
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

### Organization Updates

```
organizations/{orgId}
  - billingPlan: 'basic' | 'professional' | 'enterprise' | null
  - billingStatus: 'active' | 'expired' | 'cancelled'
  - billingUpdatedAt: Timestamp
```

## Testing

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to `/b2b/billing` (as org admin)
4. Select a plan and test payment flow
5. Check webhook logs in backend console

## Troubleshooting

### Payment URL not received

- Check Finik API credentials in `.env`
- Verify `FINIK_API_URL` is correct
- Check backend logs for Finik API errors

### Webhook not working

- Verify webhook URL is accessible from internet
- Check `FINIK_WEBHOOK_SECRET` matches Finik dashboard
- Review webhook logs in backend

### Payment status not updating

- Check webhook endpoint is receiving requests
- Verify payment record exists in Firestore
- Check organization billing plan is being updated

## Support

For Finik API issues, contact:

- Email: support@finik.kg
- Documentation: https://www.finik.kg/for-developers/
