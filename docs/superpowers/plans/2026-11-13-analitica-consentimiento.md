# Analítica con GTM y consentimiento de cookies · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar el contenedor de Google Tag Manager en todas las páginas de producción, con Consent Mode v2 denegado por defecto, un banner propio de "Aceptar"/"Rechazar", un pie con "Configurar cookies" y la página `/politica-de-cookies`.

**Architecture:** La lógica de consentimiento (lectura y escritura de la elección, script de valores por defecto y envío de `gtag('consent', 'update', …)`) vive en `src/consent/` como funciones puras testeables. El layout raíz solo monta las piezas cuando existe `NEXT_PUBLIC_GTM_ID`: el script en línea de valores por defecto en `<head>`, el componente `GoogleTagManager` de `@next/third-parties/google` (carga tras la hidratación, es decir, después del script) y el banner. El banner es un componente cliente que se abre solo o mediante un evento de ventana que lanza el botón del pie.

**Tech Stack:** Next.js 16.4.5 (App Router), React 19, TypeScript, Tailwind 4, `@next/third-parties` 16.4.5, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [docs/superpowers/specs/2026-11-13-analitica-consentimiento-design.md](../specs/2026-11-13-analitica-consentimiento-design.md)

## Global Constraints

- ID del contenedor: `GTM-K6V4M9J6`, leído **solo** de `NEXT_PUBLIC_GTM_ID`. Nunca escrito en el código. Sin variable válida: ni GTM, ni banner, ni botón "Configurar cookies".
- Consentimiento por defecto: `analytics_storage`, `ad_storage`, `ad_user_data` y `ad_personalization` a `'denied'`. Los tres `ad_*` no se conceden nunca.
- La elección se guarda en `localStorage`, clave `dr.consent`, y caduca a los **12 meses** (365 días).
- "Aceptar" y "Rechazar" con el mismo tamaño y estilo. El banner no bloquea la web.
- El banner no tapa el mini-reproductor (`src/player/MiniPlayer.tsx`, `fixed bottom-0 z-40`).
- Todos los textos de la interfaz en `src/i18n/es-ES.ts`.
- `gtag` debe empujar el objeto `arguments` a `dataLayer` (`function gtag(){dataLayer.push(arguments)}`), no un array: GTM ignora los arrays en los comandos de consentimiento.
- Antes de escribir código de Next, leer `node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md` (AGENTS.md).
- Los tests de Vitest se lanzan desde `C:\PROJECTES\…` con la unidad en **mayúscula**: con `c:` Vitest carga dos veces y falla con "failed to find the current suite".

## Review Focus

1. `localStorage` bloqueado (modo privado, cookies bloqueadas): ni el script en línea ni el banner deben lanzar errores; el banner aparece y la elección vale solo para la página actual. → Task 1 (`readConsent`/`saveConsent` con `localStorage` que lanza) y Task 2 (script con `localStorage` que lanza).
2. Valor guardado corrupto o de otro formato (`"yes"`, JSON roto, `choice` desconocido): se trata como "sin elección". → Task 1.
3. Elección de hace más de 12 meses: el banner vuelve a salir y el script no concede nada. → Task 1 y Task 2.
4. Mini-reproductor abierto: el banner queda por encima, sin solaparse. → Task 3 (clase de desplazamiento cuando hay emisora sonando).
5. `NEXT_PUBLIC_GTM_ID` con espacios, vacío o con formato raro: se recorta, y si no cumple `^GTM-[A-Z0-9]+$` no se carga nada. → Task 1 (`getGtmId`).

---

### Task 1: Núcleo de consentimiento

**Files:**
- Create: `src/consent/consent.ts`
- Test: `tests/consent/consent.test.ts`

