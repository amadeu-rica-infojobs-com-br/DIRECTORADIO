# Plan 4 — Valoraciones con email verificado y textos legales · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- valoraciones de 1 a 5 estrellas que solo cuentan con un email verificado (Brevo), con cookie de votante, límites y Turnstile;
- todo tras el interruptor `RATINGS_ENABLED`;
- más las páginas `/aviso-legal` y `/privacidad` y la política de cookies completada.

**Architecture:**
- **Dominio:** la lógica vive en `src/ratings/` como funciones que reciben `db` y dependencias inyectables (envío de email, verificación de Turnstile y reloj), para probarlas sin servicios externos:
  - `submitRating`;
  - `confirmRating`;
  - `readVoterCookie` y `signVoterCookie`;
  - `forgetEmail`;
  - `pruneRatings`.
- **Rutas y páginas:**
  - `POST /api/valoraciones` y `GET /api/valoraciones/yo` (route handlers);
  - `/valoraciones/verificar`, una página con un Server Action para confirmar;
  - el componente cliente `RatingForm` en la ficha.
- **Textos legales:** páginas estáticas que leen `src/legal/owner.ts`.

**Tech Stack:** Next.js 16.4.5 (App Router, route handlers y Server Actions), React 19, Drizzle y PostgreSQL, `node:crypto` (HMAC, SHA-256 y `randomBytes`), `fetch` a Brevo y Turnstile, Vitest y Playwright.

**Spec:** [docs/superpowers/specs/2026-11-14-valoraciones-legal-design.md](../specs/2026-11-14-valoraciones-legal-design.md)

## Global Constraints

