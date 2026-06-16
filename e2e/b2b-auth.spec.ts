import { expect, test } from '@playwright/test'
import { mockBillingStatus, seedB2BAuth } from './helpers/b2b'

test.describe('B2B auth flows', () => {
  test('redirects protected page visitors to login when unauthenticated', async ({ page }) => {
    await page.goto('/en/b2b/assignments')

    await expect(page).toHaveURL(/\/en\/b2b\/login\?redirect=/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('opens a protected page with mocked auth session', async ({ page }) => {
    await seedB2BAuth(page)
    await mockBillingStatus(page)
    await page.route('**/orgs/org-1/content/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, tasks: [], count: 0 }),
      })
    })
    await page.route('**/orgs/org-1/content/roadmaps', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, roadmaps: [], count: 0 }),
      })
    })
    await page.route('**/orgs/org-1/groups', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, groups: [], count: 0 }),
      })
    })

    await page.goto('/en/b2b/assignments?orgId=org-1')

    await expect(page).toHaveURL(/\/en\/b2b\/assignments\?orgId=org-1/)
    await expect(page.getByRole('heading', { name: /tasks and roadmaps/i })).toBeVisible()
  })
})
