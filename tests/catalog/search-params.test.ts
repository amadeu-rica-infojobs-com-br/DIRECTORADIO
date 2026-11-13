// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hasCriteria, parseSearchParams, searchHref, searchTitle } from '@/catalog/search-params'

const parse = (raw: Record<string, string | string[] | undefined>) => parseSearchParams(raw)

describe('parseSearchParams', () => {
  it('trims the text', () => {
    expect(parse({ q: '  cadena ser  ' }).criteria).toEqual({ q: 'cadena ser' })
  })

  it('caps the text at 100 characters', () => {
    expect(parse({ q: 'a'.repeat(150) }).criteria.q).toHaveLength(100)
  })

  it.each(['   ', '—', '!!!'])('drops text without letters or digits: %j', (q) => {
    expect(parse({ q }).criteria).toEqual({})
  })

  it('normalizes the country and ignores invalid ones', () => {
    expect(parse({ pais: 'pt' }).criteria).toEqual({ country: 'PT' })
    expect(parse({ pais: 'POR' }).criteria).toEqual({})
    expect(parse({ pais: '1' }).criteria).toEqual({})
  })

  it('normalizes the language and ignores invalid ones', () => {
    expect(parse({ idioma: 'ES' }).criteria).toEqual({ language: 'es' })
    expect(parse({ idioma: 'es-ES' }).criteria).toEqual({})
  })

  it('accepts only known genres', () => {
    expect(parse({ genero: 'hip-hop' }).criteria).toEqual({ genre: 'hip-hop' })
    expect(parse({ genero: 'salsa' }).criteria).toEqual({})
  })

  it('takes the first valid value of a repeated parameter', () => {
    expect(parse({ pais: ['XX1', 'FR', 'ES'] }).criteria).toEqual({ country: 'FR' })
  })

  it.each(['0', 'abc', '-2', undefined])('defaults the page to 1 for %j', (pagina) => {
    expect(parse({ pagina }).page).toBe(1)
  })

  it('reads a valid page', () => {
    expect(parse({ pagina: '3' }).page).toBe(3)
  })
})

describe('searchHref', () => {
  it('builds /buscar with non-empty params in a fixed order', () => {
    expect(searchHref({ country: 'PT', genre: 'latina' }, 2)).toBe('/buscar?pais=PT&genero=latina&pagina=2')
    expect(searchHref({ genre: 'rock', language: 'es', country: 'ES', q: 'ser' })).toBe(
      '/buscar?q=ser&pais=ES&idioma=es&genero=rock',
    )
  })

  it('omits page 1 and encodes the text', () => {
    expect(searchHref({ q: 'los 40' }, 1)).toBe('/buscar?q=los+40')
  })

  it('returns /buscar without criteria', () => {
    expect(searchHref({})).toBe('/buscar')
  })
})

describe('hasCriteria', () => {
  it('is false only for empty criteria', () => {
    expect(hasCriteria({})).toBe(false)
    expect(hasCriteria({ genre: 'pop' })).toBe(true)
  })
})

describe('searchTitle', () => {
  it.each([
    [{}, 'Buscar emisoras'],
    [{ country: 'PT', language: 'pt' }, 'Emisoras de Portugal en portugués'],
    [{ genre: 'latina' }, 'Emisoras del género Latina'],
    [{ q: 'ser' }, 'Emisoras: «ser»'],
    [{ q: 'ser', country: 'ES' }, 'Emisoras de España: «ser»'],
  ] as const)('%j → %s', (criteria, title) => {
    expect(searchTitle(criteria)).toBe(title)
  })
})
