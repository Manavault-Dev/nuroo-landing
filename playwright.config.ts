import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT || 3000)
const baseURL = `http://127.0.0.1:${port}`
const sharedEnv = [
  'NEXT_PUBLIC_FIREBASE_API_KEY=mock-api-key',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mock.firebaseapp.com',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID=mock-project',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mock.appspot.com',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789',
  'NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123',
  'NEXT_PUBLIC_E2E_AUTH_BYPASS=1',
  'NEXT_PUBLIC_API_URL=http://127.0.0.1:3101',
]
const webServerCommand = process.env.CI
  ? [...sharedEnv, 'npm run build', 'npm run start -- --hostname 127.0.0.1 --port ' + port].join(
      ' && '
    )
  : [...sharedEnv, 'npm run dev -- --hostname 127.0.0.1 --port ' + port].join(' ')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    command: webServerCommand,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 240_000 : 120_000,
  },
})