- **Sin dependencias nuevas.** Brevo (`POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key`) y Turnstile (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`) se llaman con `fetch`.
- **Variables de entorno:** `RATINGS_ENABLED` (solo `"true"` activa), `RATINGS_SECRET`, `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` y `PLAYS_IP_SALT` (la sal de IP, ya existente).
- **Valores fijos:**
  - estrellas de 1 a 5;
  - token: 32 bytes aleatorios en base64url; se guarda su SHA-256 en hexadecimal y caduca a las 24 h;
  - cookie `dr_voter`: `HttpOnly`, `SameSite=Lax`, `Path=/`, 365 días, y `Secure` en producción;
  - límites: 10 intentos por IP y hora, 30 por IP y día, y 5 emails de verificación por dirección y día;
  - conservación: votos pendientes, 7 días; intentos, 48 h; `ip_hash` de los votos, 35 días.
- **Email:** recortado y en minúsculas, como máximo 254 caracteres, validado con `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- **Remitente:** «DirectoRadio <no-responder@directoradio.com>». Asunto: «Confirma tu valoración de {emisora}».
- **Titular:** persona física, contacto `amadeurm@gmail.com`. Nombre, NIF y domicilio quedan como `PENDIENTE` en `src/legal/owner.ts`.
- **Textos de la interfaz** en `src/i18n/es-ES.ts`.
- **Sin `BREVO_API_KEY`:** el enlace de verificación se escribe en el log con `console.info('[valoraciones] enlace de verificación:', url)`.
- **Claves de prueba de Turnstile** (documentación oficial de Cloudflare):
  - del sitio, siempre válida: `1x00000000000000000000AA`;
  - secreta, siempre acepta: `1x0000000000000000000000000000000AA`;
  - secreta, siempre rechaza: `2x0000000000000000000000000000000AA`.
- **Base del enlace de verificación:** `https://directoradio.com` en producción, `http://localhost:3000` en desarrollo y el puerto de e2e en las pruebas. Se lee de `SITE_URL` y, si no existe, de `metadataBase`.
- **Migraciones en Neon antes de fusionar** (`HANDOFF.md`). Vitest se lanza con `cmd /c "cd /d C:\PROJECTES\DIRECTORADIO\DIRECTORADIO && npx vitest run …"`, con Docker arrancado. Leer `node_modules/next/dist/docs/` sobre route handlers, Server Actions y `cookies()` antes de escribir.

## Review Focus

1. **El mismo email vota dos veces la misma emisora antes de verificar:** queda un único voto pendiente, con el último número de estrellas y un token nuevo; el enlace del primer email deja de valer. → Task 3.
2. **Dos envíos simultáneos desde la misma IP justo en el límite:** solo pasan los permitidos (bloqueo de asesoramiento). → Task 3 (`Promise.all` de 11 envíos con límite 10 → 10 aceptados).
3. **Email con mayúsculas o espacios** (« Ana@Mail.COM »): cuenta como `ana@mail.com` para el voto único, los límites y la cookie. → Task 2 (`normalizeEmail`) y Task 3.
4. **Enlace de verificación abierto por un escáner de correo** (GET): no consume el token; solo el botón «Confirmar» (POST). → Task 4.
5. **Brevo caído:** el voto pendiente no se queda huérfano, se responde 502 y el intento cuenta para el límite por IP, pero no para el de emails enviados. → Task 3.

---

### Task 1: Tablas y migración

**Files:**
- Modify: `src/db/schema.ts`:
  - enum `rating_status` (`pending`, `verified`);
  - tablas `verified_emails`, `ratings` y `rating_attempts`, con los campos e índices del diseño §5.1, el `CHECK stars BETWEEN 1 AND 5` y la clave foránea `station_id` con `ON DELETE CASCADE`.
- Create: migración (`npm run db:generate`).
- Modify: `tests/helpers/db.ts` (`reset` vacía las tres tablas nuevas) y `e2e/seed.ts` (`TRUNCATE` de las tablas nuevas).
- Test: `tests/db/ratings-schema.test.ts`

**Interfaces:**
- Produces: `ratings`, `verifiedEmails`, `ratingAttempts`, `ratingStatusEnum` y los tipos `Rating`, `NewRating`.

- [ ] **Step 1: Write the failing test**
  - insertar un voto válido y leerlo;
  - `stars: 0` y `stars: 6` lanzan un error con `ratings_stars_check`;
  - dos votos `pending` del mismo `(station_id, email)` violan la unicidad, y uno `pending` más otro `verified` se permiten;
  - borrar la emisora borra sus votos.
- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/db/ratings-schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, ejecutar `npm run db:generate` y revisar el SQL generado: tres `CREATE TABLE`, el `CREATE TYPE`, los índices y el `CHECK`.
- [ ] **Step 4: Run to verify it passes.** El mismo comando y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(db): ratings, verified emails and attempts tables"`

### Task 2: Utilidades: email, token, cookie de votante y servicios externos

**Files:**
- Create: `src/ratings/email.ts`, `src/ratings/token.ts`, `src/ratings/voter-cookie.ts`, `src/ratings/brevo.ts`, `src/ratings/turnstile.ts` y `src/ratings/config.ts`
- Test: `tests/ratings/utils.test.ts`, `tests/ratings/voter-cookie.test.ts` y `tests/ratings/services.test.ts`

**Interfaces:**
- Produces:
  - En `email.ts`: `export function normalizeEmail(raw: unknown): string | null`
  - En `token.ts`:
    - `export function newToken(): { token: string; hash: string }`
    - `export function hashToken(token: string): string`
  - En `voter-cookie.ts`:
    - `export const VOTER_COOKIE = 'dr_voter'`
    - `export function signVoterCookie(email: string, issuedAt: number, secret: string): string`
    - `export function parseVoterCookie(value: string | undefined, secret: string): { email: string; issuedAt: number } | null`: solo comprueba el formato y el HMAC con `timingSafeEqual`, sin la base de datos.
    - `export async function readVoter(db: Db, value: string | undefined, secret: string): Promise<string | null>`: devuelve el email si la firma es válida, el email está en `verified_emails` y `issuedAt >= first_verified_at`.
  - En `brevo.ts`:
    - `export type SendVerification = (msg: { to: string; stationName: string; stars: number; url: string }) => Promise<void>`
    - `export function brevoSender(apiKey: string | undefined, fetchImpl?: typeof fetch): SendVerification`: lanza un error si la respuesta no es 2xx; sin clave, hace el `console.info` de Global Constraints.
  - En `turnstile.ts`: `export async function verifyTurnstile(token: unknown, ip: string | null, secret: string | undefined, fetchImpl?: typeof fetch): Promise<boolean>`. Sin `secret`, devuelve `true` solo si `NODE_ENV !== 'production'`.
  - En `config.ts`:
    - `export function ratingsEnabled(): boolean`
    - `export function siteUrl(): string`

- [ ] **Step 1: Write the failing tests**
  - `normalizeEmail`:
    - `'  Ana@Mail.COM '` → `'ana@mail.com'`;
    - `'sin-arroba'`, `''`, `42` y uno de 255 caracteres → `null`.
  - `newToken()`: el token tiene 43 caracteres en base64url, y `hash === hashToken(token)` con 64 caracteres hexadecimales.
  - **Cookie:**
    - `parseVoterCookie(signVoterCookie('a@b.es', 1000, 's'), 's')` → `{ email: 'a@b.es', issuedAt: 1000 }`;
    - con otro secreto, con la firma alterada en un carácter y con `'basura'` → `null`.
  - **`readVoter`:**
    - email no verificado → `null`;
    - verificado con `first_verified_at` en el momento 2000 y cookie emitida en 1000 → `null`;
    - cookie emitida en 3000 → el email.
  - **`brevoSender('k', fetchMock)`:**
    - llama a la URL de Brevo con la cabecera `api-key: k`;
    - el cuerpo lleva `sender.email = 'no-responder@directoradio.com'`, `to[0].email`, el asunto «Confirma tu valoración de Radio A» y la URL en `htmlContent` y en `textContent`;
    - con una respuesta 500, lanza un error.
  - `brevoSender(undefined)` llama a `console.info` con la URL.
  - **`verifyTurnstile`:**
    - envía `secret`, `response` y `remoteip` como formulario;
    - devuelve `success` de la respuesta JSON;
    - con un token que no es una cadena, devuelve `false` sin llamar a `fetch`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/ratings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ratings): email, token, voter cookie, Brevo and Turnstile helpers"`

