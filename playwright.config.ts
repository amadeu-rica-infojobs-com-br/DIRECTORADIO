import { config } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'
import { assertTestDbUrl } from './tests/helpers/assert-test-db'

config({ path: '.env.local', quiet: true })

const PORT = 3100
const testDbUrl = assertTestDbUrl(process.env.DATABASE_URL_TEST)

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Un solo worker: los tests de reproducción escriben en la BD compartida y catalog.spec.ts (que va antes por orden alfabético) espera 0 reproducciones.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx tsx src/db/migrate.ts && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    // Vacía en el build: «Radio HTTP» sigue mostrando el aviso en lugar de usar el proxy.
    env: { DATABASE_URL: testDbUrl, NEXT_PUBLIC_AUDIO_PROXY_URL: '' },
  },
})
