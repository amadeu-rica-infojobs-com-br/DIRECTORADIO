// Siembra la BD de test antes del build de e2e: Playwright arranca el webServer (y compila) antes de
// globalSetup, y el build ya guarda en caché las opciones de los filtros (unstable_cache).
import { config } from 'dotenv'
import { assertTestDbUrl } from '../tests/helpers/assert-test-db'
import { seedE2E } from './seed'

config({ path: '.env.local', quiet: true })

seedE2E(assertTestDbUrl(process.env.DATABASE_URL_TEST)).then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