### Task 3: `submitRating` (envío, límites y voto directo)

**Files:**
- Create: `src/ratings/submit.ts` y `src/ratings/aggregate.ts`
- Test: `tests/ratings/submit.test.ts`

**Interfaces:**
- Consumes: todo lo de Task 2; `hashIp` y `ipKey` (`src/catalog/plays.ts` y `src/lib/ip-key.ts`).
- Produces:
  - `export const RATING_LIMITS = { ipHour: 10, ipDay: 30, emailDay: 5 } as const`
  - `export type SubmitInput = { stationId: unknown; stars: unknown; email: unknown; acceptedPrivacy: unknown; turnstileToken: unknown }`
  - `export type SubmitDeps = { send: SendVerification; verifyCaptcha: (token: unknown) => Promise<boolean>; voterEmail: string | null; ipHash: string | null; siteUrl: string; now?: Date }`
  - `export type SubmitResult = { status: 'counted'; stationSlug: string } | { status: 'pending'; email: string } | { status: 'invalid' } | { status: 'captcha' } | { status: 'not-found' } | { status: 'rate-limited'; retryAfter: number } | { status: 'send-failed' }`
  - `export async function submitRating(db: Db, input: SubmitInput, deps: SubmitDeps): Promise<SubmitResult>`
  - `export async function recomputeStationRating(tx: Tx, stationId: string): Promise<void>` (en `aggregate.ts`): `rating_avg = round(avg(stars), 2)` y `rating_count = count(*)` de los votos `verified`; con 0 votos, `0` y `0`.

**Orden de `submitRating`** (diseño §5.2):
1. validar los campos: `stationId` es UUID, `stars` es un entero de 1 a 5, el email es válido según `normalizeEmail` y `acceptedPrivacy === true`; si no, `invalid`;
2. `verifyCaptcha`; si falla, `captcha`;
3. en una transacción:
   - bloqueo de asesoramiento por `ip_hash` (o por el email si no hay IP);
   - contar intentos; si se pasa del límite, `rate-limited` con `retryAfter` de 3600;
   - la emisora debe estar activa; si no, `not-found`;
   - insertar el intento, con `sent_email` según la rama;
   - con `voterEmail === email`:
     - borrar el voto `verified` anterior de ese email y emisora e insertar el nuevo como `verified`;
     - borrar el `pending` si lo hay;
     - `recomputeStationRating` → `counted`;
   - si no:
     - comprobar el límite de 5 envíos al día por email; si se pasa, `rate-limited`;
     - insertar o sustituir el `pending` (`ON CONFLICT (station_id, email, status)`) con el token nuevo, las estrellas y el `privacy_accepted_at`;
4. fuera de la transacción, `send(...)`:
   - si falla: borrar ese `pending` (si su `token_hash` sigue siendo el nuevo) y marcar el intento como `sent_email = false` → `send-failed`;
   - si va bien → `pending`.

