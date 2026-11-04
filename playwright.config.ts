import { config } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'

config({ path: '.env.local', quiet: true })

const PORT = 3100

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? '' },
  },
})
