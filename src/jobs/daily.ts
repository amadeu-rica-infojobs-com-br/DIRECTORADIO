import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { fetchAllStations } from '@/catalog/radio-browser/client'
import { seedTagGenres } from '@/catalog/seed/tag-genres'
import { syncCatalog } from '@/catalog/sync'
import { pruneOldPlays } from '@/catalog/plays'
import { runHealthCheck } from '@/catalog/health'
import { runPhases, exitCodeFor } from '@/jobs/run-phases'

config({ path: '.env.local', quiet: true })

const log = (line: object) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...line }))

async function main(): Promise<number> {
  // Direct connection, no statement timeout: the daily work is long by nature.
  const db = getDb(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL, { statementTimeoutMs: 0 })
  try {
    const outcome = await runPhases(
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
    return exitCodeFor(outcome)
  } finally {
    await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end()
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (err) => {
    log({ event: 'daily_failed', error: String(err?.message ?? err) })
    process.exitCode = 1
  },
)