**Interfaces:**
- Produces:
  - `export type ConsentChoice = 'granted' | 'denied'`
  - `export const CONSENT_STORAGE_KEY = 'dr.consent'`
  - `export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000`
  - `export const OPEN_CONSENT_EVENT = 'dr:open-consent'`
  - `export function getGtmId(raw: string | undefined): string | null`: recorta; devuelve el ID si cumple `^GTM-[A-Z0-9]+$` y si no, `null`.
  - `export function readConsent(now?: number): ConsentChoice | null`: lee `localStorage[CONSENT_STORAGE_KEY]` con formato JSON `{ "choice": "granted" | "denied", "at": <epoch ms> }`. Devuelve `null` si no hay valor, si es inválido, si ha caducado (`now - at > CONSENT_MAX_AGE_MS`) o si `localStorage` lanza.
  - `export function saveConsent(choice: ConsentChoice, now?: number): void`: escribe el JSON y traga los errores de `localStorage`.
  - `export function sendConsentUpdate(choice: ConsentChoice): void`: llama a `window.gtag('consent', 'update', { analytics_storage: choice })` si existe `window.gtag`; si no, no hace nada.

- [ ] **Step 1: Write the failing tests** en `tests/consent/consent.test.ts` (`// @vitest-environment jsdom`; `localStorage.clear()` en `beforeEach`):
  - `getGtmId`: `' GTM-K6V4M9J6 '` → `'GTM-K6V4M9J6'`; `undefined`, `''`, `'K6V4M9J6'` y `'GTM-<script>'` → `null`.
  - `saveConsent('granted', 1000)` y después `readConsent(1000)` → `'granted'`; lo mismo con `'denied'`.
  - Caducidad: guardado en `0` y leído en `CONSENT_MAX_AGE_MS` → se conserva; leído en `CONSENT_MAX_AGE_MS + 1` → `null`.
  - Valores inválidos en la clave (`'yes'`, `'{'`, `'{"choice":"maybe","at":1}'`, `'{"choice":"granted"}'`) → `null`.
  - `localStorage` que lanza (`vi.spyOn(Storage.prototype, 'getItem')` y `'setItem'` con `mockImplementation(() => { throw new Error('blocked') })`): `readConsent()` → `null` y `saveConsent('granted')` no lanza.
  - `sendConsentUpdate('granted')` con `window.gtag = vi.fn()` → llamado con `('consent', 'update', { analytics_storage: 'granted' })`; sin `window.gtag`, no lanza.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/consent/consent.test.ts`
Expected: FAIL (no se puede resolver `@/consent/consent`).

- [ ] **Step 3: Implement `src/consent/consent.ts`** con las firmas de arriba. Declara `gtag?: (...args: unknown[]) => void` y `dataLayer?: unknown[]` en `Window` mediante `declare global`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/consent/consent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/consent/consent.ts tests/consent/consent.test.ts
git commit -m "feat(consent): consent storage, GTM id validation and gtag update"
```

### Task 2: Script de consentimiento por defecto y carga de GTM en el layout

**Files:**
- Create: `src/consent/defaults-script.ts`
- Create: `src/consent/Analytics.tsx` (componente de servidor)
- Modify: `src/app/layout.tsx`
- Modify: `package.json` / `package-lock.json` (`npm install --save-exact @next/third-parties@16.4.5`)
- Test: `tests/consent/defaults-script.test.ts`

**Interfaces:**
- Consumes: `CONSENT_STORAGE_KEY` y `CONSENT_MAX_AGE_MS` de Task 1.
- Produces:
  - `export function consentDefaultsScript(): string`: el código JavaScript que va en línea.
  - En `src/consent/Analytics.tsx`:
    - `export function ConsentDefaults(): JSX.Element`: `<script id="consent-defaults" dangerouslySetInnerHTML={{ __html: consentDefaultsScript() }} />`, para colocarlo dentro de `<head>`.
    - `export function Analytics({ gtmId }: { gtmId: string }): JSX.Element`: renderiza `<GoogleTagManager gtmId={gtmId} />`.

