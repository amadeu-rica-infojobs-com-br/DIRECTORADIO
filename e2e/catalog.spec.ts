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
  // El desplegable ya no conserva el género quitado (si no, el siguiente «Buscar» lo volvería a aplicar).
  await expect(page.getByRole('main').getByRole('combobox', { name: 'Género' })).toHaveValue('')
  await expect(page.getByRole('main').getByRole('combobox', { name: 'País' })).toHaveValue('FR')
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
