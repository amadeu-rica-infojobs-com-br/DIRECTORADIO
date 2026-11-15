import { existsSync, readFileSync, rmSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { RATINGS_LINK_FILE } from '../playwright.config'

async function vote(page: Page, stars: number, email: string) {
  await page.getByRole('radio', { name: stars === 1 ? '1 estrella' : `${stars} estrellas` }).click()
  await page.getByLabel('Tu email').fill(email)
  const box = page.getByRole('checkbox', { name: /He leído y acepto la/ })
  if (!(await box.isChecked())) await box.check()
  // Turnstile (clave de prueba) rellena su token al cargar el widget.
  const token = page.locator('input[name="cf-turnstile-response"]')
  await expect(token).toHaveCount(1, { timeout: 15_000 })
  await expect(token).not.toHaveValue('', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Enviar valoración' }).click()
}

test('rate a station: verify by email, then vote directly with the remembered email', async ({ page }) => {
  rmSync(RATINGS_LINK_FILE, { force: true })
  await page.goto('/emisora/cadena-ser')
  await vote(page, 4, 'e2e@example.com')
  await expect(page.getByText('Te hemos enviado un email a e2e@example.com')).toBeVisible()

  await expect.poll(() => existsSync(RATINGS_LINK_FILE)).toBe(true)
  await page.goto(readFileSync(RATINGS_LINK_FILE, 'utf8'))
  await page.getByRole('button', { name: 'Confirmar mi valoración' }).click()
  await expect(page.getByText('Tu valoración de Cadena SER ya cuenta')).toBeVisible()

  await page.goto('/emisora/cadena-ser')
  await expect(page.getByText('4,0 (1 valoración)')).toBeVisible()

  await vote(page, 2, 'e2e@example.com')
  await expect(page.getByText('¡Gracias! Tu valoración ya cuenta.')).toBeVisible()
  // Segundo envío sin recargar: el token de Turnstile se ha renovado.
  await vote(page, 5, 'e2e@example.com')
  await expect(page.getByText('¡Gracias! Tu valoración ya cuenta.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('5,0 (1 valoración)')).toBeVisible()

  // Otra ficha a la que se llega navegando en el cliente (emisoras similares): el widget se pinta de nuevo.
  await page.getByRole('heading', { name: 'Emisoras similares' }).scrollIntoViewIfNeeded()
  await page.getByTestId('station-card-name').filter({ hasText: 'Radio HTTP' }).click()
  await expect(page).toHaveURL(/\/emisora\/radio-http$/)
  await vote(page, 3, 'e2e@example.com')
  await expect(page.getByText('¡Gracias! Tu valoración ya cuenta.')).toBeVisible()
})
