import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { runHealthCheck } from '@/catalog/health'

config({ path: '.env.local', quiet: true })

async function main() {
  const db = getDb()
  const report = await runHealthCheck(db)
  console.log(JSON.stringify(report, null, 2))
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
