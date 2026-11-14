// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { faviconSvg } from '@/brand/brand'

const app = (f: string) => path.resolve(process.cwd(), 'src/app', f)
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47]

function pngSize(buf: Buffer, offset = 0): { width: number; height: number } {
  expect([...buf.subarray(offset, offset + 4)]).toEqual(PNG_SIG)
  return { width: buf.readUInt32BE(offset + 16), height: buf.readUInt32BE(offset + 20) }
}

describe('generated icons', () => {
  it('icon.svg is the favicon SVG', () => {
    expect(readFileSync(app('icon.svg'), 'utf8')).toBe(faviconSvg())
  })

  it('favicon.ico holds 16, 32 and 48 px PNG images', () => {
    const ico = readFileSync(app('favicon.ico'))
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    const count = ico.readUInt16LE(4)
    expect(count).toBe(3)
    const widths: number[] = []
    for (let i = 0; i < count; i++) {
      const entry = 6 + 16 * i
      widths.push(ico[entry])
      const offset = ico.readUInt32LE(entry + 12)
      expect(pngSize(ico, offset).width).toBe(ico[entry])
    }
    expect(widths).toEqual([16, 32, 48])
  })

  it('apple-icon.png is 180×180', () => {
    expect(pngSize(readFileSync(app('apple-icon.png')))).toEqual({ width: 180, height: 180 })
  })

  it('opengraph-image.png is 1200×630 with its alt text', () => {
    expect(pngSize(readFileSync(app('opengraph-image.png')))).toEqual({ width: 1200, height: 630 })
    expect(readFileSync(app('opengraph-image.alt.txt'), 'utf8')).toBe(
      'DirectoRadio · Radio en directo de todo el mundo',
    )
  })
})
