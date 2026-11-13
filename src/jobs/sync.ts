import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { fetchAllStations } from '@/catalog/radio-browser/client'
import { seedTagGenres } from '@/catalog/seed/tag-genres'
import { syncCatalog } from '@/catalog/sync'

config({ path: '.env.local', quiet: true })

async function main() {
  const db = getDb(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL, { statementTimeoutMs: 0 })
  await seedTagGenres(db)
  const stationsFromRb = await fetchAllStations({
    onRetry: ({ offset, attempt, delayMs, error }) => {
      const e = error as { message?: string; cause?: { message?: string } }
      const reason = [e?.message ?? String(error), e?.cause?.message].filter(Boolean).join(': ')
      console.warn(`Radio-Browser offset=${offset}: intento ${attempt} fallido (${reason}); reintento en ${delayMs} ms`)
    },
  })
  const report = await syncCatalog(db, stationsFromRb)
  console.log(JSON.stringify(report, null, 2))
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