- [ ] **Step 1: Write the failing tests** (`send` y `verifyCaptcha` como `vi.fn`, contra la base de datos de test):
  - **Validación:** `stars: 0`, `'5'` o `6`, email inválido o `acceptedPrivacy: false` → `invalid`, sin llamar a `send`.
  - **Captcha falso** → `captcha`, sin escribir en `rating_attempts`.
  - **Primer voto sin cookie:**
    - → `pending` con `email: 'ana@mail.com'`, a partir de `'  Ana@Mail.COM '`;
    - `send` recibe una `url` que empieza por `${siteUrl}/valoraciones/verificar?token=`;
    - hay una fila `pending` y la media de la emisora no cambia.
  - **Segundo voto pendiente del mismo email y emisora con 3 estrellas:**
    - sigue habiendo una sola fila `pending`, ahora con 3 estrellas;
    - el `hashToken` del token anterior ya no está en ninguna fila.
  - **Con `voterEmail` igual:**
    - → `counted`, y la media y el recuento de la emisora se actualizan;
    - un segundo voto con 2 estrellas sustituye al primero, con `rating_count` 1 y `rating_avg` 2.
  - **Con `voterEmail` distinto del email enviado** → `pending`, no `counted`.
  - **Emisora desactivada** → `not-found`.
  - **Límites:**
    - el 11.º intento en una hora desde la misma IP → `rate-limited`;
    - el 6.º email de verificación del mismo email en un día, a emisoras distintas y con IP distintas → `rate-limited`.
  - **Simultaneidad:** `Promise.all` de 11 envíos con `voterEmail` desde la misma IP a 11 emisoras → 10 `counted` y 1 `rate-limited`.
  - **`send` que rechaza:**
    - → `send-failed`;
    - no queda ningún `pending`;
    - el intento queda con `sent_email = false`;
    - después, 5 envíos correctos a ese email siguen permitidos.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/ratings/submit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ratings): submit with limits, captcha and direct vote"`

### Task 4: Confirmación, rutas de la API y página de verificación

**Files:**
- Create:
  - `src/ratings/confirm.ts`
  - `src/app/api/valoraciones/route.ts` (POST)
  - `src/app/api/valoraciones/yo/route.ts` (GET)
  - `src/app/valoraciones/verificar/page.tsx`
  - `src/app/valoraciones/verificar/actions.ts` (`'use server'`)
- Modify: `src/i18n/es-ES.ts`
- Test: `tests/ratings/confirm.test.ts`, `tests/app/valoraciones-route.test.ts` y `tests/app/verificar.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 y 3.
- Produces:
  - `export type ConfirmResult = { status: 'confirmed'; email: string; stationSlug: string; stationName: string } | { status: 'invalid' }`
  - `export async function confirmRating(db: Db, token: unknown, now?: Date): Promise<ConfirmResult>`. En una transacción:
    - buscar el voto `pending` por `hashToken(token)` con `token_expires_at > now`;
    - borrar el `verified` anterior del mismo email y emisora;
    - pasar el voto a `verified` y poner `token_hash` y `token_expires_at` a nulo;
    - insertar o actualizar `verified_emails`: `first_verified_at` solo al insertar y `verified_at = now`;
    - y `recomputeStationRating`.
  - En `route.ts`, `POST`:
    - si `!ratingsEnabled()`, 404;
    - cuerpo de como máximo 2 KB en JSON, si no, 400;
    - IP con `clientIpFromHeaders`, `ipKey` y `hashIp(…, PLAYS_IP_SALT)`;
    - `voterEmail` con `readVoter(db, cookies().get(VOTER_COOKIE)?.value, RATINGS_SECRET)`;
    - `submitRating` con `brevoSender(BREVO_API_KEY)` y `verifyTurnstile(…, TURNSTILE_SECRET_KEY)`;
    - **mapeo de estados a respuestas:**

      | Estado | Respuesta |
      |---|---|
      | `counted` | 200 `{status}` |
      | `pending` | 202 `{status, email}` |
      | `invalid` | 400 |
      | `captcha` | 400 `{status:'captcha'}` |
      | `not-found` | 404 |
      | `rate-limited` | 429 con `Retry-After` |
      | `send-failed` | 502 |

    - en `counted`, `revalidatePath('/emisora/' + result.stationSlug)`.
  - En `yo/route.ts`, `GET`: `{ email: string | null }` con `Cache-Control: no-store`; 404 si está desactivado.
  - En `actions.ts`, `export async function confirmAction(formData: FormData): Promise<ConfirmResult>`:
    - llama a `confirmRating`;
    - si confirma, pone la cookie `signVoterCookie(email, Date.now(), secret)` con los atributos de Global Constraints;
    - y `revalidatePath('/emisora/<slug>')`.
  - **`page.tsx`:**
    - si está desactivado: «Las valoraciones no están disponibles»;
    - si no hay token: un mensaje de enlace no válido;
    - si hay token: un formulario POST con el token oculto y el botón «Confirmar mi valoración»;
    - tras la acción: «Tu valoración de {emisora} ya cuenta», con un enlace a la ficha, o «Este enlace no es válido o ha caducado. Puedes volver a valorar desde la ficha de la emisora.»;
    - `robots: { index: false }`.

- [ ] **Step 1: Write the failing tests**
  - **`confirmRating`:**
    - con un token válido → `confirmed`; el voto pasa a `verified`, la media se actualiza y `verified_emails` tiene `first_verified_at`;
    - el mismo token otra vez → `invalid`;
    - un token caducado (`now` de 25 h después) → `invalid`;
    - un token desconocido → `invalid`;
    - si había un voto `verified` anterior de 2 estrellas y se confirma uno `pending` de 5, queda un solo `verified` de 5;
    - al confirmar por segunda vez otro voto del mismo email, `first_verified_at` no cambia.
  - **Ruta POST** (llamando a la función `POST` con un `Request`, con `vi.stubEnv` y Turnstile y Brevo simulados vía `fetch`):
    - con `RATINGS_ENABLED` distinto de `true` → 404;
    - cuerpo de 3 KB → 400;
    - un voto válido sin cookie → 202 `{ status: 'pending', email }`;
    - con la cookie firmada de un email verificado → 200 `{ status: 'counted' }`.
  - **Ruta GET `/yo`:** sin cookie → `{ email: null }`; con cookie válida → `{ email }`; cabecera `no-store`.
  - **Página de verificación:**
    - un GET con token no confirma (el voto sigue `pending` tras renderizar) y muestra el botón «Confirmar mi valoración»;
    - `confirmAction` con el token confirma.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/ratings/confirm.test.ts tests/app/valoraciones-route.test.ts tests/app/verificar.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ratings): confirm flow, API routes and verification page"`

