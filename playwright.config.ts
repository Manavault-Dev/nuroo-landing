import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT || 3000)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: [
      'NEXT_PUBLIC_FIREBASE_API_KEY=mock-api-key',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mock.firebaseapp.com',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID=mock-project',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mock.appspot.com',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789',
      'NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123',
      'NEXT_PUBLIC_E2E_AUTH_BYPASS=1',
      'NEXT_PUBLIC_API_URL=http://127.0.0.1:3101',
      'npm run dev -- --hostname 127.0.0.1 --port ' + port,
    ].join(' '),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
