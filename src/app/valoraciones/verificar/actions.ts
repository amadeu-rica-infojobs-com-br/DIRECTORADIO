'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getDb } from '@/db/client'
import { ratingsEnabled } from '@/ratings/config'
import { confirmRating, type ConfirmResult } from '@/ratings/confirm'
import { signVoterCookie, VOTER_COOKIE, VOTER_COOKIE_MAX_AGE } from '@/ratings/voter-cookie'

/**
 * Confirma la valoración al pulsar el botón (POST). El GET de la página no confirma nada, para que los
 * escáneres de enlaces del correo no gasten el token (spec plan 4 §5.2).
 */
export async function confirmAction(_prev: ConfirmResult | null, formData: FormData): Promise<ConfirmResult> {
  const secret = process.env.RATINGS_SECRET
  if (!ratingsEnabled() || !secret) return { status: 'invalid' }

  const result = await confirmRating(getDb(), formData.get('token'))
  if (result.status === 'confirmed') {
    const jar = await cookies()
    jar.set(VOTER_COOKIE, signVoterCookie(result.email, Date.now(), secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VOTER_COOKIE_MAX_AGE,
    })
    revalidatePath(`/emisora/${result.stationSlug}`)
  }
  return result
}
