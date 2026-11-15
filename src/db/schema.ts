import {
  bigserial,
  boolean,
  check,
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
  (t) => [primaryKey({ columns: [t.stationId, t.tagId] }), index('station_tags_tag_id_idx').on(t.tagId)],
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

export const ratingStatusEnum = pgEnum('rating_status', ['pending', 'verified'])

/** Emails que han verificado al menos una valoración (spec plan 4 §5.1). */
export const verifiedEmails = pgTable('verified_emails', {
  email: text('email').primaryKey(),
  // No cambia mientras exista la fila: la cookie de votante tiene que ser posterior (§5.3).
  firstVerifiedAt: timestamp('first_verified_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
  privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }).notNull(),
})

export const ratings = pgTable(
  'ratings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    stars: integer('stars').notNull(),
    status: ratingStatusEnum('status').notNull(),
    tokenHash: text('token_hash'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }).notNull(),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ratings_stars_check', sql`${t.stars} between 1 and 5`),
    uniqueIndex('ratings_station_email_status_idx').on(t.stationId, t.email, t.status),
    index('ratings_token_hash_idx').on(t.tokenHash),
    index('ratings_email_idx').on(t.email),
  ],
)

/** Registro de intentos para los límites por IP y por email (§5.4). Se borra a las 48 horas. */
export const ratingAttempts = pgTable(
  'rating_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ipHash: text('ip_hash'),
    email: text('email').notNull(),
    sentEmail: boolean('sent_email').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rating_attempts_ip_created_idx').on(t.ipHash, t.createdAt),
    index('rating_attempts_email_created_idx').on(t.email, t.createdAt),
  ],
)

export type Rating = typeof ratings.$inferSelect
export type NewRating = typeof ratings.$inferInsert
export type Station = typeof stations.$inferSelect
export type NewStation = typeof stations.$inferInsert
