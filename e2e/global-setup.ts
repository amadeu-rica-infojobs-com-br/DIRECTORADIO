import { config } from 'dotenv'
import { runMigrations } from '../src/db/migrate'
import { seedE2E } from './seed'

export default async function globalSetup(): Promise<void> {
  config({ path: '.env.local', quiet: true })
  const url = process.env.DATABASE_URL_TEST
  if (!url) throw new Error('DATABASE_URL_TEST is not set')
  await runMigrations(url)
  await seedE2E(url)
}
