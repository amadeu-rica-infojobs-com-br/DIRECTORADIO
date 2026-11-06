// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stations } from '@/db/schema'
import { handlePlay, MAX_BODY_BYTES } from '@/app/api/reproducciones/handle-play'
import { POST } from '@/app/api/reproducciones/route'
import { isUuid } from '@/lib/uuid'
import { createTestDb } from '../helpers/db'

describe('POST /api/reproducciones', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  const req = (body: string, contentType = 'application/json') =>
    new Request('http://localhost/api/reproducciones', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    })

  async function addStation() {
    const [row] = await ctx.db
      .insert(stations)
      .values({ slug: 's', name: 's', streamUrl: 'http://x/s', source: 'test', externalId: 's' })
      .returning()
    return row
  }

  it('returns 204 for a valid play, also when repeated', async () => {
    const st = await addStation()
    const body = JSON.stringify({ stationId: st.id, sessionId: randomUUID() })
    expect((await handlePlay(ctx.db, req(body))).status).toBe(204)
    expect((await handlePlay(ctx.db, req(body))).status).toBe(204)
  })

  it('returns 400 for invalid JSON', async () => {
    expect((await handlePlay(ctx.db, req('{nope'))).status).toBe(400)
  })

  it('returns 400 for a non-JSON content type', async () => {
    const st = await addStation()
    const body = JSON.stringify({ stationId: st.id, sessionId: randomUUID() })
    expect((await handlePlay(ctx.db, req(body, 'text/plain'))).status).toBe(400)
  })

  it('returns 400 when ids are not UUIDs', async () => {
    const ok = randomUUID()
    expect((await handlePlay(ctx.db, req(JSON.stringify({ stationId: 'x', sessionId: ok })))).status).toBe(400)
    expect((await handlePlay(ctx.db, req(JSON.stringify({ stationId: ok, sessionId: 5 })))).status).toBe(400)
    expect((await handlePlay(ctx.db, req('null'))).status).toBe(400)
    expect((await handlePlay(ctx.db, req('[]'))).status).toBe(400)
  })

  it('returns 400 for bodies larger than 1 KB', async () => {
    const body = JSON.stringify({ stationId: randomUUID(), sessionId: randomUUID(), pad: 'x'.repeat(MAX_BODY_BYTES) })
    expect((await handlePlay(ctx.db, req(body))).status).toBe(400)
  })

  it('returns 404 for an unknown station', async () => {
    const body = JSON.stringify({ stationId: randomUUID(), sessionId: randomUUID() })
    expect((await handlePlay(ctx.db, req(body))).status).toBe(404)
  })

  it('returns 429 with Retry-After after 30 plays from the same ip', async () => {
    const st = await addStation()
    const call = () =>
      handlePlay(
        ctx.db,
        new Request('http://localhost/api/reproducciones', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
          body: JSON.stringify({ stationId: st.id, sessionId: randomUUID() }),
        }),
        { salt: 'salt' },
      )
    for (let i = 0; i < 30; i++) expect((await call()).status).toBe(204)
    const res = await call()
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('3600')
  })

  it('does not limit when no salt is given', async () => {
    const st = await addStation()
    for (let i = 0; i < 31; i++) {
      const res = await handlePlay(
        ctx.db,
        new Request('http://localhost/api/reproducciones', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
          body: JSON.stringify({ stationId: st.id, sessionId: randomUUID() }),
        }),
      )
      expect(res.status).toBe(204)
    }
  })

  it('exports a POST route handler that validates input before touching the db', async () => {
    vi.stubEnv('DATABASE_URL', process.env.DATABASE_URL_TEST)
    expect(POST).toBeTypeOf('function')
    expect((await POST(req('{nope'))).status).toBe(400)
  })
})

describe('isUuid', () => {
  it('accepts UUIDs and rejects everything else', () => {
    expect(isUuid(randomUUID())).toBe(true)
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(42)).toBe(false)
  })
})