### Task 5: Formulario de valoración en la ficha

**Files:**
- Create: `src/components/ratings/RatingForm.tsx` (`'use client'`) y `src/components/ratings/Turnstile.tsx` (`'use client'`)
- Modify:
  - `src/components/StationDetail.tsx`: prop `ratingsEnabled: boolean`; el bloque va tras el reproductor y antes de las similares;
  - `src/app/emisora/[slug]/page.tsx`: pasa `ratingsEnabled()`;
  - `src/i18n/es-ES.ts`.
- Test: `tests/components/ratings/RatingForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/valoraciones` y `GET /api/valoraciones/yo` (Task 4).
- Produces: `export function RatingForm({ stationId, stationName }: { stationId: string; stationName: string }): JSX.Element`

**Comportamiento:**
- **Paso 1:**
  - `role="radiogroup"` con el nombre «Valora esta emisora»;
  - 5 `role="radio"` con los nombres «1 estrella» y «2 estrellas»… «5 estrellas», y un área táctil de al menos 40 px;
  - las flechas mueven la selección.
- **Paso 2**, al elegir una estrella:
  - email de tipo `email`, rellenado con `/yo`;
  - casilla «He leído y acepto la política de privacidad», con enlace a `/privacidad`, y debajo, en pequeño, el texto del diseño §5.8;
  - el widget de Turnstile (`Turnstile.tsx` carga `https://challenges.cloudflare.com/turnstile/v0/api.js` con `next/script` y pinta un `<div class="cf-turnstile" data-sitekey=…>` invisible);
  - el botón «Enviar valoración», desactivado mientras se envía.
- **Mensajes por respuesta:**

  | Respuesta | Mensaje |
  |---|---|
  | 202 | «Te hemos enviado un email a {email}. Pulsa el enlace para que tu valoración cuente (caduca en 24 horas).» |
  | 200 | «¡Gracias! Tu valoración ya cuenta.» |
  | 429 | «Has hecho demasiados intentos. Vuelve a probar más tarde.» |
  | 400 captcha | «No hemos podido comprobar que no eres un robot. Recarga la página e inténtalo de nuevo.» |
  | 502 | «No hemos podido enviar el email. Inténtalo de nuevo en unos minutos.» |
  | otro error | «Algo ha fallado. Inténtalo de nuevo.» |

  Los mensajes van en `role="status"` o `role="alert"`.