- [ ] **Step 1: Write the failing tests** en `tests/consent/defaults-script.test.ts`. Cada test borra `window.dataLayer`, `window.gtag` y `localStorage`, ejecuta `new Function(consentDefaultsScript())()` y comprueba `Array.from(window.dataLayer[i] as IArguments)`:
  - Sin elección guardada: `dataLayer` tiene una sola entrada, `['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]`, y `window.gtag` es una función.
  - Entrada como `arguments`, no como array: `Array.isArray(window.dataLayer[0])` → `false`.
  - Elección `granted` reciente guardada con `saveConsent('granted', Date.now())`: la segunda entrada es `['consent', 'update', { analytics_storage: 'granted' }]`.
  - Elección `granted` de hace `CONSENT_MAX_AGE_MS + 1` ms: una sola entrada (la de `default`).
  - Elección `denied`: una sola entrada.
  - `localStorage.getItem` que lanza: el script no lanza y deja solo la entrada `default`.
  - `dataLayer` que ya existe con un elemento previo: se conserva y se añade detrás.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/consent/defaults-script.test.ts`
Expected: FAIL (no se puede resolver el módulo).

- [ ] **Step 3: Implement `consentDefaultsScript()`** en `src/consent/defaults-script.ts`. Interpola `CONSENT_STORAGE_KEY` (con `JSON.stringify`) y `CONSENT_MAX_AGE_MS` en un script ES5 autocontenido: `window.dataLayer = window.dataLayer || []`, `function gtag(){dataLayer.push(arguments)}`, `window.gtag = gtag`, `gtag('consent','default',{…cuatro denegados…})`, y dentro de `try/catch` lee y valida el JSON con la misma regla que `readConsent`; si es `granted` y no ha caducado, envía `gtag('consent','update',{analytics_storage:'granted'})`. `ConsentDefaults` y `Analytics` van en `src/consent/Analytics.tsx`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/consent/defaults-script.test.ts`
Expected: PASS.

- [ ] **Step 5: Install `@next/third-parties@16.4.5` and wire the layout.** En `src/app/layout.tsx`:
  - `const gtmId = getGtmId(process.env.NEXT_PUBLIC_GTM_ID)`.
  - Si `gtmId` existe: `<head><ConsentDefaults /></head>` como primer hijo de `<html>`, y `<Analytics gtmId={gtmId} />` como hijo de `<html>`, después de `<body>` (patrón de la guía de Next).
  - Sin `gtmId`, el HTML queda como hoy.

- [ ] **Step 6: Verify in a production build**

Run (PowerShell): `$env:NEXT_PUBLIC_GTM_ID='GTM-K6V4M9J6'; npm run build; npm run start -- -p 3200` y, en otra terminal, `curl -s http://localhost:3200/ | Select-String 'consent-defaults|googletagmanager'`.
Expected: aparece `id="consent-defaults"`. La carga de `gtm.js` llega tras la hidratación, así que se comprueba en el navegador: en DevTools, `dataLayer[0]` es el `default` denegado y hay una petición a `googletagmanager.com/gtm.js?id=GTM-K6V4M9J6`. Repetir el build sin la variable: no aparece ninguna de las dos cosas.

- [ ] **Step 7: Commit**

```bash
git add src/consent/defaults-script.ts src/consent/Analytics.tsx src/app/layout.tsx package.json package-lock.json tests/consent/defaults-script.test.ts
git commit -m "feat(consent): consent mode defaults and GTM in root layout"
```

### Task 3: Banner de cookies

**Files:**
- Create: `src/consent/CookieBanner.tsx` (`'use client'`)
- Modify: `src/i18n/es-ES.ts`
- Modify: `src/app/layout.tsx` (montar `<CookieBanner />` dentro de `<PlayerProvider>`, solo si hay `gtmId`)
- Test: `tests/consent/CookieBanner.test.tsx`

**Interfaces:**
- Consumes: `readConsent`, `saveConsent`, `sendConsentUpdate` y `OPEN_CONSENT_EVENT` de Task 1; `usePlayer()` de `src/player/PlayerProvider.tsx` (`current` no nulo = mini-reproductor visible).
- Produces: `export function CookieBanner(): JSX.Element | null`.

Textos nuevos en `es-ES.ts` (el builder puede pulir la redacción):
- `'consent.label': 'Aviso de cookies'`
- `'consent.text': 'Usamos cookies de analítica de Google para saber cómo se usa la web. Solo se activan si las aceptas.'`
- `'consent.policy': 'Política de cookies'`
- `'consent.accept': 'Aceptar'`
- `'consent.reject': 'Rechazar'`

