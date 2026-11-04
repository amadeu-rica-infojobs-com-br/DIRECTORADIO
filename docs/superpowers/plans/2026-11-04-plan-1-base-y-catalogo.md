# Plan 1 — Base y catálogo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web Next.js funcionando en local con el catálogo de Radio-Browser importado en PostgreSQL, comprobación de emisoras caídas, portada en cuadrícula ordenada por las más escuchadas y ficha de emisora con reproductor para streams `https`.

**Architecture:** Un único proyecto Next.js (App Router, TypeScript) en la raíz del repo. Acceso a datos con Drizzle sobre PostgreSQL (`pgvector` ya en la imagen para el plan 3). La importación y la comprobación de salud son scripts Node (`tsx`) que se ejecutan como trabajos programados, independientes de la web. La lógica de catálogo vive en `src/catalog/` como funciones puras o funciones que reciben `db`, para poder testearlas sin Next.

**Tech Stack:** Node 24, Next.js (última estable, App Router, `src/`), TypeScript estricto, Tailwind CSS, Drizzle ORM + `postgres` (postgres-js) + drizzle-kit, PostgreSQL 17 con pgvector (Docker `pgvector/pgvector:pg17`), Vitest + Testing Library (jsdom), Playwright, `tsx`.

**Spec:** [docs/superpowers/specs/2026-11-04-directoradio-v1-design.md](../specs/2026-11-04-directoradio-v1-design.md) — secciones 6.1–6.4, 6.6 (sin valoración ni similares), 6.7 (solo `https`), 6.10 (solo `/emisora/{slug}` e i18n), 7 y 8.

**Fuera de este plan (planes 2–5):** proxy `http`, `hls.js`, mini-reproductor persistente, contador de reproducciones y ranking propio de 30 días (plan 2, que también incluye el despliegue); embeddings, descripciones IA, buscador y similares (plan 3); valoraciones y textos legales (plan 4); páginas género/país, sitemap, schema.org (plan 5).

## Global Constraints

- Interfaz solo en español de España; todo texto visible sale de `src/i18n/es-ES.ts`.
- Géneros (lista cerrada, en este orden de prioridad): `pop, electronica, rock, jazz, clasica, variada, noticias, deportes, generalista`. Etiquetas visibles: Pop, Electrónica, Rock, Jazz, Clásica, Variada, Noticias, Deportes, Generalista.
- Género por defecto si ningún tag tiene correspondencia: `variada`.
- Status: `activa | desactivada | eliminada`. Solo `activa` aparece en listados y fichas; el resto devuelve 404.
- Una emisora está **oculta por salud** cuando `health_consecutive_failures >= 3` (`HEALTH_HIDE_THRESHOLD = 3`): no sale en la portada, su ficha sí, con aviso.
- Portada (mientras no haya ranking propio): primero `country_code = 'ES'`, luego el resto; dentro de cada grupo `rb_click_count DESC`, desempate por `name ASC`. 48 emisoras por página, paginación `?pagina=N`.
- Dirección de ficha: `/emisora/{slug}`; slug único, minúsculas, ASCII, guiones.
- Campos protegidos por edición manual: valores `'description'`, `'logoUrl'`, `'genre'` en la columna `manualFields`. La sincronización nunca sobrescribe un campo listado ahí.
- Las emisoras que desaparecen de Radio-Browser pasan a `desactivada`, nunca se borran.
- Peticiones a Radio-Browser con cabecera `User-Agent: DirectoRadio/0.1 (+https://directoradio.com)`.
- Ninguna petición del servidor a una URL de emisora sin pasar antes por `isPublicHttpUrl`.
- Secretos solo en `.env.local` (git-ignorado); `.env.example` documenta las variables.

## Review Focus

