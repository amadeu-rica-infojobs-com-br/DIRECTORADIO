import { expect, test } from '@playwright/test'

test('home lists Spanish stations first', async ({ page }) => {
  await page.goto('/')
  const names = await page.getByTestId('station-card-name').allTextContents()
  expect(names).toEqual(['Cadena SER', 'Radio HTTP', 'Radio FR', 'Rádio PT'])
})

test('station page shows details and player', async ({ page }) => {
  await page.goto('/emisora/cadena-ser')
  await expect(page.getByRole('heading', { name: 'Cadena SER' })).toBeVisible()
  await expect(page.getByText('España').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Escuchar en directo/ })).toBeVisible()
})

test('footer links to the cookie policy', async ({ page }) => {
  await page.goto('/')
  // El build de E2E no tiene NEXT_PUBLIC_GTM_ID: ni banner ni «Configurar cookies».
  await expect(page.getByRole('region', { name: 'Aviso de cookies' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Configurar cookies' })).toHaveCount(0)
  await page.getByRole('contentinfo').getByRole('link', { name: 'Política de cookies' }).click()
  await expect(page).toHaveURL(/\/politica-de-cookies$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Política de cookies' })).toBeVisible()
})

test('header search finds a station by name', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'DirectoRadio' })).toHaveAttribute('href', '/')
  const box = page.getByRole('banner').getByRole('searchbox', { name: 'Buscar emisora por nombre' })
  await box.fill('cadena')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/buscar\?q=cadena$/)
  await expect(page.getByTestId('station-card-name')).toHaveText(['Cadena SER'])
})

test('filters by country', async ({ page }) => {
  await page.goto('/buscar?pais=PT')
  await expect(page.getByTestId('station-card-name')).toHaveText(['Rádio PT'])
})

test('no results offers to remove a filter', async ({ page }) => {
  await page.goto('/buscar?pais=FR&genero=latina')
  await expect(page.getByText('No hemos encontrado emisoras con estos criterios.')).toBeVisible()
  await page.getByRole('link', { name: 'Quitar «Género: Latina»' }).first().click()
  await expect(page).toHaveURL(/\/buscar\?pais=FR$/)
  await expect(page.getByTestId('station-card-name')).toHaveText(['Radio FR'])
  // Tras quitar el género, la fila muestra solo el país activo.
  await expect(page.getByRole('button', { name: 'País: Francia, cambiar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Género ▾' })).toBeVisible()
})

test('chips open the option sheet', async ({ page }) => {
  await page.goto('/buscar')
  await page.getByRole('button', { name: 'País ▾' }).click()
  const sheet = page.getByRole('dialog', { name: 'País' })
  await sheet.getByRole('searchbox', { name: 'Filtrar País' }).fill('port')
  await sheet.getByRole('link', { name: 'Portugal' }).click()
  await expect(page).toHaveURL(/\/buscar\?pais=PT$/)
  await expect(page.getByTestId('station-card-name')).toHaveText(['Rádio PT'])
})

test('header search keeps active filters', async ({ page }) => {
  await page.goto('/buscar?pais=ES')
  const box = page.getByRole('banner').getByRole('searchbox', { name: 'Buscar emisora por nombre' })
  await box.fill('cadena')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/buscar\?q=cadena&pais=ES$/)
  await expect(page.getByTestId('station-card-name')).toHaveText(['Cadena SER'])
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 740 } })
  test('filters fit on mobile', async ({ page }) => {
    await page.goto('/')
    const card = await page.getByTestId('station-card-name').first().boundingBox()
    expect(card?.y ?? Infinity).toBeLessThan(300)
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('works without JavaScript', async ({ page }) => {
    await page.goto('/buscar')
    const summary = page.locator('summary')
    await expect(summary).toHaveText('Filtros (0)')
    await summary.click()
    await page.getByRole('combobox', { name: 'País' }).selectOption('PT')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page).toHaveURL(/pais=PT/)
    await expect(page.getByTestId('station-card-name')).toHaveText(['Rádio PT'])
  })
})

test('invalid filters are ignored', async ({ page }) => {
  const response = await page.goto('/buscar?pais=XX1')
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('station-card-name')).toHaveCount(4)
})

test('desactivada returns 404', async ({ page }) => {
  const response = await page.goto('/emisora/radio-off')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('No hemos encontrado esta emisora')).toBeVisible()
})
