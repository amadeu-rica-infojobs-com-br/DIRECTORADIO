// @vitest-environment node
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ratingAttempts, ratings, stations } from '@/db/schema'
import type { SendVerification } from '@/ratings/brevo'
import { submitRating, type SubmitDeps } from '@/ratings/submit'
import { hashToken } from '@/ratings/token'
import { createTestDb } from '../helpers/db'

const SITE = 'https://directoradio.test'

describe('submitRating', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>
  let n = 0

  beforeEach(async () => {
    ctx ??= await createTestDb()
    await ctx.reset()
  })

  afterAll(async () => {
    await ctx?.close()
  })

  async function station(extra: Partial<typeof stations.$inferInsert> = {}) {
    n++
    const [s] = await ctx.db
      .insert(stations)
      .values({ slug: `radio-${n}`, name: `Radio ${n}`, streamUrl: `http://x/${n}`, source: 'test', externalId: `e${n}`, ...extra })
      .returning({ id: stations.id, slug: stations.slug })
    return s
  }

  function deps(extra: Partial<SubmitDeps> & { send?: ReturnType<typeof vi.fn<SendVerification>> } = {}) {
    const send = vi.fn<SendVerification>(async () => {})
    return { send, verifyCaptcha: vi.fn(async () => true), voterEmail: null, ipHash: 'ip-1', siteUrl: SITE, ...extra }
  }

  const input = (stationId: string, extra: Record<string, unknown> = {}) => ({
    stationId,
    stars: 4,
    email: '  Ana@Mail.COM ',
    acceptedPrivacy: true,
    turnstileToken: 't',
    ...extra,
  })

  const ratingOf = async (id: string) =>
    (await ctx.db.select({ avg: stations.ratingAvg, count: stations.ratingCount }).from(stations).where(eq(stations.id, id)))[0]

  it.each([
    { stars: 0 },
    { stars: '5' },
    { stars: 6 },
    { email: 'no-es-email' },
    { acceptedPrivacy: false },
    { stationId: 'x' },
  ])('rejects invalid input %j without sending', async (bad) => {
    const s = await station()
    const d = deps()
    expect(await submitRating(ctx.db, input(s.id, bad), d)).toEqual({ status: 'invalid' })
    expect(d.send).not.toHaveBeenCalled()
  })

  it('rejects a failed captcha without logging an attempt', async () => {
    const s = await station()
    expect(await submitRating(ctx.db, input(s.id), deps({ verifyCaptcha: vi.fn(async () => false) }))).toEqual({
      status: 'captcha',
    })
    expect(await ctx.db.select().from(ratingAttempts)).toHaveLength(0)
  })

  it('stores a pending vote and sends the verification link', async () => {
    const s = await station()
    const d = deps()
    expect(await submitRating(ctx.db, input(s.id), d)).toEqual({ status: 'pending', email: 'ana@mail.com' })
    const url = d.send.mock.calls[0][0].url
    expect(url.startsWith(`${SITE}/valoraciones/verificar?token=`)).toBe(true)
    const rows = await ctx.db.select().from(ratings)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'pending', email: 'ana@mail.com', stars: 4, ipHash: 'ip-1' })
    expect(rows[0].tokenHash).toBe(hashToken(new URL(url).searchParams.get('token')!))
    expect(await ratingOf(s.id)).toEqual({ avg: '0.00', count: 0 })
  })

  it('replaces a pending vote and invalidates the previous link', async () => {
    const s = await station()
    const d = deps()
    await submitRating(ctx.db, input(s.id), d)
    const firstToken = new URL(d.send.mock.calls[0][0].url).searchParams.get('token')!
    await submitRating(ctx.db, input(s.id, { stars: 3 }), d)
    const rows = await ctx.db.select().from(ratings)
    expect(rows).toHaveLength(1)
    expect(rows[0].stars).toBe(3)
    expect(rows[0].tokenHash).not.toBe(hashToken(firstToken))
  })

  it('counts directly with a matching voter cookie and replaces the previous vote', async () => {
    const s = await station()
    const d = deps({ voterEmail: 'ana@mail.com' })
    expect(await submitRating(ctx.db, input(s.id), d)).toEqual({ status: 'counted', stationSlug: s.slug })
    expect(await ratingOf(s.id)).toEqual({ avg: '4.00', count: 1 })
    await submitRating(ctx.db, input(s.id, { stars: 2 }), d)
    expect(await ratingOf(s.id)).toEqual({ avg: '2.00', count: 1 })
    expect(d.send).not.toHaveBeenCalled()
  })

  it('asks for verification when the cookie belongs to another email', async () => {
    const s = await station()
    expect((await submitRating(ctx.db, input(s.id), deps({ voterEmail: 'otra@mail.com' }))).status).toBe('pending')
  })

  it('returns not-found for an inactive station', async () => {
    const s = await station({ status: 'desactivada' })
    expect(await submitRating(ctx.db, input(s.id), deps())).toEqual({ status: 'not-found' })
  })

  it('limits attempts per ip per hour', async () => {
    const d = deps({ voterEmail: 'ana@mail.com' })
    for (let i = 0; i < 10; i++) {
      const s = await station()
      expect((await submitRating(ctx.db, input(s.id), d)).status).toBe('counted')
    }
    const s = await station()
    expect(await submitRating(ctx.db, input(s.id), d)).toEqual({ status: 'rate-limited', retryAfter: 3600 })
  })

  it('limits verification emails per address per day, across ips', async () => {
    for (let i = 0; i < 5; i++) {
      const s = await station()
      expect((await submitRating(ctx.db, input(s.id), deps({ ipHash: `ip-${i}` }))).status).toBe('pending')
    }
    const s = await station()
    expect((await submitRating(ctx.db, input(s.id), deps({ ipHash: 'ip-x' }))).status).toBe('rate-limited')
  })

  it('serializes concurrent submissions from the same ip at the limit', async () => {
    const list = await Promise.all(Array.from({ length: 11 }, () => station()))
    const d = deps({ voterEmail: 'ana@mail.com' })
    const results = await Promise.all(list.map((s) => submitRating(ctx.db, input(s.id), d)))
    expect(results.filter((r) => r.status === 'counted')).toHaveLength(10)
    expect(results.filter((r) => r.status === 'rate-limited')).toHaveLength(1)
  })

  it('logs why the email could not be sent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = await station()
    const failing = deps({ send: vi.fn<SendVerification>(async () => Promise.reject(new Error('Brevo respondió 401 unauthorized'))) })
    await submitRating(ctx.db, input(s.id), failing)
    expect(warn).toHaveBeenCalledWith('[valoraciones] no se pudo enviar el email:', 'Brevo respondió 401 unauthorized')
    warn.mockRestore()
  })

  it('cleans up when the email cannot be sent', async () => {
    const s = await station()
    const failing = deps({ send: vi.fn<SendVerification>(async () => Promise.reject(new Error('down'))) })
    expect(await submitRating(ctx.db, input(s.id), failing)).toEqual({ status: 'send-failed' })
    expect(await ctx.db.select().from(ratings)).toHaveLength(0)
    const [attempt] = await ctx.db.select().from(ratingAttempts)
    expect(attempt.sentEmail).toBe(false)
    for (let i = 0; i < 5; i++) {
      const other = await station()
      expect((await submitRating(ctx.db, input(other.id), deps({ ipHash: `ok-${i}` }))).status).toBe('pending')
    }
  })

  it('keeps a verified vote while a new one is pending', async () => {
    const s = await station()
    await submitRating(ctx.db, input(s.id), deps({ voterEmail: 'ana@mail.com' }))
    await submitRating(ctx.db, input(s.id, { stars: 1 }), deps())
    const verified = await ctx.db
      .select()
      .from(ratings)
      .where(and(eq(ratings.stationId, s.id), eq(ratings.status, 'verified')))
    expect(verified).toHaveLength(1)
    expect(await ratingOf(s.id)).toEqual({ avg: '4.00', count: 1 })
  })
})