- [ ] **Step 1: Write the failing tests** en `tests/consent/CookieBanner.test.tsx`. Se renderiza dentro de `<PlayerProvider>`, con `window.gtag = vi.fn()` y `localStorage.clear()`:
  - Sin elección: aparece `getByRole('region', { name: 'Aviso de cookies' })` con los botones "Aceptar" y "Rechazar" y el enlace "Política de cookies" (`href="/politica-de-cookies"`).
  - "Aceptar" → `gtag` llamado con `('consent', 'update', { analytics_storage: 'granted' })`, `readConsent()` → `'granted'` y el banner desaparece.
  - "Rechazar" → `readConsent()` → `'denied'`, el banner desaparece y `gtag` no se llama (la primera vez la denegación ya es el valor por defecto).
  - Con `granted` guardado: el banner no se renderiza.
  - `window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))` con elección guardada → el banner vuelve a salir. Después, "Rechazar" → `gtag` llamado con `('consent', 'update', { analytics_storage: 'denied' })`.
  - Los dos botones tienen exactamente el mismo `className`.
  - Con `localStorage` que lanza, el banner aparece y "Aceptar" lo cierra sin errores.
  - Mini-reproductor activo: tras sonar una emisora (mismo montaje que `tests/components/AudioPlayer.test.tsx`), el banner lleva la clase `bottom-20`; sin emisora, `bottom-0`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/consent/CookieBanner.test.tsx`
Expected: FAIL (no se puede resolver el módulo).

- [ ] **Step 3: Implement `CookieBanner`.**
  - Estado `open`, calculado en `useEffect` tras el montaje (`readConsent() === null`) para no desajustar la hidratación; escucha `OPEN_CONSENT_EVENT`.
  - Al elegir, `saveConsent(choice)` y `open = false`. Se envía `sendConsentUpdate(choice)` si la elección es `granted` o si había una elección previa distinta.
  - Contenedor `fixed inset-x-0 z-50`, con `bottom-20` si `usePlayer().current` existe y `bottom-0` si no, `role="region"`, `aria-label={t('consent.label')}`, modo oscuro como el mini-reproductor.
  - Sin `useEffect` previo, renderiza `null`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/consent/CookieBanner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/consent/CookieBanner.tsx src/i18n/es-ES.ts src/app/layout.tsx tests/consent/CookieBanner.test.tsx
git commit -m "feat(consent): cookie banner with accept and reject"
```

### Task 4: Pie de página y política de cookies

**Files:**
- Create: `src/components/SiteFooter.tsx` (servidor)
- Create: `src/consent/CookieSettingsButton.tsx` (`'use client'`)
- Create: `src/app/politica-de-cookies/page.tsx`
- Modify: `src/app/layout.tsx` (pie después de `<main>`, dentro de `<PlayerProvider>`)
- Modify: `src/i18n/es-ES.ts`
- Modify: `docs/superpowers/specs/2026-11-04-directoradio-v1-design.md` (§4)
- Test: `tests/components/SiteFooter.test.tsx`, `tests/app/politica-de-cookies.test.tsx`, `e2e/catalog.spec.ts`

**Interfaces:**
- Consumes: `OPEN_CONSENT_EVENT` (Task 1) y `CONSENT_STORAGE_KEY` (Task 1, se cita en la política).
- Produces:
  - `export function SiteFooter({ showCookieSettings }: { showCookieSettings: boolean }): JSX.Element`
  - `export function CookieSettingsButton(): JSX.Element`: botón que hace `window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))`.

Textos nuevos: `'footer.cookiePolicy': 'Política de cookies'`, `'footer.cookieSettings': 'Configurar cookies'`, `'cookiePolicy.title': 'Política de cookies'` y `'cookiePolicy.metaTitle': 'Política de cookies · DirectoRadio'`. El cuerpo de la política puede ir como JSX en la página; no es texto de la interfaz que se reutilice.