1. **Radio-Browser caído o con respuesta parcial** → no debe desactivar medio catálogo. Si el lote recibido tiene menos del 50 % de las emisoras RB activas en BD, no se desactiva ninguna (Task 5, test `skips deactivation when batch is suspiciously small`).
2. **Nombre de emisora sin caracteres latinos** ("Радио Рекорд", "📻📻") → slug vacío; debe caer a `emisora-{8 primeros caracteres del uuid externo}` (Task 3 y Task 5, test `falls back when slug is empty`).
3. **URL de stream que apunta a red privada** (`http://192.168.1.10/stream`, `http://localhost:8000`, dominio que resuelve a `10.x`) → la comprobación de salud la cuenta como fallo sin conectarse (Task 6, test `never fetches private addresses`).
4. **Logotipo ausente, roto o `http`** → la tarjeta y la ficha muestran un marcador con la inicial, nunca un icono de imagen rota (Task 8, test `shows initial when logo fails`).
5. **Emisora con stream `http`** en la ficha → no se muestra un reproductor que falla; se muestra el aviso «Esta emisora estará disponible muy pronto en DirectoRadio» (Task 9, test `shows notice for http streams`).

---

### Task 1: Esqueleto del proyecto, repositorio y entorno de pruebas

**Files:**
- Create: `.gitignore`, `package.json` (vía create-next-app), `docker-compose.yml`, `docker/init-test-db.sql`, `.env.example`, `vitest.config.ts`, `drizzle.config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `start`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `job:sync`, `job:health`; variables `DATABASE_URL`, `DATABASE_URL_TEST`.

- [ ] **Step 1:** `git init` en `C:\PROJECTS\DIRECTORADIO`. Crear el proyecto Next en la raíz sin pisar `docs/`: `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (si se queja de carpeta no vacía, generar en `tmp-next/` y mover el contenido a la raíz).
- [ ] **Step 2:** Añadir a `.gitignore`: `.superpowers/`, `.env.local`, `playwright-report/`, `test-results/`.
- [ ] **Step 3:** Instalar dependencias: `npm i drizzle-orm postgres` y `npm i -D drizzle-kit tsx vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test`.
- [ ] **Step 4:** `docker-compose.yml` con servicio `db` (`pgvector/pgvector:pg17`, puerto `5432`, usuario/contraseña `directoradio`, base `directoradio`) montando `docker/init-test-db.sql`, que crea la base `directoradio_test`.
- [ ] **Step 5:** `.env.example`:
  ```
  DATABASE_URL=postgres://directoradio:directoradio@localhost:5432/directoradio
  DATABASE_URL_TEST=postgres://directoradio:directoradio@localhost:5432/directoradio_test
  RADIO_BROWSER_BASE_URL=https://de1.api.radio-browser.info
  ```
  Copiarlo a `.env.local`.
- [ ] **Step 6:** `vitest.config.ts`: plugin react, alias `@` → `src`, `include: ['tests/**/*.test.{ts,tsx}']`, `fileParallelism: false` (los tests de BD comparten base), `setupFiles: ['tests/setup.ts']` (importa `@testing-library/jest-dom/vitest`). `drizzle.config.ts`: dialect `postgresql`, schema `src/db/schema.ts`, out `drizzle/`.
- [ ] **Step 7:** Test `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`. Run: `docker compose up -d; npm test` → Expected: 1 passed. Run: `npm run build` → Expected: build OK.
- [ ] **Step 8:** Commit `chore: scaffold Next.js project with Drizzle, Vitest and Postgres`.

---

