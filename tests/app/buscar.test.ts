// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { generateMetadata } from '@/app/buscar/page'

const props = (sp: Record<string, string>) =>
  ({ params: Promise.resolve({}), searchParams: Promise.resolve(sp) }) as Parameters<typeof generateMetadata>[0]

describe('/buscar metadata', () => {
  it('is noindex, follow with a canonical /buscar', async () => {
    const meta = await generateMetadata(props({ pais: 'PT' }))
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.alternates?.canonical).toBe('/buscar')
  })

  it('describes the search in the title', async () => {
    expect((await generateMetadata(props({ pais: 'PT', idioma: 'pt' }))).title).toBe(
      'Emisoras de Portugal en portugués · DirectoRadio',
    )
    expect((await generateMetadata(props({}))).title).toBe('Buscar emisoras · DirectoRadio')
  })
})
