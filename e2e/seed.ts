import postgres from 'postgres'
import { stations } from '@/db/schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/db/schema'

type Seed = typeof stations.$inferInsert

const base = { source: 'e2e', healthConsecutiveFailures: 0 } as const

const SEED: Seed[] = [
  {
    ...base,
    slug: 'cadena-ser',
    name: 'Cadena SER',
    countryCode: 'ES',
    genre: 'generalista',
    streamUrl: 'https://e2e.example/cadena-ser',
    externalId: 'e2e-cadena-ser',
    rbClickCount: 500,
  },
  {
    ...base,
    slug: 'radio-fr',
    name: 'Radio FR',
    countryCode: 'FR',
    genre: 'pop',
    streamUrl: 'https://e2e.example/radio-fr',
    externalId: 'e2e-radio-fr',
    rbClickCount: 1000,
  },
  {
    ...base,
    slug: 'radio-http',
    name: 'Radio HTTP',
    countryCode: 'ES',
    genre: 'variada',
    streamUrl: 'http://e2e.example/radio-http',
    externalId: 'e2e-radio-http',
    rbClickCount: 10,
  },
  {
    ...base,
    slug: 'radio-off',
    name: 'Radio Off',
    countryCode: 'ES',
    genre: 'variada',
    status: 'desactivada',
    streamUrl: 'https://e2e.example/radio-off',
    externalId: 'e2e-radio-off',
    rbClickCount: 5,
  },
]

export async function seedE2E(url: string): Promise<void> {
  const dbName = new URL(url).pathname.replace(/^\//, '')
  if (dbName !== 'directoradio_test') {
    throw new Error(`Refusing to seed database "${dbName}": only directoradio_test is allowed`)
  }

  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await client.unsafe('TRUNCATE stations, tags, station_tags, tag_genres RESTART IDENTITY CASCADE')
    await drizzle(client, { schema }).insert(stations).values(SEED)
  } finally {
    await client.end()
  }
}
