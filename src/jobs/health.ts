import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { runHealthCheck } from '@/catalog/health'

config({ path: '.env.local', quiet: true })

async function main() {
  const db = getDb(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL, { statementTimeoutMs: 0 })
  const report = await runHealthCheck(db)
  if (report.aborted) console.log(JSON.stringify({ event: 'health_aborted_high_failure_rate', ...report }))
  console.log(JSON.stringify(report, null, 2))
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