### Task 2: Esquema de base de datos y helper de BD de pruebas

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `drizzle/*` (generado), `tests/helpers/db.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Produces:
  - `genreEnum` (pgEnum `genre`, valores de Global Constraints), `statusEnum` (pgEnum `station_status`).
  - Tabla `stations`: `id uuid pk default random`, `slug text unique not null`, `name text not null`, `description text`, `descriptionGenerated boolean default false`, `logoUrl text`, `streamUrl text not null`, `homepageUrl text`, `countryCode varchar(2)`, `languages text[] default '{}'`, `genre genre not null default 'variada'`, `status station_status not null default 'activa'`, `source text not null`, `externalId text`, `rbClickCount integer default 0`, `playCount integer default 0`, `ratingAvg numeric(3,2) default 0`, `ratingCount integer default 0`, `healthLastCheckedAt timestamptz`, `healthLastOk boolean`, `healthConsecutiveFailures integer default 0`, `manualFields text[] default '{}'`, `createdAt timestamptz default now`, `updatedAt timestamptz default now`. Índice único `(source, externalId)`.
  - `tags` (`id serial pk`, `name text unique`), `stationTags` (`stationId uuid fk cascade`, `tagId integer fk cascade`, pk compuesta), `tagGenres` (`tag text pk`, `genre genre`).
  - `type Station = typeof stations.$inferSelect`, `type NewStation = typeof stations.$inferInsert`.
  - `getDb(url?: string): Db` (por defecto `process.env.DATABASE_URL`), `type Db`.
  - `runMigrations(url: string): Promise<void>` en `src/db/migrate.ts` (también ejecutable: `npm run db:migrate`).
  - Test helper `createTestDb(): Promise<{ db: Db; reset(): Promise<void>; close(): Promise<void> }>` — migra `DATABASE_URL_TEST` una vez y `reset()` hace `TRUNCATE stations, tags, station_tags, tag_genres RESTART IDENTITY CASCADE`.

- [ ] **Step 1: Test** `tests/db/schema.test.ts`:
  - `inserts and reads a station with defaults` → insertar `{slug:'cadena-ser', name:'Cadena SER', streamUrl:'https://x/ser', source:'radio-browser', externalId:'u1'}`; leer; `status === 'activa'`, `genre === 'variada'`, `healthConsecutiveFailures === 0`, `manualFields` igual a `[]`.
  - `rejects duplicate source+externalId` → segundo insert con mismo `source/externalId` y otro slug lanza error.
- [ ] **Step 2:** Run `npm test -- tests/db` → FAIL (módulos no existen).
- [ ] **Step 3:** Implementar schema, client, migrate y helper; `npm run db:generate` para crear la migración.
- [ ] **Step 4:** Run `npm test -- tests/db` → PASS.
- [ ] **Step 5:** Commit `feat(db): add catalog schema and test database helper`.

---

### Task 3: Utilidades puras — tags, slug, géneros, país

**Files:**
- Create: `src/lib/tags.ts`, `src/lib/slug.ts`, `src/lib/genres.ts`, `src/lib/country.ts`, `tests/lib/*.test.ts`

**Interfaces:**
- Produces:
  - `normalizeTags(raw: string | null | undefined): string[]` — separa por comas, `trim`, minúsculas, colapsa espacios internos, descarta vacíos y de más de 50 caracteres, sin duplicados, conserva el orden de aparición.
  - `slugify(name: string): string` — quita diacríticos (NFD), minúsculas, todo lo no `[a-z0-9]` → `-`, colapsa y recorta guiones; puede devolver `''`.
  - `uniqueSlug(base: string, fallback: string, exists: (s: string) => Promise<boolean>): Promise<string>` — usa `fallback` si `base` es `''`; si existe, prueba `-2`, `-3`…
  - `GENRES` (tupla `as const` en el orden de prioridad), `type Genre`, `GENRE_LABELS: Record<Genre, string>`.
  - `resolveGenre(tags: string[], mapping: Map<string, Genre>): Genre` — cuenta un voto por tag mapeado; gana el género con más votos; empate → el que aparece antes en `GENRES`; sin votos → `'variada'`.
  - `countryName(code: string | null): string` (vía `Intl.DisplayNames('es', { type: 'region' })`, `''` si nulo o inválido), `flagEmoji(code: string | null): string` (`''` si nulo).

- [ ] **Step 1: Tests:**
  - `normalizeTags(' Pop, top 40 ,POP,,  news  talk ')` → `['pop', 'top 40', 'news talk']`; `normalizeTags(null)` → `[]`.
  - `slugify('Cadena SER')` → `'cadena-ser'`; `slugify('Ràdio Nacional d\'Andorra')` → `'radio-nacional-d-andorra'`; `slugify('Радио Рекорд')` → `''`.
  - `falls back when slug is empty`: `uniqueSlug('', 'emisora-1a2b3c4d', async () => false)` → `'emisora-1a2b3c4d'`.
  - `uniqueSlug('los-40', 'x', async s => s === 'los-40' || s === 'los-40-2')` → `'los-40-3'`.
  - `resolveGenre(['fado','news','noticias','rock'], map{news→noticias, noticias→noticias, rock→rock})` → `'noticias'`; empate `['rock','pop']` con ambos mapeados → `'pop'`; `resolveGenre(['fado'], new Map())` → `'variada'`.
  - `countryName('ES')` → `'España'`; `flagEmoji('ES')` → `'🇪🇸'`; `countryName(null)` → `''`.
- [ ] **Step 2:** Run `npm test -- tests/lib` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test -- tests/lib` → PASS.
- [ ] **Step 5:** Commit `feat(lib): add tag, slug, genre and country helpers`.

---

### Task 4: Cliente y mapeo de Radio-Browser

**Files:**
- Create: `src/catalog/radio-browser/types.ts`, `src/catalog/radio-browser/client.ts`, `src/catalog/radio-browser/map.ts`, `tests/catalog/radio-browser.test.ts`

**Interfaces:**
- Produces:
  - `type RbStation = { stationuuid: string; name: string; url: string; url_resolved: string; homepage: string; favicon: string; tags: string; countrycode: string; language: string; clickcount: number; lastcheckok: number }`.
  - `fetchAllStations(opts?: { baseUrl?: string; pageSize?: number; fetchImpl?: typeof fetch }): Promise<RbStation[]>` — `GET {baseUrl}/json/stations?hidebroken=true&order=clickcount&reverse=true&limit={pageSize}&offset={n}` (por defecto `pageSize = 10000`, `baseUrl` = `RADIO_BROWSER_BASE_URL`) hasta recibir una página más corta que `pageSize`; envía el `User-Agent` de Global Constraints; lanza error si la respuesta no es 2xx.
  - `type MappedStation = { externalId: string; name: string; streamUrl: string; homepageUrl: string | null; logoUrl: string | null; countryCode: string | null; languages: string[]; tags: string[]; rbClickCount: number }`.
  - `mapRbStation(rb: RbStation): MappedStation | null` — `null` si nombre vacío tras `trim` o sin URL `http(s)`; `streamUrl = url_resolved || url`; cadenas vacías → `null`; `countryCode` en mayúsculas o `null`; `languages = normalizeTags(language)`; `tags = normalizeTags(tags)`.

- [ ] **Step 1: Tests** (con `fetchImpl` simulado):
  - `paginates until a short page` → páginas de 2, 2, 1 con `pageSize: 2` → 5 emisoras y 3 llamadas con `offset` 0, 2, 4.
  - `sends the DirectoRadio user agent` → la cabecera `User-Agent` de cada llamada coincide con la de Global Constraints.
  - `throws on non-2xx` → respuesta 503 → rechaza.
  - `prefers url_resolved` y `returns null without name or http url` (`url: 'rtsp://x'`, `url_resolved: ''` → `null`).
- [ ] **Step 2:** Run `npm test -- tests/catalog/radio-browser` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(catalog): add Radio-Browser client and station mapper`.

---

### Task 5: Sincronización del catálogo y semilla tag → género

**Files:**
- Create: `src/catalog/sync.ts`, `src/catalog/seed/tag-genres.ts`, `src/jobs/sync.ts`, `tests/catalog/sync.test.ts`

**Interfaces:**
- Consumes: `fetchAllStations`, `mapRbStation`, `resolveGenre`, `slugify`, `uniqueSlug`, schema de Task 2.
- Produces:
  - `TAG_GENRE_SEED: Record<string, Genre>` — semilla inicial (ver Step 3).
  - `seedTagGenres(db: Db): Promise<void>` — inserta la semilla sin pisar filas existentes (`ON CONFLICT DO NOTHING`).
  - `type SyncReport = { inserted: number; updated: number; deactivated: number; skippedDuplicates: number; skippedInvalid: number; deactivationSkipped: boolean }`.
  - `syncCatalog(db: Db, rb: RbStation[]): Promise<SyncReport>`.
  - Job `npm run job:sync` = `tsx src/jobs/sync.ts`: `seedTagGenres` → `fetchAllStations` → `syncCatalog` → imprime el informe como JSON; código de salida 1 si algo lanza error.

Reglas de `syncCatalog`:
1. Mapear y descartar los `null` (`skippedInvalid`).
2. **Duplicados:** dentro del lote, si dos emisoras comparten `streamUrl` (comparación sin barra final y en minúsculas), se queda la de mayor `rbClickCount` (`skippedDuplicates`).
3. Cargar `tagGenres` en un `Map` y calcular `genre = resolveGenre(tags, map)`.
4. **Nueva** (`source = 'radio-browser'` + `externalId` no existe): insertar con `status 'activa'` y slug `uniqueSlug(slugify(name), 'emisora-' + externalId.slice(0, 8), …)`.
5. **Existente:** actualizar `name`, `streamUrl`, `homepageUrl`, `countryCode`, `languages`, `rbClickCount`, `updatedAt`, y también `logoUrl` y `genre` **salvo que** estén en `manualFields`. No se cambia nunca `slug` ni `status`.
6. Reemplazar los tags de la emisora: borrar los de `stationTags` e insertar los nuevos, creando en `tags` los que falten.
7. **Desactivación:** las emisoras `radio-browser` con status `activa` cuyo `externalId` no viene en el lote pasan a `desactivada`, **salvo que** el lote válido tenga menos del 50 % de las emisoras `radio-browser` activas en BD. En ese caso no se desactiva ninguna y `deactivationSkipped = true`.
8. Hacerlo en lotes de 500 dentro de transacciones (50.000 emisoras).

- [ ] **Step 1: Tests** (BD de pruebas, entrada `RbStation[]` construida a mano):
  - `inserts new stations with genre from tags` → tags `'news,talk'` con semilla `news→noticias` → `genre 'noticias'`, `status 'activa'`, slug `cadena-ser`, tags guardados `['news','talk']`.
  - `falls back when slug is empty` → nombre `'Радио Рекорд'`, uuid `'1a2b3c4d-…'` → slug `'emisora-1a2b3c4d'`.
  - `keeps slugs unique` → dos nombres `'Los 40'` con uuid distinto y distinta URL → `los-40` y `los-40-2`.
  - `does not overwrite manual fields` → existente con `manualFields ['logoUrl','genre']`; el lote trae otro logotipo y otros tags → `logoUrl` y `genre` sin cambios, `name` actualizado.
  - `deactivates stations missing from the batch` → 4 en BD, el lote trae 3 → la que falta queda `desactivada`.
  - `skips deactivation when batch is suspiciously small` → 10 en BD, el lote trae 4 → ninguna desactivada, `deactivationSkipped === true`.
  - `drops duplicate stream urls keeping the most clicked` → dos con la misma URL (una con barra final), clics 5 y 50 → se guarda la de 50; `skippedDuplicates === 1`.
- [ ] **Step 2:** Run `npm test -- tests/catalog/sync` → FAIL.
- [ ] **Step 3:** Implementar. `TAG_GENRE_SEED` incluye como mínimo:
  - **pop:** pop, top 40, hits, charts, pop music, latin pop
  - **electronica:** electronic, electronica, dance, house, techno, trance, edm, chillout, lounge
  - **rock:** rock, classic rock, hard rock, metal, heavy metal, indie, alternative, punk
  - **jazz:** jazz, smooth jazz, blues, soul, swing
  - **clasica:** classical, clasica, clásica, opera, baroque, symphony
  - **variada:** variety, oldies, 80s, 90s, adult contemporary, misc
  - **noticias:** news, noticias, information, informativos, news talk
  - **deportes:** sports, sport, deportes, football, futbol, fútbol
  - **generalista:** talk, generalista, public radio, community radio, culture
- [ ] **Step 4:** Run → PASS. Run manual: `npm run db:migrate; npm run job:sync` → imprime el informe con `inserted` > 30000.
- [ ] **Step 5:** Commit `feat(catalog): sync stations from Radio-Browser`.

---

### Task 6: Guardia de URLs públicas y comprobación de salud

**Files:**
- Create: `src/lib/net/public-url.ts`, `src/catalog/health.ts`, `src/jobs/health.ts`, `tests/lib/public-url.test.ts`, `tests/catalog/health.test.ts`

**Interfaces:**
- Produces:
  - `type Lookup = (host: string) => Promise<string[]>` (por defecto, `dns.promises.lookup` con `all: true`).
  - `isPublicHttpUrl(url: string, lookup?: Lookup): Promise<boolean>` — `false` si el protocolo no es `http:`/`https:`, o si **alguna** IP resuelta es loopback, privada (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10), ULA (fc00::/7), `0.0.0.0/8`, CGNAT (100.64/10) o `::1`.
  - `HEALTH_HIDE_THRESHOLD = 3`.
  - `checkStream(url: string, opts?: { timeoutMs?: number; fetchImpl?: typeof fetch; lookup?: Lookup }): Promise<boolean>` — `false` si `!isPublicHttpUrl`; `GET` con `AbortController` (8000 ms por defecto) y `redirect: 'manual'`, siguiendo como máximo 3 redirecciones y revalidando cada destino con `isPublicHttpUrl`. Da `true` si la respuesta es 2xx con `content-type` que empieza por `audio/`, o es `application/ogg`, `application/vnd.apple.mpegurl` o `application/x-mpegurl`. Cancela el cuerpo nada más leer las cabeceras.
  - `runHealthCheck(db: Db, opts?: { concurrency?: number; check?: (url: string) => Promise<boolean> }): Promise<{ checked: number; ok: number; failed: number }>` — recorre las emisoras `activa` (concurrencia 20 por defecto); si va bien, `healthLastOk = true` y `healthConsecutiveFailures = 0`; si falla, `healthLastOk = false` y suma 1; siempre actualiza `healthLastCheckedAt`.
  - Job `npm run job:health` = `tsx src/jobs/health.ts`.

- [ ] **Step 1: Tests:**
  - `never fetches private addresses` → `checkStream('http://localhost:8000/s', { fetchImpl: spy })`, `'http://192.168.1.10/s'` y un dominio cuyo `lookup` simulado devuelve `['10.0.0.5']` → todos `false` y `spy` nunca llamado.
  - `rejects redirect to private address` → primera respuesta 302 con `Location: http://127.0.0.1/` → `false`.
  - `accepts audio content types` → `audio/mpeg` → `true`; `text/html` → `false`; error de timeout → `false`.
  - `runHealthCheck updates counters` (BD) → emisora con 2 fallos y `check` que falla → 3 fallos y `healthLastOk false`; otra con 2 fallos y `check` que acierta → 0 fallos.
- [ ] **Step 2:** Run `npm test -- tests/lib/public-url tests/catalog/health` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(catalog): add SSRF-safe stream health check`.

---

### Task 7: Consultas de portada y ficha

**Files:**
- Create: `src/catalog/queries.ts`, `tests/catalog/queries.test.ts`

**Interfaces:**
- Consumes: schema de Task 2, `HEALTH_HIDE_THRESHOLD`.
- Produces:
  - `type StationCardData = { slug: string; name: string; logoUrl: string | null; countryCode: string | null; genre: Genre; ratingAvg: number; ratingCount: number }`.
  - `type StationDetailData = StationCardData & { description: string | null; streamUrl: string; homepageUrl: string | null; languages: string[]; tags: string[]; playCount: number; isHealthHidden: boolean }`.
  - `HOME_PAGE_SIZE = 48`.
  - `getHomeStations(db: Db, page: number): Promise<{ items: StationCardData[]; total: number; page: number; pageCount: number }>` — solo `activa` y con `healthConsecutiveFailures < 3`, en el orden de Global Constraints; `page` menor que 1 o no numérico → 1; `page` mayor que `pageCount` → lista vacía con ese `page`.
  - `getStationBySlug(db: Db, slug: string): Promise<StationDetailData | null>` — `null` si no existe o no está `activa`; los tags van ordenados alfabéticamente.

- [ ] **Step 1: Tests:**
  - `orders Spanish stations first then by clicks` → ES 10 clics, FR 1000, ES 500, PT 50 → orden ES500, ES10, FR1000, PT50.
  - `hides inactive and unhealthy stations from home` → `desactivada`, `eliminada` y una con 3 fallos no aparecen; `total` las excluye.
  - `paginates by 48` → 50 emisoras → página 2 con 2 elementos y `pageCount` 2.
  - `returns detail for unhealthy active station` → con 3 fallos devuelve `isHealthHidden: true`.
  - `returns null for desactivada` → `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(catalog): add home ranking and station detail queries`.

---

### Task 8: Maquetación base, textos y portada en cuadrícula

**Files:**
- Create: `src/i18n/es-ES.ts`, `src/i18n/index.ts`, `src/components/StationLogo.tsx`, `src/components/StationCard.tsx`, `src/components/StationGrid.tsx`, `src/components/Pagination.tsx`, `tests/components/StationCard.test.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `getHomeStations`, `GENRE_LABELS`, `countryName`, `flagEmoji`.
- Produces:
  - `t(key: MessageKey, vars?: Record<string, string | number>): string` (sustituye `{var}`); `messages` con al menos estas claves:
    - `site.name` = «DirectoRadio»
    - `home.title` = «Las más escuchadas»
    - `pagination.prev` = «Anterior»
    - `pagination.next` = «Siguiente»
    - `station.listen` = «Escuchar en directo»
    - `station.website` = «Web oficial»
    - `station.ratings` = «{avg} ({count} valoraciones)»
    - `station.plays` = «{count} reproducciones»
    - `station.unhealthy` = «Es posible que esta emisora no esté emitiendo ahora mismo.»
    - `station.httpSoon` = «Esta emisora estará disponible muy pronto en DirectoRadio.»
    - `station.back` = «← Volver al listado»
    - `notFound.title` = «No hemos encontrado esta emisora»
  - `<StationLogo name logoUrl size />` (componente cliente): `<img loading="lazy">` y, si no hay URL o falla `onError`, un círculo con la inicial del nombre.
  - `<StationCard station: StationCardData />`: enlace a `/emisora/{slug}`, con logotipo, nombre, bandera y país, género y estrellas (redondeadas a media estrella; si `ratingCount = 0`, sin estrellas).
  - `src/app/page.tsx`: componente de servidor que lee `searchParams.pagina`, llama a `getHomeStations` y pinta el título, `<StationGrid>` y `<Pagination>`. Usa `export const revalidate = 300`.
  - `layout.tsx`: `<html lang="es">`, cabecera con el nombre del sitio enlazado a `/`, contenedor centrado. La cuadrícula es de 2 columnas en móvil, 3 en tablet y 4–6 en escritorio.

- [ ] **Step 1: Tests** (jsdom):
  - `renders name, country and genre` → «Cadena SER», «España», «Generalista» y enlace a `/emisora/cadena-ser`.
  - `shows initial when logo fails` → `logoUrl` definido; disparar `error` en la `img` → se ve la «C» y no hay `img`.
  - `shows initial when logo missing` → `logoUrl: null` → «C».
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS. `npm run dev` y abrir `/`: aparecen primero emisoras españolas.
- [ ] **Step 5:** Commit `feat(web): add layout, i18n and home grid`.

---

### Task 9: Ficha de emisora con reproductor y prueba de extremo a extremo

**Files:**
- Create: `src/app/emisora/[slug]/page.tsx`, `src/app/emisora/[slug]/not-found.tsx`, `src/components/StationDetail.tsx`, `src/components/AudioPlayer.tsx`, `tests/components/AudioPlayer.test.tsx`, `playwright.config.ts`, `e2e/seed.ts`, `e2e/catalog.spec.ts`

**Interfaces:**
- Consumes: `getStationBySlug`, `t`, `StationLogo`, `GENRE_LABELS`, `countryName`, `flagEmoji`.
- Produces:
  - `<AudioPlayer streamUrl: string; stationName: string />` (cliente):
    - Si la URL **no** es `https:`, muestra `station.httpSoon` y no pinta ni `<audio>` ni botón.
    - Si es `https:`, muestra el botón `station.listen`. Al pulsarlo crea un `<audio>` y llama a `play()`, y el botón pasa a ⏸ para pausar.
    - Si el audio da error, muestra `station.unhealthy`.
  - Página `/emisora/[slug]`:
    - Si `getStationBySlug` devuelve `null`, llama a `notFound()`.
    - Si no, pinta `<StationDetail>` con: volver, logotipo, nombre, país, género, idiomas, tags como `#tag`, valoración, reproducciones, `AudioPlayer`, web oficial con `rel="noopener nofollow"` y `target="_blank"`, y descripción solo si existe.
    - Si `isHealthHidden`, muestra un aviso `station.unhealthy` encima del reproductor.
    - Define `generateMetadata` con título «{name} en directo · DirectoRadio».
    - Usa `revalidate = 300`.
  - `e2e/seed.ts`: `seedE2E(url: string): Promise<void>`. Reinicia la base e inserta 4 emisoras fijas:
    - `cadena-ser`: ES, `https`, 500 clics
    - `radio-fr`: FR, 1000 clics
    - `radio-http`: ES, URL `http://…`, 10 clics
    - `radio-off`: `desactivada`
  - `playwright.config.ts`:
    - `globalSetup` ejecuta `runMigrations` y `seedE2E` sobre `DATABASE_URL_TEST`.
    - `webServer` = `npm run build && npm run start`, con `DATABASE_URL` igual a `DATABASE_URL_TEST`, en el puerto 3100.

- [ ] **Step 1: Tests:**
  - `tests/components/AudioPlayer.test.tsx`:
    - `shows notice for http streams` → `http://x/s` → se ve el texto de `station.httpSoon` y no hay `<audio>` ni botón.
    - `toggles play/pause for https` → con `HTMLMediaElement.prototype.play` simulado, al pulsar se llama a `play` y aparece «⏸».
  - `e2e/catalog.spec.ts`:
    - `home lists Spanish stations first` → la primera tarjeta es «Cadena SER» y «Radio FR» aparece después de «Radio HTTP».
    - `station page shows details and player` → `/emisora/cadena-ser` muestra «Cadena SER», «España» y el botón «Escuchar en directo».
    - `desactivada returns 404` → `/emisora/radio-off` responde 404 y muestra «No hemos encontrado esta emisora».
- [ ] **Step 2:** Run `npm test -- tests/components/AudioPlayer` → FAIL; `npx playwright install chromium; npm run test:e2e` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` → todo PASS; `npm run test:e2e` → 3 passed; `npm run build` → OK.
- [ ] **Step 5:** Commit `feat(web): add station page with https audio player and e2e tests`.