- [ ] **Step 1: Write the failing tests:**
  - `SiteFooter showCookieSettings={true}`: enlace "Política de cookies" a `/politica-de-cookies` y botón "Configurar cookies". Al pulsarlo se recibe `OPEN_CONSENT_EVENT` (con `addEventListener` y `vi.fn()`).
  - `SiteFooter showCookieSettings={false}`: hay enlace, pero no hay botón.
  - Página de la política (renderizar el componente de página): `getByRole('heading', { level: 1, name: 'Política de cookies' })`. El texto menciona `_ga`, `dr.consent`, `dr.session`, "12 meses" y "Configurar cookies". Exporta `metadata.title === 'Política de cookies · DirectoRadio'`.
  - E2E (`e2e/catalog.spec.ts`): `test('footer links to the cookie policy')`. Desde `/`, al pulsar "Política de cookies" se navega a `/politica-de-cookies` (respuesta 200 y título visible). El build de E2E no tiene `NEXT_PUBLIC_GTM_ID`, así que también se comprueba que no hay botón "Configurar cookies" ni región "Aviso de cookies".

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/SiteFooter.test.tsx tests/app/politica-de-cookies.test.tsx`
Expected: FAIL (no se pueden resolver los módulos).

- [ ] **Step 3: Implement** `SiteFooter`, `CookieSettingsButton` y la página.
  - Contenido mínimo de la política: qué son las cookies; técnicas (`dr.session` en `sessionStorage`: identificador anónimo de sesión para contar reproducciones, se borra al cerrar la pestaña; `dr.consent` en `localStorage`: tu elección y su fecha, 12 meses); analítica de Google mediante Google Tag Manager (`_ga` y `_ga_*`, hasta 2 años, solo si aceptas, para estadísticas de uso); cómo cambiar la elección ("Configurar cookies" en el pie) y cómo borrar las cookies en el navegador; responsable y contacto, pendientes de completar con los textos legales del plan 4.
  - El pie lleva el mismo `max-w-7xl px-4` que la cabecera.
  - El `pb-20` de `<main>` sigue dejando hueco al mini-reproductor; el pie no debe quedar detrás de él (añadir `pb-20` al pie y quitarlo de `<main>` si hace falta).

- [ ] **Step 4: Update the spec §4.** Sustituir la línea "**Sin publicidad ni analítica en v1.** …" por: sin publicidad; analítica con Google Tag Manager solo con consentimiento previo (Consent Mode v2, banner propio con "Aceptar" y "Rechazar", política en `/politica-de-cookies`), con enlace al diseño `2026-11-13-analitica-consentimiento-design.md`.

- [ ] **Step 5: Run to verify all pass**

Run: `npx vitest run tests/components/SiteFooter.test.tsx tests/app/politica-de-cookies.test.tsx`, después `npm test`, `npm run lint` y `npm run test:e2e`.
Expected: todo en verde (Vitest y Playwright, incluido el nuevo e2e), y el lint sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteFooter.tsx src/consent/CookieSettingsButton.tsx src/app/politica-de-cookies/page.tsx src/app/layout.tsx src/i18n/es-ES.ts docs/superpowers/specs/2026-11-04-directoradio-v1-design.md tests/components/SiteFooter.test.tsx tests/app/politica-de-cookies.test.tsx e2e/catalog.spec.ts
git commit -m "feat(consent): footer, cookie settings and cookie policy page"
```

### Task 5: Comprobación final y producción

**Files:** ninguno de código.

- [ ] **Step 1:** Build local con `NEXT_PUBLIC_GTM_ID=GTM-K6V4M9J6`, abrir `http://localhost:3200` en el navegador y comprobar:
  - Banner visible; en DevTools → Application → Cookies, ninguna `_ga` antes de elegir.
  - "Rechazar": sigue sin haber `_ga`.
  - "Configurar cookies" → "Aceptar": aparece `_ga`.
  - Recargar: el banner no sale y `dataLayer[1]` es el `update` `granted`.
- [ ] **Step 2:** Push de la rama `analitica-consentimiento` y PR a `main`, con una nota para el responsable: dar de alta `NEXT_PUBLIC_GTM_ID=GTM-K6V4M9J6` en Vercel (Production) **antes** de fusionar, porque las variables `NEXT_PUBLIC_*` se fijan al compilar. Revisar en GTM que la etiqueta de GA4 respeta el consentimiento.
- [ ] **Step 3:** Si la CLI de Vercel tiene la sesión iniciada y el responsable lo autoriza: `vercel env add NEXT_PUBLIC_GTM_ID production` (valor `GTM-K6V4M9J6`).
