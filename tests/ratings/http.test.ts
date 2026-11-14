// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stations, verifiedEmails } from '@/db/schema'
import { handleRatingMe, handleRatingPost, type RatingHttpConfig } from '@/ratings/http'
import { signVoterCookie, VOTER_COOKIE } from '@/ratings/voter-cookie'
import { createTestDb } from '../helpers/db'

describe('rating HTTP handlers', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>
  let stationId: string

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
    const [s] = await ctx.db
      .insert(stations)
      .values({ slug: 'radio-a', name: 'Radio A', streamUrl: 'http://x/a', source: 'test', externalId: 'a' })
      .returning({ id: stations.id })
    stationId = s.id
  })

  afterAll(async () => {
    await ctx?.close()
  })

  const config = (extra: Partial<RatingHttpConfig> = {}): RatingHttpConfig => ({
    enabled: true,
    secret: 's',
    salt: 'salt',
    siteUrl: 'https://directoradio.test',
    send: vi.fn(async () => {}),
    verifyCaptcha: vi.fn(async () => true),
    revalidate: vi.fn(),
    ...extra,
  })

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://directoradio.test/api/valoraciones', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })

  const vote = () => ({ stationId, stars: 4, email: 'ana@mail.com', acceptedPrivacy: true, turnstileToken: 't' })

  it('answers 404 when ratings are disabled', async () => {
    expect((await handleRatingPost(ctx.db, post(vote()), config({ enabled: false }))).status).toBe(404)
    expect((await handleRatingMe(ctx.db, new Request('https://x/'), config({ enabled: false }))).status).toBe(404)
  })

  it('rejects bodies over 2 KB', async () => {
    expect((await handleRatingPost(ctx.db, post('x'.repeat(3000)), config())).status).toBe(400)
  })

  it('returns 202 pending without a voter cookie', async () => {
    const res = await handleRatingPost(ctx.db, post(vote()), config())
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ status: 'pending', email: 'ana@mail.com' })
  })

  it('returns 200 counted with a valid voter cookie and revalidates the page', async () => {
    await ctx.db.insert(verifiedEmails).values({
      email: 'ana@mail.com',
      firstVerifiedAt: new Date(1000),
      verifiedAt: new Date(1000),
      privacyAcceptedAt: new Date(1000),
    })
    const cookie = `${VOTER_COOKIE}=${signVoterCookie('ana@mail.com', Date.now(), 's')}`
    const cfg = config()
    const res = await handleRatingPost(ctx.db, post(vote(), { cookie }), cfg)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'counted' })
    expect(cfg.revalidate).toHaveBeenCalledWith('/emisora/radio-a')
  })

  it('maps captcha failures to 400 with a status', async () => {
    const res = await handleRatingPost(ctx.db, post(vote()), config({ verifyCaptcha: vi.fn(async () => false) }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ status: 'captcha' })
  })

  it('reports the voter email without caching', async () => {
    const empty = await handleRatingMe(ctx.db, new Request('https://x/'), config())
    expect(await empty.json()).toEqual({ email: null })
    expect(empty.headers.get('cache-control')).toBe('no-store')
    await ctx.db.insert(verifiedEmails).values({
      email: 'ana@mail.com',
      firstVerifiedAt: new Date(1000),
      verifiedAt: new Date(1000),
      privacyAcceptedAt: new Date(1000),
    })
    const cookie = `${VOTER_COOKIE}=${signVoterCookie('ana@mail.com', Date.now(), 's')}`
    const me = await handleRatingMe(ctx.db, new Request('https://x/', { headers: { cookie } }), config())
    expect(await me.json()).toEqual({ email: 'ana@mail.com' })
  })
})
