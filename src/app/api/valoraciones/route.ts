import { getDb } from '@/db/client'
import { handleRatingPost } from '@/ratings/http'
import { ratingHttpConfig } from '@/ratings/http-config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return handleRatingPost(getDb(), request, ratingHttpConfig())
}
