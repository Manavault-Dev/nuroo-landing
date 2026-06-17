import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test('serves the health endpoint', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.ok()).toBeTruthy()
    await expect(response).toBeOK()
    expect(await response.json()).toEqual({ ok: true })
  })

  test('redirects root to the default locale', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 })

    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers().location).toMatch(/\/en$/)
  })
})
