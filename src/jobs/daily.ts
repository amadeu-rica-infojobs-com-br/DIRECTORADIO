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

// fetch() wraps network failures as "fetch failed"; the useful part (ECONNRESET, ...) is in the cause.
const errorMessage = (err: unknown): string => {
  const e = err as { message?: string; cause?: { message?: string } } | undefined
  return [e?.message ?? String(err), e?.cause?.message].filter(Boolean).join(': ')
}

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
            const stations = await fetchAllStations({
              onRetry: ({ offset, attempt, delayMs, error }) =>
                log({ event: 'radio_browser_retry', offset, attempt, delayMs, error: errorMessage(error) }),
            })
            return syncCatalog(db, stations)
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
