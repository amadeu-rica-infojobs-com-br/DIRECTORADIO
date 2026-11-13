import { expect, test } from '@playwright/test'

test('home lists Spanish stations first', async ({ page }) => {
  await page.goto('/')
  const names = await page.getByTestId('station-card-name').allTextContents()
  expect(names).toEqual(['Cadena SER', 'Radio HTTP', 'Radio FR'])
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

test('desactivada returns 404', async ({ page }) => {
  const response = await page.goto('/emisora/radio-off')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('No hemos encontrado esta emisora')).toBeVisible()
})
