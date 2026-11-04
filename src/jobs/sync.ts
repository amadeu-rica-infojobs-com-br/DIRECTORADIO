import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { fetchAllStations } from '@/catalog/radio-browser/client'
import { seedTagGenres } from '@/catalog/seed/tag-genres'
import { syncCatalog } from '@/catalog/sync'

config({ path: '.env.local', quiet: true })

async function main() {
  const db = getDb()
  await seedTagGenres(db)
  const stationsFromRb = await fetchAllStations()
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
