import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test('redirects root to the default locale', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/en$/)
    await expect(page).toHaveTitle(/Nuroo/i)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('renders help page content', async ({ page }) => {
    await page.goto('/en/help')

    await expect(page).toHaveTitle(/Help|Nuroo/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /tilek\.dzenisev@gmail\.com/i })).toBeVisible()
    await expect(page.locator('img[alt="Nuroo"]').first()).toBeVisible()
  })

  test('renders privacy page content', async ({ page }) => {
    await page.goto('/en/privacy')

    await expect(page).toHaveTitle(/Privacy|Nuroo/i)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/tilek\.dzenisev@gmail\.com/i).first()).toBeVisible()
  })

  test('renders B2B login form', async ({ page }) => {
    await page.goto('/en/b2b/login')

    await expect(page).toHaveTitle(/Nuroo/i)
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })
})
