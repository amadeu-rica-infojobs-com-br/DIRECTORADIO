// Borrado a petición de los datos de un email (RGPD): npm run ratings:forget -- <email>
import { config } from 'dotenv'
import { getDb } from '@/db/client'
import { normalizeEmail } from '@/ratings/email'
import { forgetEmail } from '@/ratings/maintenance'

config({ path: '.env.local', quiet: true })

async function main(): Promise<number> {
  const raw = process.argv[2] ?? ''
  if (!normalizeEmail(raw)) {
    console.error('Uso: npm run ratings:forget -- <email>')
    return 1
  }
  const db = getDb(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL, { statementTimeoutMs: 0 })
  try {
    console.log(JSON.stringify(await forgetEmail(db, raw)))
    return 0
  } finally {
    await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end()
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (err) => {
    console.error(err)
    process.exitCode = 1
  },
)
