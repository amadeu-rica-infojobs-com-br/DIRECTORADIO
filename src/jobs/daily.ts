import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { fetchAllStations } from '@/catalog/radio-browser/client'
import { seedTagGenres } from '@/catalog/seed/tag-genres'
import { syncCatalog } from '@/catalog/sync'
import { pruneOldPlays } from '@/catalog/plays'
import { runHealthCheck } from '@/catalog/health'
import { runPhases } from '@/jobs/run-phases'

config({ path: '.env.local', quiet: true })

const log = (line: object) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...line }))

async function main(): Promise<boolean> {
  const db = getDb()
  try {
    const { ok } = await runPhases(
      [
        {
          name: 'sync',
          run: async () => {
            await seedTagGenres(db)
            return syncCatalog(db, await fetchAllStations())
          },
        },
        { name: 'prune', run: () => pruneOldPlays(db) },
        {
          name: 'health',
          run: async () => {
            const report = await runHealthCheck(db)
            if (report.aborted) log({ event: 'health_aborted_high_failure_rate', ...report })
            return report
          },
        },
      ],
      log,
    )
    return ok
  } finally {
    await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end()
  }
}

main().then(
  (ok) => {
    process.exitCode = ok ? 0 : 1
  },
  (err) => {
    log({ event: 'daily_failed', error: String(err?.message ?? err) })
    process.exitCode = 1
  },
)
