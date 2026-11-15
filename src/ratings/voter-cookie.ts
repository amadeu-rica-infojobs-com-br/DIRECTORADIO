import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { verifiedEmails } from '@/db/schema'

export const VOTER_COOKIE = 'dr_voter'
export const VOTER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url')

/** base64url(email) + "." + issuedAt + "." + HMAC(email + "." + issuedAt). */
export function signVoterCookie(email: string, issuedAt: number, secret: string): string {
  const encoded = Buffer.from(email).toString('base64url')
  return `${encoded}.${issuedAt}.${sign(`${email}.${issuedAt}`, secret)}`
}

/** Solo comprueba el formato y la firma. Para saber si sigue valiendo, readVoter consulta la base de datos. */
export function parseVoterCookie(value: string | undefined, secret: string): { email: string; issuedAt: number } | null {
  if (!value || !secret) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [encoded, issued, signature] = parts
  if (!/^\d+$/.test(issued)) return null
  const email = Buffer.from(encoded, 'base64url').toString('utf8')
  const issuedAt = Number(issued)
  const expected = Buffer.from(sign(`${email}.${issuedAt}`, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return { email, issuedAt }
}

/**
 * Email del votante si la cookie es válida, el email sigue verificado y la cookie es posterior a su
 * primera verificación. Así, un borrado a petición invalida las cookies antiguas (§5.3).
 */
export async function readVoter(db: Db, value: string | undefined, secret: string): Promise<string | null> {
  const parsed = parseVoterCookie(value, secret)
  if (!parsed) return null
  const [row] = await db
    .select({ firstVerifiedAt: verifiedEmails.firstVerifiedAt })
    .from(verifiedEmails)
    .where(eq(verifiedEmails.email, parsed.email))
    .limit(1)
  if (!row || parsed.issuedAt < row.firstVerifiedAt.getTime()) return null
  return parsed.email
}
