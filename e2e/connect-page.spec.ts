import { expect, test } from '@playwright/test'

test.describe('Connect page flow', () => {
  test('renders branded invite context from the public org endpoint', async ({ page }) => {
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
    await expect(page.locator('p').filter({ hasText: /^INV123$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /open nuroo app/i })).toBeVisible()
  })
})
