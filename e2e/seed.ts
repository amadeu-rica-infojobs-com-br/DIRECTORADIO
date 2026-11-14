import postgres from 'postgres'
import { stations } from '@/db/schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/db/schema'

type Seed = typeof stations.$inferInsert

const base = { source: 'e2e', healthConsecutiveFailures: 0 } as const

export const STREAM_URLS = {
  cadenaSer: 'https://e2e.example/cadena-ser',
  radioFr: 'https://e2e.example/radio-fr',
  radioHttp: 'http://e2e.example/radio-http',
  radioOff: 'https://e2e.example/radio-off',
  radioPt: 'https://e2e.example/radio-pt',
} as const

const SEED: Seed[] = [
  {
    ...base,
    slug: 'radio-pt',
    name: 'Rádio PT',
    countryCode: 'PT',
    languageCodes: ['pt'],
    genre: 'latina',
    streamUrl: STREAM_URLS.radioPt,
    externalId: 'e2e-radio-pt',
    rbClickCount: 50,
  },
  {
    ...base,
    slug: 'cadena-ser',
    name: 'Cadena SER',
    countryCode: 'ES',
    languageCodes: ['es'],
    genre: 'generalista',
    streamUrl: STREAM_URLS.cadenaSer,
    externalId: 'e2e-cadena-ser',
    rbClickCount: 500,
  },
  {
    ...base,
    slug: 'radio-fr',
    name: 'Radio FR',
    countryCode: 'FR',
    languageCodes: ['fr'],
    genre: 'pop',
    streamUrl: STREAM_URLS.radioFr,
    externalId: 'e2e-radio-fr',
    rbClickCount: 1000,
  },
  {
    ...base,
    slug: 'radio-http',
    name: 'Radio HTTP',
    countryCode: 'ES',
    genre: 'variada',
    streamUrl: STREAM_URLS.radioHttp,
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
    streamUrl: STREAM_URLS.radioOff,
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
