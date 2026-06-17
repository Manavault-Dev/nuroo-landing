import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test('serves the health endpoint', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.ok()).toBeTruthy()
    await expect(response).toBeOK()
    expect(await response.json()).toEqual({ ok: true })
  })

  test('renders the public connect page with mocked branding', async ({ page }) => {
    await page.route('**/public/orgs/org-1/branding', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          orgName: 'Bright Steps Center',
          branding: {
            name: 'Bright Steps Center',
            description: 'Supportive therapy for every family.',
            primaryColor: '#0f766e',
            welcomeMessage: 'We are ready to support your child.',
          },
        }),
      })
    })

    await page.goto('/en/connect?orgId=org-1&specialist=Jane%20Doe&code=INV123')

    await expect(page.getByRole('heading', { name: 'Bright Steps Center' })).toBeVisible()
    await expect(page.getByText('Jane Doe')).toBeVisible()
    await expect(page.getByText('INV123').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /open app/i })).toBeVisible()
  })

  test('renders B2B login form', async ({ page }) => {
    await page.goto('/en/b2b/login')

    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })
})
