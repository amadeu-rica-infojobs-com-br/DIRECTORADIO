import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import postgres from 'postgres'

export async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
  } finally {
    await client.end()
  }
}

if (/[\\/]migrate\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) {
  config({ path: '.env.local', quiet: true })
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  runMigrations(url).then(
    () => console.log('Migrations applied'),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}
