import { getDb } from '@/db/client'
import { handlePlay } from './handle-play'

export const dynamic = 'force-dynamic'

let warnedMissingSalt = false

export async function POST(request: Request): Promise<Response> {
  const salt = process.env.PLAYS_IP_SALT || undefined
  if (!salt && process.env.NODE_ENV === 'production' && !warnedMissingSalt) {
    warnedMissingSalt = true
    console.warn('PLAYS_IP_SALT is not set: per-IP play rate limiting is disabled')
  }
  return handlePlay(getDb(), request, { salt })
}