- **Validación en el cliente:** sin aceptar la casilla o sin email válido, no se envía y se marca el campo.

- [ ] **Step 1: Write the failing tests** (con `fetch` simulado):
  - el formulario no aparece hasta elegir una estrella;
  - las flechas mueven la selección (`aria-checked`);
  - el email se rellena con la respuesta de `/yo`;
  - el envío manda el JSON correcto (`stationId`, `stars`, email, `acceptedPrivacy: true` y `turnstileToken`, leído del campo `cf-turnstile-response` del formulario);
  - cada código de respuesta muestra su mensaje;
  - sin la casilla no hay `fetch`;
  - `StationDetail` con `ratingsEnabled={false}` no pinta el bloque.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/ratings tests/components/StationDetail.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando y `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ratings): two-step rating form on the station page"`

### Task 6: Limpieza diaria y borrado a petición

**Files:**
- Create: `src/ratings/maintenance.ts` y `src/jobs/forget-email.ts`
- Modify: `src/jobs/daily.ts` (fase `ratings-prune` tras `prune`), `package.json` (`"ratings:forget": "tsx src/jobs/forget-email.ts"`), `scripts/build-services.mjs` (si empaqueta los trabajos por nombre, añadir `forget-email`) y `docs/superpowers/HANDOFF.md` (procedimiento de borrado).
- Test: `tests/ratings/maintenance.test.ts`

**Interfaces:**
- Produces:
  - `export async function pruneRatings(db: Db, now?: Date): Promise<{ pendingDeleted: number; attemptsDeleted: number; ipHashesCleared: number }>`: votos `pending` de más de 7 días, intentos de más de 48 h, y `ip_hash = null` en votos de más de 35 días.
  - `export async function forgetEmail(db: Db, rawEmail: string): Promise<{ ratings: number; attempts: number; verifiedEmail: boolean; stations: number }>`: en una transacción, borra los votos (y recalcula la media de cada emisora afectada), los intentos y la fila de `verified_emails`.

- [ ] **Step 1: Write the failing tests**
  - **`pruneRatings`**, con filas de distintas antigüedades:
    - borra justo lo que debe;
    - no toca los votos `verified`;
    - y vacía `ip_hash` solo en los de más de 35 días.
  - **`forgetEmail(' Ana@Mail.com ')`:**
    - borra sus 2 votos en 2 emisoras, sus intentos y su fila verificada;
    - las medias de esas 2 emisoras se recalculan;
    - otro email no se toca;
    - una cookie antigua de ese email deja de valer: `readVoter` → `null`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/ratings/maintenance.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** El script imprime el resultado en JSON y sale con 1 si el email no es válido.
- [ ] **Step 4: Run to verify they pass.** El mismo comando, `npm test` y `npm run build:services`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ratings): daily prune and forget-email script"`

### Task 7: Textos legales y pie

**Files:**
- Create:
  - `src/legal/owner.ts`: `export const OWNER = { name: 'PENDIENTE', nif: 'PENDIENTE', address: 'PENDIENTE', email: 'amadeurm@gmail.com', domain: 'directoradio.com' } as const` y `export function ownerMissing(): string[]`, que devuelve los campos que valen `'PENDIENTE'`.
  - `src/app/aviso-legal/page.tsx` y `src/app/privacidad/page.tsx`.
  - `src/legal/guard.ts`: `export function assertLegalReady(env = process.env): void`. Lanza `Error('Faltan datos del titular en src/legal/owner.ts: …')` si `env.RATINGS_ENABLED === 'true'`, `env.ALLOW_PENDING_LEGAL !== 'true'` y `ownerMissing()` no está vacío. `ALLOW_PENDING_LEGAL` solo se usa en Playwright (Task 8).
- Modify:
  - `next.config.ts`: llama a `assertLegalReady()` al cargarse, de modo que `next build` falla;
  - `src/app/politica-de-cookies/page.tsx`: el apartado «Responsable» muestra `OWNER` y se añade la fila `dr_voter` («Recuerda en este navegador el email con el que ya verificaste una valoración», 12 meses);
  - `src/components/SiteFooter.tsx`: enlaces «Aviso legal» (`/aviso-legal`) y «Privacidad» (`/privacidad`);
  - `src/i18n/es-ES.ts`.
