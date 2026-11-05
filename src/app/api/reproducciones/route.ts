import { getDb } from '@/db/client'
import { handlePlay } from './handle-play'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return handlePlay(getDb(), request)
}
