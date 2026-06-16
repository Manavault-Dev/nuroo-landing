import type { Page, Route } from '@playwright/test'

export const E2E_AUTH_KEY = 'nuroo:e2e:auth'

export const mockB2BProfile = {
  uid: 'e2e-user-1',
  email: 'e2e@example.com',
  name: 'E2E Admin',
  organizations: [
    {
      orgId: 'org-1',
      orgName: 'E2E Center',
      country: 'Kyrgyzstan',
      role: 'admin' as const,
    },
  ],
}

export async function seedB2BAuth(page: Page) {
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload))
    },
    {
      key: E2E_AUTH_KEY,
      payload: {
        user: {
          uid: mockB2BProfile.uid,
          email: mockB2BProfile.email,
          displayName: mockB2BProfile.name,
        },
        profile: mockB2BProfile,
        currentOrgId: 'org-1',
      },
    }
  )
}

export async function mockBillingStatus(page: Page) {
  await page.route('**/orgs/org-1/billing/status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        active: true,
        planId: 'starter',
        source: 'subscription',
        billingStatus: 'active',
        badge: 'Active',
        error: null,
        expiresAt: null,
        limits: null,
        usage: null,
        features: {},
        trial: null,
      }),
    })
  })
}
