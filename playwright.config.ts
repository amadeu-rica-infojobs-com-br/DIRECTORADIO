import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig, devices } from '@playwright/test'
import { assertTestDbUrl } from './tests/helpers/assert-test-db'

config({ path: '.env.local', quiet: true })

const PORT = 3100
export const RATINGS_LINK_FILE = path.resolve('test-results', 'last-verification-url.txt')
const testDbUrl = assertTestDbUrl(process.env.DATABASE_URL_TEST)

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Un solo worker: los tests de reproducción escriben en la BD compartida y catalog.spec.ts (que va antes por orden alfabético) espera 0 reproducciones.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Se borra la caché de datos de Next (unstable_cache: opciones de filtros): sobrevive entre builds y
    // guardaría lo que hubiera en la BD de test de una ejecución anterior.
    command: `node -e "require('fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})" && npx tsx src/db/migrate.ts && npx tsx e2e/seed-cli.ts && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    // Vacía en el build: «Radio HTTP» sigue mostrando el aviso en lugar de usar el proxy.
    env: {
      DATABASE_URL: testDbUrl,
      NEXT_PUBLIC_AUDIO_PROXY_URL: '',
      // Valoraciones activas con las claves de prueba oficiales de Turnstile (siempre aceptan) y sin Brevo:
      // el enlace de verificación se escribe en RATINGS_DEV_LINK_FILE.
      RATINGS_ENABLED: 'true',
      ALLOW_PENDING_LEGAL: 'true',
      RATINGS_SECRET: 'e2e-secret',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      BREVO_API_KEY: '',
      SITE_URL: `http://localhost:${PORT}`,
      RATINGS_DEV_LINK_FILE: RATINGS_LINK_FILE,
    },
  },
})
