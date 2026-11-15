import { getDb } from '@/db/client'
import { handleRatingMe } from '@/ratings/http'
import { ratingHttpConfig } from '@/ratings/http-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return handleRatingMe(getDb(), request, ratingHttpConfig())
}
