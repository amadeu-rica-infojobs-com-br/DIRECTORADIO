import { expect, test, type Page, type Request } from '@playwright/test'
import { STREAM_URLS } from './seed'

const SAMPLE_RATE = 8000
const SECONDS = 30

// WAV PCM 16 bits mono con silencio: lo bastante largo para que `ended` no ocurra durante el test.
function silentWav(): Buffer {
  const dataSize = SAMPLE_RATE * 2 * SECONDS
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, Buffer.alloc(dataSize)])
}

const WAV = silentWav()
const STREAMS = new Set<string>(Object.values(STREAM_URLS))

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    if (STREAMS.has(route.request().url())) {
      return route.fulfill({ status: 200, contentType: 'audio/wav', body: WAV })
    }
    return route.continue()
  })
})

const miniPlayer = (page: Page) => page.getByRole('region', { name: 'Reproductor' })
const isPlayRequest = (request: Request) =>
  request.method() === 'POST' && new URL(request.url()).pathname === '/api/reproducciones'

async function startCadenaSer(page: Page) {
  await page.goto('/emisora/cadena-ser')
  await page.getByRole('button', { name: 'Escuchar en directo' }).click()
  await expect(miniPlayer(page).getByText('En directo')).toBeVisible()
}

const audioPaused = (page: Page) =>
  page.evaluate(() => document.querySelector<HTMLAudioElement>('[data-testid="dr-audio"]')?.paused)

test('keeps playing across navigation', async ({ page }) => {
  await startCadenaSer(page)
  await expect(miniPlayer(page).getByText('Cadena SER')).toBeVisible()

  await page.getByRole('link', { name: 'DirectoRadio' }).click()
  await expect(page).toHaveURL('/')

  await expect(miniPlayer(page).getByText('Cadena SER')).toBeVisible()
  await expect(miniPlayer(page).getByText('En directo')).toBeVisible()
  expect(await audioPaused(page)).toBe(false)
})

test('records one play', async ({ page }) => {
  const posts: Request[] = []
  page.on('request', (request) => {
    if (isPlayRequest(request)) posts.push(request)
  })

  const responsePromise = page.waitForResponse((response) => isPlayRequest(response.request()))
  await startCadenaSer(page)
  expect((await responsePromise).status()).toBe(204)

  await miniPlayer(page).getByRole('button', { name: 'Pausar' }).click()
  await expect(miniPlayer(page).getByRole('button', { name: 'Escuchar en directo' })).toBeVisible()
  await miniPlayer(page).getByRole('button', { name: 'Escuchar en directo' }).click()
  await expect(miniPlayer(page).getByText('En directo')).toBeVisible()

  expect(posts).toHaveLength(1)
})

test('close stops audio', async ({ page }) => {
  await startCadenaSer(page)

  await miniPlayer(page).getByRole('button', { name: 'Cerrar reproductor' }).click()

  await expect(miniPlayer(page)).toHaveCount(0)
  expect(await audioPaused(page)).toBe(true)
})

test('http station shows the notice instead of a player', async ({ page }) => {
  await page.goto('/emisora/radio-http')
  await expect(page.getByText('Esta emisora estará disponible muy pronto en DirectoRadio.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escuchar en directo' })).toHaveCount(0)
})
