import {
  bigserial,
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const genreEnum = pgEnum('genre', [
  'pop',
  'electronica',
  'rock',
  'jazz',
  'clasica',
  'variada',
  'noticias',
  'deportes',
  'generalista',
  'religiosa',
  'latina',
  'country-folk',
  'hip-hop',
])

export const statusEnum = pgEnum('station_status', ['activa', 'desactivada', 'eliminada'])

export const stations = pgTable(
  'stations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    descriptionGenerated: boolean('description_generated').default(false),
    logoUrl: text('logo_url'),
    streamUrl: text('stream_url').notNull(),
    homepageUrl: text('homepage_url'),
    countryCode: varchar('country_code', { length: 2 }),
    languages: text('languages').array().default(sql`'{}'::text[]`),
    languageCodes: text('language_codes').array().notNull().default(sql`'{}'::text[]`),
    genre: genreEnum('genre').notNull().default('variada'),
    status: statusEnum('status').notNull().default('activa'),
    deactivatedBySync: boolean('deactivated_by_sync').notNull().default(false),
    source: text('source').notNull(),
    externalId: text('external_id'),
    rbClickCount: integer('rb_click_count').default(0),
    playCount: integer('play_count').default(0),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).default('0'),
    ratingCount: integer('rating_count').default(0),
    healthLastCheckedAt: timestamp('health_last_checked_at', { withTimezone: true }),
    healthLastOk: boolean('health_last_ok'),
    healthConsecutiveFailures: integer('health_consecutive_failures').default(0),
    manualFields: text('manual_fields').array().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex('stations_source_external_id_idx').on(t.source, t.externalId),
    index('stations_language_codes_idx').using('gin', t.languageCodes),
  ],
)

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
})

export const stationTags = pgTable(
  'station_tags',
  {
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.stationId, t.tagId] })],
)

export const tagGenres = pgTable('tag_genres', {
  tag: text('tag').primaryKey(),
  genre: genreEnum('genre').notNull(),
})

export const plays = pgTable(
  'plays',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull(),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('plays_station_session_idx').on(t.stationId, t.sessionId),
    index('plays_created_at_idx').on(t.createdAt),
    index('plays_ip_hash_created_at_idx').on(t.ipHash, t.createdAt),
  ],
)

export type Station = typeof stations.$inferSelect
export type NewStation = typeof stations.$inferInsert
