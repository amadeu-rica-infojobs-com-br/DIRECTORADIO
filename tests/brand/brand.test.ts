// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BRAND, faviconSvg, symbolSvg, TAGLINE } from '@/brand/brand'

describe('brand', () => {
  it('keeps the approved colors and tagline', () => {
    expect(BRAND.light).toEqual({ bg: '#0f172a', bars: '#2dd4bf', live: '#a3e635', accent: '#0d9488' })
    expect(BRAND.dark).toEqual({ bg: '#134e4a', bars: '#5eead4', live: '#bef264', accent: '#5eead4' })
    expect(TAGLINE).toBe('Radio en directo de todo el mundo')
  })

  it('builds a standalone favicon SVG in light colors', () => {
    const svg = faviconSvg()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    for (const c of ['#0f172a', '#2dd4bf', '#a3e635']) expect(svg).toContain(c)
  })

  it('builds the large symbol per theme', () => {
    const dark = symbolSvg('dark')
    expect(dark).toContain('#134e4a')
    expect(dark).not.toContain('#0f172a')
    expect(symbolSvg('light')).toContain('#0f172a')
  })
})