- Test: `tests/legal/legal.test.tsx` y `e2e/catalog.spec.ts`

**Contenido mínimo** (diseño §5.8):
- **Aviso legal:**
  - titular (nombre, NIF, domicilio y email);
  - objeto;
  - condiciones de uso;
  - propiedad intelectual (logotipos y marcas de terceros, y datos de Radio-Browser);
  - exclusión de responsabilidad sobre los streams;
  - legislación española.
- **Privacidad:**
  - responsable;
  - datos;
  - finalidades y bases;
  - conservación (las seis cifras del diseño);
  - encargados (Brevo, Neon, Vercel, Fly.io, Cloudflare y Google), con la nota de transferencias;
  - derechos y email;
  - AEPD.
- **Ambas páginas** terminan con «Última actualización: 14 de noviembre de 2026».

- [ ] **Step 1: Write the failing tests**
  - **`/aviso-legal`:** tiene un `h1` «Aviso legal» y contiene `OWNER.email` y `OWNER.nif`.
  - **`/privacidad`:**
    - tiene un `h1` «Política de privacidad»;
    - contiene «Brevo», «48 horas», «7 días», «35 días», «Agencia Española de Protección de Datos» y `OWNER.email`.
  - **La política de cookies** contiene `dr_voter` y `OWNER.email`.
  - **`ownerMissing()`** devuelve `['name', 'nif', 'address']`.
  - **`assertLegalReady`:**
    - con `{ RATINGS_ENABLED: 'true' }` lanza un error con «name, nif, address»;
    - con `{}` no lanza;
    - con `{ RATINGS_ENABLED: 'true', ALLOW_PENDING_LEGAL: 'true' }` no lanza.
  - **E2E:** el pie enlaza a `/aviso-legal` y `/privacidad`, y las dos páginas responden 200.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/legal`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando, `npm test`, `npm run lint` y `npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(legal): legal notice, privacy policy and footer links"`

### Task 8: E2E del flujo completo y documentación

**Files:**
- Modify:
  - `playwright.config.ts`: el `webServer.env` del build añade:
    - `RATINGS_ENABLED: 'true'`, `RATINGS_SECRET: 'e2e-secret'`;
    - `NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'`, `TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA'`;
    - `SITE_URL: 'http://localhost:3100'`;
    - y sin `BREVO_API_KEY`.

    Además, `ALLOW_PENDING_LEGAL: 'true'` (Task 7), porque el guardia de `PENDIENTE` impediría el build con `RATINGS_ENABLED=true`.
  - `e2e/ratings.spec.ts`: lee el enlace de verificación del log del servidor.

    Playwright no expone el stdout del `webServer`, así que en desarrollo (sin `BREVO_API_KEY` y fuera de producción real) el enlace también se guarda en `.next/cache/last-verification-url.txt`, y el test lo lee (decisión del plan).
  - `docs/superpowers/HANDOFF.md`:
    - variables nuevas en Vercel;
    - alta de Brevo y DNS en Cloudflare («DNS only»);
    - claves de Turnstile;
    - rellenar `owner.ts`;
    - revisión legal;
    - y cómo activar.
- Test: `e2e/ratings.spec.ts`

- [ ] **Step 1: Write the failing e2e** `ratings.spec.ts`:
  - en `/emisora/cadena-ser`:
    - pulsar «4 estrellas»;
    - escribir `e2e@example.com`, marcar la casilla y pulsar «Enviar valoración»;
    - aparece «Te hemos enviado un email a e2e@example.com»;
  - leer la URL, abrirla y pulsar «Confirmar mi valoración» → «Tu valoración de Cadena SER ya cuenta»;
  - volver a la ficha (recargar): se ve «4,0 (1 valoración)»;
  - votar 2 estrellas otra vez en la misma ficha → «¡Gracias! Tu valoración ya cuenta.» (cookie);
  - tras recargar: «2,0 (1 valoración)».
- [ ] **Step 2: Run to verify it fails.** Run: `npm run test:e2e`. Expected: FAIL.
- [ ] **Step 3: Implement** (configuración, `ALLOW_PENDING_LEGAL` y el archivo del último enlace en `brevoSender` sin clave).
- [ ] **Step 4: Run to verify it passes.** `npm test`, `npm run lint` y `npm run test:e2e`. Expected: todo PASS.
- [ ] **Step 5: Commit** `git commit -m "test(ratings): end-to-end rating flow; docs: activation checklist"`
