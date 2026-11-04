import { expect, test } from '@playwright/test'

test('home lists Spanish stations first', async ({ page }) => {
  await page.goto('/')
  const names = await page.locator('a[href^="/emisora/"]').locator('span.line-clamp-2').allTextContents()
  expect(names[0]).toBe('Cadena SER')
  expect(names.indexOf('Radio FR')).toBeGreaterThan(names.indexOf('Radio HTTP'))
})

test('station page shows details and player', async ({ page }) => {
  await page.goto('/emisora/cadena-ser')
  await expect(page.getByRole('heading', { name: 'Cadena SER' })).toBeVisible()
  await expect(page.getByText('España').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Escuchar en directo/ })).toBeVisible()
})

test('desactivada returns 404', async ({ page }) => {
  const response = await page.goto('/emisora/radio-off')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('No hemos encontrado esta emisora')).toBeVisible()
})
