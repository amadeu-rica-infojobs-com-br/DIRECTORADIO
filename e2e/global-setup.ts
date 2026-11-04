import { config } from 'dotenv'
import { runMigrations } from '../src/db/migrate'
import { assertTestDbUrl } from '../tests/helpers/assert-test-db'
import { seedE2E } from './seed'

export default async function globalSetup(): Promise<void> {
  config({ path: '.env.local', quiet: true })
  const url = assertTestDbUrl(process.env.DATABASE_URL_TEST)
  await runMigrations(url)
  await seedE2E(url)
}
