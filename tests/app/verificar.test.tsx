// @vitest-environment node
import { eq } from 'drizzle-orm'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ratings, stations } from '@/db/schema'
import { newToken } from '@/ratings/token'
import { createTestDb } from '../helpers/db'

const jar = vi.hoisted(() => ({ set: vi.fn(), db: null as unknown }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: jar.set, get: () => undefined }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/db/client', async (orig) => ({ ...(await orig<object>()), getDb: () => jar.db }))

import { confirmAction } from '@/app/valoraciones/verificar/actions'
import VerifyPage from '@/app/valoraciones/verificar/page'

describe('verification page', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>
  let token: string

  beforeEach(async () => {
    ctx ??= await createTestDb()
    jar.db = ctx.db
    jar.set.mockClear()
    await ctx.reset()
    vi.stubEnv('RATINGS_ENABLED', 'true')
    vi.stubEnv('RATINGS_SECRET', 's')
    const [s] = await ctx.db
      .insert(stations)
      .values({ slug: 'radio-a', name: 'Radio A', streamUrl: 'http://x/a', source: 'test', externalId: 'a' })
      .returning({ id: stations.id })
    const t = newToken()
    token = t.token
    await ctx.db.insert(ratings).values({
      stationId: s.id,
      email: 'ana@mail.com',
      stars: 4,
      status: 'pending',
      tokenHash: t.hash,
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      privacyAcceptedAt: new Date(),
    })
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await ctx?.close()
  })

  it('does not confirm on GET: it shows a confirm button', async () => {
    const html = renderToStaticMarkup(await VerifyPage({ searchParams: Promise.resolve({ token }) } as never))
    expect(html).toContain('Confirmar mi valoración')
    const [row] = await ctx.db.select().from(ratings)
    expect(row.status).toBe('pending')
  })

  it('confirms through the action and sets the voter cookie', async () => {
    const form = new FormData()
    form.set('token', token)
    const result = await confirmAction(null, form)
    expect(result).toMatchObject({ status: 'confirmed', stationName: 'Radio A' })
    const [row] = await ctx.db.select().from(ratings).where(eq(ratings.email, 'ana@mail.com'))
    expect(row.status).toBe('verified')
    expect(jar.set).toHaveBeenCalledWith(
      'dr_voter',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 }),
    )
  })

  it('says ratings are unavailable when disabled', async () => {
    vi.stubEnv('RATINGS_ENABLED', 'false')
    const html = renderToStaticMarkup(await VerifyPage({ searchParams: Promise.resolve({ token }) } as never))
    expect(html).toContain('Las valoraciones no están disponibles')
  })
})
