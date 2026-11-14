// Genera los iconos de la web desde src/brand/brand.ts. Se ejecuta a mano cuando cambia el logo:
//   npm run icons
// Usa el Chromium de Playwright (dependencia de desarrollo) para renderizar los PNG. Los archivos
// resultantes se guardan en git; no forma parte del build.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { BRAND, faviconSvg, symbolSvg, TAGLINE } from '../src/brand/brand'

const out = (f: string) => path.resolve(process.cwd(), 'src/app', f)

async function render(page: Page, html: string, width: number, height: number, transparent = false): Promise<Buffer> {
  await page.setViewportSize({ width, height })
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${html}</body></html>`,
  )
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width, height } })
}

const sized = (svg: string, size: number) => svg.replace('<svg ', `<svg width="${size}" height="${size}" `)

/** ICO con PNG embebidos: ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) por imagen + datos. */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  try {
    writeFileSync(out('icon.svg'), faviconSvg())

    const icoImages = []
    for (const size of [16, 32, 48]) icoImages.push({ size, png: await render(page, sized(faviconSvg(), size), size, size, true) })
    writeFileSync(out('favicon.ico'), buildIco(icoImages))

    // iOS redondea las esquinas: fondo a sangre y símbolo centrado con margen.
    const apple = `<div style="width:180px;height:180px;background:${BRAND.light.bg};display:flex;align-items:center;justify-content:center">${sized(symbolSvg('light'), 132)}</div>`
    writeFileSync(out('apple-icon.png'), await render(page, apple, 180, 180))

    const og = `<div style="width:1200px;height:630px;background:${BRAND.light.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
      <div style="display:flex;align-items:center;gap:36px">${sized(symbolSvg('light'), 160)}
        <span style="font-size:96px;font-weight:700;letter-spacing:-0.02em;color:#f8fafc">Directo<span style="color:${BRAND.light.bars}">Radio</span></span>
      </div>
      <div style="font-size:40px;color:#94a3b8">${TAGLINE}</div>
    </div>`
    writeFileSync(out('opengraph-image.png'), await render(page, og, 1200, 630))
    writeFileSync(out('opengraph-image.alt.txt'), `DirectoRadio · ${TAGLINE}`)
    console.log('Iconos generados en src/app/')
  } finally {
    await browser.close()
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
