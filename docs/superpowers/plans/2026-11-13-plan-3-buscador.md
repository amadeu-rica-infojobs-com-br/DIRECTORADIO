# Plan 3 — Buscador por campos y emisoras similares · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/buscar` con búsqueda por nombre y filtros por país, idioma y género; 4 géneros nuevos; idioma normalizado a ISO; y emisoras similares en la ficha. Todo sin servicios de IA.

**Architecture:** Los datos nuevos (`language_codes`, los 4 valores del enum `genre` y la búsqueda por trigramas con `unaccent`) llegan por migraciones de Drizzle y por la sincronización. La lógica de consulta vive en `src/catalog/` como funciones que reciben `db`: `searchStations` generaliza el ranking de la portada (y `getHomeStations` pasa a usarla), `getFilterOptions` y `getSimilarStations`. La interpretación de la dirección (`parseSearchParams`/`searchHref`) es pura y está en `src/catalog/search-params.ts`. Las páginas solo componen.

**Tech Stack:** Next.js 16.4.5 (App Router, sin Cache Components), React 19, TypeScript, Tailwind 4, Drizzle ORM + drizzle-kit, PostgreSQL 17 (`pg_trgm`, `unaccent`), Vitest + Testing Library, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-13-buscador-por-campos-design.md](../specs/2026-11-13-buscador-por-campos-design.md) (base: [spec v1](../specs/2026-11-04-directoradio-v1-design.md)).

## Global Constraints

- Sin servicios de IA ni dependencias nuevas de búsqueda: todo en Postgres.
- Visible = `status = 'activa'` y `coalesce(health_consecutive_failures, 0) < HEALTH_HIDE_THRESHOLD` (`src/catalog/constants.ts`). Nada no visible aparece en búsqueda, opciones ni similares.
- Géneros: los 13 valores `pop, electronica, rock, jazz, clasica, variada, noticias, deportes, generalista, religiosa, latina, country-folk, hip-hop`. Etiquetas nuevas: «Religiosa», «Latina», «Country y folk», «Hip hop».
- Parámetros: `q` (recortado, máximo 100 caracteres), `pais` (ISO alfa-2 en mayúsculas), `idioma` (`^[a-z]{2,3}$`), `genero` (uno de los 13) y `pagina`. Un valor inválido se ignora sin error.
- 48 resultados por página (`HOME_PAGE_SIZE`). Hasta 8 similares.
- `/buscar`: `robots: { index: false, follow: true }` y canónica `/buscar`.
- Todos los textos en `src/i18n/es-ES.ts`.
- Objetivo de rendimiento: búsqueda y similares por debajo de 300 ms con el catálogo completo.
- Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md); para la caché, `01-app/02-guides/caching-without-cache-components.md` (`unstable_cache`).
- Vitest se lanza desde `C:\…` con la unidad en mayúscula: `cmd /c "cd /d C:\PROJECTES\DIRECTORADIO\DIRECTORADIO && npx vitest run <ruta>"`. PowerShell bloquea `npx.ps1`. Docker Desktop tiene que estar arrancado (`docker compose up -d`).
- Migraciones: `npm run db:generate` para los cambios del esquema y `npx drizzle-kit generate --custom --name=<nombre>` para el SQL a mano. No se editan migraciones ya aplicadas.

## Review Focus

1. Texto con caracteres especiales de SQL o de `LIKE` (`%`, `_`, `\`, `'`) se busca literalmente, sin error ni comodines. → Task 4 (`searchStations` con `q = '100%'` y `q = "o'clock"`).
2. Texto vacío de verdad (solo espacios, puntuación o emoji): se trata como sin texto, no como "todo coincide por parecido" ni como error. → Task 4 (`parseSearchParams` y `searchStations` con `q = '   '` y `q = '—'`).
3. Parámetros repetidos (`?pais=ES&pais=FR`) o de tipo array: se usa el primer valor válido. → Task 4 (`parseSearchParams`).
4. `pagina` por encima del número de páginas en `/buscar`: se muestra la última página, no una lista vacía ni un 404. → Task 4 (`searchStations` ajusta `page`).
5. Emisora sin tags, sin país y en "Variada": no se le muestran similares al azar. Que dos emisoras sean "Variada" no basta como algo en común. → Task 6.

---

### Task 1: Cuatro géneros nuevos y correspondencias de tags

**Files:**
- Modify: `src/db/schema.ts` (`genreEnum`)
- Modify: `src/lib/genres.ts` (`GENRES`, al final: `'religiosa', 'latina', 'country-folk', 'hip-hop'`)
- Modify: `src/i18n/es-ES.ts` (`genre.religiosa`, `genre.latina`, `genre.country-folk`, `genre.hip-hop`)
- Modify: `src/catalog/seed/tag-genres.ts` (`GROUPS`)
- Create: migración generada en `drizzle/`
- Test: `tests/lib/genres.test.ts` (crear si no existe), `tests/db/schema.test.ts`

**Interfaces:**
- Produces: `Genre` incluye los 4 valores nuevos; `TAG_GENRE_SEED` con las nuevas correspondencias.

- [ ] **Step 1: Write the failing tests**
  - `genres.test.ts`:
    - `GENRES` tiene longitud 13 y termina en `['religiosa','latina','country-folk','hip-hop']`.
    - `genreLabel('country-folk') === 'Country y folk'` y `genreLabel('hip-hop') === 'Hip hop'`.
    - `resolveGenre` con `TAG_GENRE_SEED` en un `Map`: `['christian','gospel']` → `'religiosa'`; `['regional mexicana']` → `'latina'`; `['folk']` → `'country-folk'`; `['rap']` → `'hip-hop'`; `['local news']` → `'noticias'`; `['music','radio']` → `'variada'`.
    - Ningún tag de `TAG_GENRE_SEED` tiene mayúsculas ni espacios en los extremos (los tags se normalizan en minúsculas).
  - `schema.test.ts`: insertar una emisora con `genre: 'hip-hop'` y leerla.
- [ ] **Step 2: Run to verify they fail**
  Run: `npx vitest run tests/lib/genres.test.ts tests/db/schema.test.ts`. Expected: FAIL (longitud 9; `invalid input value for enum genre: "hip-hop"`).
- [ ] **Step 3: Implement.**
  - Añadir los 4 valores a `genreEnum`, `GENRES` y las etiquetas.
  - `npm run db:generate`. Revisar que el SQL generado contiene solo `ALTER TYPE "public"."genre" ADD VALUE …` ×4.
  - Ampliar `GROUPS`:
    - `religiosa`: `christian, christian music, gospel, religious, religion, worship, catholic, católica, cristiana, evangélica, islamic, islam, quran, bible, church`;
    - `latina`: `latin, latina, latino, regional mexican, regional mexicana, música regional mexicana, mexican music, grupera, grupero, banda, norteña, ranchera, mariachi, salsa, cumbia, tropical, bachata, merengue, reggaeton, reggaetón, vallenato`;
    - `country-folk`: `country, folk, folklore, folclore, bluegrass, americana, celtic`;
    - `hip-hop`: `rap, hip hop, hip-hop, hiphop, r&b, rnb, trap, urban`;
    - en los existentes: `local news` y `noticias locales` → `noticias`; `schlager` → `pop`; `hot adult contemporary` → `pop`.

    Los tags `world`, `world music`, `música`, `music`, `radio` y `fm` no se asignan.
- [ ] **Step 4: Run to verify they pass**
  Run: el mismo comando más `npx vitest run tests/catalog/sync.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**
  `git commit -m "feat(catalog): four new genres and wider tag mapping"`

### Task 2: Idioma ISO (`language_codes`)

**Files:**
- Modify: `src/catalog/radio-browser/types.ts` (`languagecodes?: string`)
- Modify: `src/catalog/radio-browser/map.ts` (`MappedStation.languageCodes: string[]`)
- Modify: `src/db/schema.ts` (`languageCodes: text('language_codes').array().notNull().default(sql\`'{}'::text[]\`)` + índice GIN `stations_language_codes_idx`)
- Modify: `src/catalog/sync.ts` (insertar, actualizar y detectar cambios de `languageCodes`, igual que `languages`)
- Create: `src/lib/language.ts`
- Modify: `src/catalog/queries.ts` (`StationDetailData.languageCodes: string[]`) y `src/components/StationDetail.tsx`
- Create: migración generada
- Test: `tests/catalog/radio-browser.test.ts`, `tests/catalog/sync.test.ts`, `tests/lib/language.test.ts`, test de `StationDetail` (crear `tests/components/StationDetail.test.tsx`)

**Interfaces:**
- Produces:
  - `export function normalizeLanguageCodes(raw: string | undefined): string[]` en `map.ts`;
  - `export function languageName(code: string): string` en `src/lib/language.ts` (nombre en español con mayúscula inicial, o `''` si `Intl.DisplayNames(['es'], { type: 'language' })` no lo conoce o devuelve el propio código);
  - columna `stations.languageCodes`.

- [ ] **Step 1: Write the failing tests**
  - `normalizeLanguageCodes('es, CA,es,,x1,spa')` → `['es','ca','spa']`; `undefined` y `''` → `[]`.
  - `mapRbStation(rb({ languagecodes: 'pt,PT' })).languageCodes` → `['pt']`.
  - `languageName('es') === 'Español'`, `languageName('ca') === 'Catalán'`, `languageName('zz') === ''`.
  - Sync: una emisora nueva guarda `language_codes`; una existente cuyos códigos cambian se actualiza (`updated` +1); y con los mismos códigos (incluso en otro orden) no cuenta como cambio.
  - `StationDetail` con `languageCodes: ['es','ca']` y `languages: ['spanish']` muestra «Idiomas: Español, Catalán». Con `languageCodes: []`, muestra «Idiomas: spanish».
- [ ] **Step 2: Run to verify they fail**
  Run: `npx vitest run tests/catalog/radio-browser.test.ts tests/catalog/sync.test.ts tests/lib/language.test.ts tests/components/StationDetail.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, y después `npm run db:generate` (columna e índice GIN).
- [ ] **Step 4: Run to verify they pass.** El mismo comando y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(catalog): ISO language codes from Radio-Browser"`

### Task 3: Infraestructura de búsqueda por nombre

**Files:**
- Create: migración a mano `npx drizzle-kit generate --custom --name=name_search`
- Modify: `src/db/schema.ts` (índice `station_tags_tag_id_idx` en `stationTags.tagId`) y su migración generada
- Test: `tests/db/search-infra.test.ts`

Contenido de la migración a mano:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stations_name_search_idx ON stations USING gin (lower(f_unaccent(name)) gin_trgm_ops);
```

El índice de trigramas no se declara en `schema.ts`: drizzle-kit no lo conoce y no lo tocará.

**Interfaces:**
- Produces: la función SQL `f_unaccent(text)` y el índice sobre `lower(f_unaccent(name))`. Task 4 debe usar **exactamente** esa expresión para que el índice sirva.

- [ ] **Step 1: Write the failing test**
  - `select lower(f_unaccent('Ñandú CÁDIZ'))` → `'nandu cadiz'`.
  - `pg_indexes` contiene `stations_name_search_idx` y `station_tags_tag_id_idx`.
- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/db/search-infra.test.ts`. Expected: FAIL (`function f_unaccent(unknown) does not exist`).
- [ ] **Step 3: Implement** (las dos migraciones).
- [ ] **Step 4: Run to verify it passes.** El mismo comando y después `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(db): trigram name search and tag index"`

### Task 4: Criterios de búsqueda, `searchStations` y opciones de filtro

**Files:**
- Create: `src/catalog/search-params.ts`
- Create: `src/catalog/search.ts`
- Modify: `src/catalog/queries.ts` (`getHomeStations` delega en `searchStations(db, {}, page)`; el SQL del ranking se mueve a `search.ts` sin cambiar la fórmula)
- Create: `src/catalog/filter-options-cached.ts` (`unstable_cache` con `revalidate: 3600`, etiqueta `'filter-options'`; solo lo importan las páginas)
- Test: `tests/catalog/search-params.test.ts`, `tests/catalog/search.test.ts`; `tests/catalog/queries.test.ts` debe seguir en verde sin cambios

**Interfaces:**
- Produces:
  - `export type SearchCriteria = { q?: string; country?: string; language?: string; genre?: Genre }`
  - `export function parseSearchParams(raw: Record<string, string | string[] | undefined>): { criteria: SearchCriteria; page: number }`
  - `export function searchHref(criteria: SearchCriteria, page?: number): string`: devuelve `/buscar` con los parámetros no vacíos en el orden `q, pais, idioma, genero, pagina`, y sin `pagina` si es 1. Ejemplo: `searchHref({ country: 'PT', genre: 'latina' }, 2)` → `/buscar?pais=PT&genero=latina&pagina=2`.
  - `export function hasCriteria(c: SearchCriteria): boolean`
  - `export async function searchStations(db: Db, criteria: SearchCriteria, page: number): Promise<{ items: StationCardData[]; total: number; page: number; pageCount: number }>`
  - `export type FilterOptions = { countries: string[]; languages: string[]; genres: Genre[] }` (solo códigos, con al menos una emisora visible)
  - `export async function getFilterOptions(db: Db): Promise<FilterOptions>`
  - `export const getCachedFilterOptions: () => Promise<FilterOptions>`

- [ ] **Step 1: Write the failing tests**
  - `search-params.test.ts`:
    - `{ q: '  cadena ser  ' }` → `q: 'cadena ser'`.
    - Un texto de 150 caracteres se recorta a 100.
    - `{ q: '   ' }` y `{ q: '—' }` (sin letras ni números) → sin `q`.
    - `pais: 'pt'` → `country: 'PT'`; `pais: 'POR'` y `pais: '1'` se ignoran.
    - `idioma: 'ES'` → `language: 'es'`; `idioma: 'es-ES'` se ignora.
    - `genero: 'hip-hop'` → `genre: 'hip-hop'`; `genero: 'salsa'` se ignora.
    - `pais: ['XX1','FR','ES']` → `country: 'FR'` (primer valor válido).
    - `pagina: '0'`, `'abc'` y `'-2'` → `page: 1`.
    - `searchHref` con los ejemplos de la interfaz, y `searchHref({})` → `/buscar`.
  - `search.test.ts` (mismo patrón de `createTestDb` que `queries.test.ts`):
    - Sin tildes ni mayúsculas: `q: 'cadiz'` encuentra «Radio Cádiz».
    - Errata: `q: 'cadena sr'` encuentra «Cadena SER».
    - Coincidencia exacta primero: con «LOS40», «Los 40 Classic» y «Radio Clásica», `q: 'los40'` devuelve «LOS40» la primera.
    - Texto corto: `q: 'ab'` solo devuelve nombres que contienen `ab`.
    - Caracteres literales: `q: '100%'` encuentra «Radio 100%» y no «Radio 1000»; `q: "o'clock"` no lanza error.
    - Filtros con Y: `country: 'PT', language: 'pt', genre: 'latina'` devuelve solo las que cumplen los tres.
    - Las emisoras desactivadas o con `healthConsecutiveFailures` igual al umbral no aparecen.
    - Sin criterios, el orden es el mismo que el de `getHomeStations` para los mismos datos.
    - Con 50 resultados, `page: 9` devuelve `page: 2` (la última) con 2 elementos.
  - `getFilterOptions`: solo países, idiomas y géneros de emisoras visibles; los países y los idiomas, sin duplicados.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/catalog/search-params.test.ts tests/catalog/search.test.ts`. Expected: FAIL (no se pueden resolver los módulos).
- [ ] **Step 3: Implement.**
  - En SQL, el texto se pasa como parámetro, nunca concatenado.
  - Para "contiene", se escapan `%`, `_` y `\` antes de construir el patrón de `LIKE` con `ESCAPE '\'`.
  - Coincidencia: `lower(f_unaccent(name)) LIKE '%' || :qn || '%'`, o bien, si `length(:qn) >= 3`, `word_similarity(:qn, lower(f_unaccent(name))) >= umbral`. Se parte de 0,4 y se ajusta con los tests.
  - Orden con texto: `contains DESC`, parecido `DESC`, puntuación de popularidad `DESC`, `name`, `slug`. Sin texto, el orden actual de la portada.
  - `:qn` = `lower(f_unaccent(q))`, calculado en SQL.
- [ ] **Step 4: Run to verify they pass.** El mismo comando, más `npx vitest run tests/catalog/queries.test.ts`, y después `npm test`. Expected: PASS.
- [ ] **Step 5: Measure.** Con el catálogo completo en local (~52.000 emisoras), ejecutar `EXPLAIN ANALYZE` de la consulta de `q: 'cadena ser'` y de `country: 'ES', genre: 'noticias'`. Expected: por debajo de 300 ms y uso de `stations_name_search_idx` en la de texto. Anotar los tiempos en el commit.
- [ ] **Step 6: Commit** `git commit -m "feat(search): search criteria, searchStations and filter options"`

### Task 5: Página `/buscar` y formularios

**Files:**
- Create: `src/components/search/SearchForm.tsx` (servidor; props `{ criteria: SearchCriteria; options: FilterOptions }`)
- Create: `src/components/search/HeaderSearch.tsx` (servidor; `<form action="/buscar">` con un solo campo `q`)
- Create: `src/components/search/ActiveFilters.tsx` (props `{ criteria: SearchCriteria }`)
- Create: `src/components/search/NoResults.tsx` (props `{ criteria: SearchCriteria }`)
- Create: `src/app/buscar/page.tsx`
- Modify: `src/components/Pagination.tsx` (prop opcional `hrefForPage?: (page: number) => string`; por defecto `/?pagina=N`, como hoy)
- Modify: `src/app/page.tsx` (`SearchForm` encima de la cuadrícula) y `src/app/layout.tsx` (`HeaderSearch` en la cabecera)
- Modify: `src/i18n/es-ES.ts`
- Modify: `e2e/seed.ts` (añadir `languageCodes` y una emisora portuguesa `latina`), `e2e/catalog.spec.ts`
- Test: `tests/components/search/*.test.tsx`, `tests/components/Pagination.test.tsx`, `tests/app/buscar.test.ts` (solo `generateMetadata` y su título), `tests/catalog/search-params.test.ts` (`searchTitle`)

**Interfaces:**
- Consumes: todo lo de Task 4; `countryName` (`src/lib/country.ts`), `languageName` (Task 2) y `genreLabel`.
- Produces: `export function searchTitle(c: SearchCriteria): string` en `src/catalog/search-params.ts` (también la usa la metadata).

Textos nuevos (el builder puede pulir la redacción, no el sentido):
- `search.placeholder`: «Buscar emisora…»
- `search.submit`: «Buscar»
- `search.country`, `search.language`, `search.genre`: «País», «Idioma», «Género»
- `search.anyCountry`, `search.anyLanguage`, `search.anyGenre`: «Todos», «Todos», «Todos»
- `search.results.one`, `search.results.other`: «1 emisora», «{count} emisoras»
- `search.remove`: «Quitar {label}»
- `search.noResults`: «No hemos encontrado emisoras con estos criterios.»
- `search.noResultsText`: «Revisa cómo está escrito el nombre.»
- `search.seeAll`: «Ver todas las emisoras»
- `search.title`: «Buscar emisoras»
- `search.metaTitle`: «{title} · DirectoRadio»

- [ ] **Step 1: Write the failing tests**
  - `SearchForm`:
    - `method="get"` y `action="/buscar"`.
    - Los desplegables tienen como primera opción «Todos» con valor vacío.
    - Los países salen con su nombre (`PT` → «Portugal») y en orden alfabético español.
    - Los valores actuales vienen seleccionados, y `q` relleno.
  - `ActiveFilters` con `{ q: 'ser', country: 'PT' }`:
    - Muestra dos etiquetas.
    - La ✕ de país enlaza a `/buscar?q=ser`, y la de texto a `/buscar?pais=PT`.
  - `NoResults` con `{ country: 'PT', language: 'ca' }`:
    - Muestra «Quitar «País: Portugal»», enlazado a `/buscar?idioma=ca`.
    - Muestra «Quitar «Idioma: Catalán»», enlazado a `/buscar?pais=PT`.
    - Muestra «Ver todas las emisoras», enlazado a `/buscar`.
  - `Pagination` sin `hrefForPage`, en la página 2 de 3: enlaces `/?pagina=1` y `/?pagina=3`, igual que ahora. Con `hrefForPage = (p) => searchHref({ q: 'ser' }, p)`: `/buscar?q=ser&pagina=3`.
  - `searchTitle`:
    - `{}` → «Buscar emisoras»;
    - `{ country: 'PT', language: 'pt' }` → «Emisoras de Portugal en portugués»;
    - `{ genre: 'latina' }` → «Emisoras del género Latina»;
    - `{ q: 'ser' }` → «Emisoras: «ser»».
  - Metadata de `/buscar`: `robots` `{ index: false, follow: true }` y `alternates.canonical` `/buscar`.
  - E2E (`catalog.spec.ts`):
    - Desde la cabecera, escribir «cadena» y pulsar Intro lleva a `/buscar?q=cadena`, con «Cadena SER» en la cuadrícula.
    - En `/buscar?pais=PT` solo hay emisoras portuguesas.
    - En `/buscar?pais=FR&genero=latina` aparece el mensaje sin resultados; al pulsar «Quitar «Género: Latina»», la cuadrícula muestra «Radio FR».
    - En `/buscar?pais=XX`, la respuesta es 200 y se muestra el listado completo.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/search tests/app/buscar.test.ts tests/components/Pagination.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `/buscar` usa `searchParams` (así es dinámica), `parseSearchParams`, `searchStations` y `getCachedFilterOptions`.
  - Muestra el número de resultados con `tn`-style (añadir `'search.results'` a la unión de `tn`).
  - En la cabecera, `HeaderSearch` va a la derecha del nombre del sitio y en móvil ocupa el ancho restante.
- [ ] **Step 4: Run to verify they pass.** El mismo comando, `npm test`, `npm run lint` y `npm run test:e2e`. Expected: PASS y lint sin errores.
- [ ] **Step 5: Commit** `git commit -m "feat(search): /buscar page, search forms and filters"`

### Task 6: Emisoras similares

**Files:**
- Create: `src/catalog/similar.ts`
- Modify: `src/app/emisora/[slug]/page.tsx` (carga las similares junto con la emisora) y `src/components/StationDetail.tsx` (sección final con `StationGrid`, con el título `t('station.similar')` = «Emisoras similares»)
- Test: `tests/catalog/similar.test.ts`, y una aserción en `tests/components/StationDetail.test.tsx`

**Interfaces:**
- Consumes: `StationCardData`, la condición de visibilidad y la popularidad (`search.ts`, Task 4).
- Produces: `export async function getSimilarStations(db: Db, stationId: string, limit = 8): Promise<StationCardData[]>`

Puntuación (spec §5.6):
- +3 si el género es el mismo y no es "Variada"; +1 si ambas son "Variada";
- por cada tag compartido, `2 / ln(e + n_tag / 100)`, siendo `n_tag` el número de emisoras visibles con ese tag (los muy frecuentes pesan menos);
- +2 si el país es el mismo;
- +1 si comparten algún código de idioma.

**Requisito para ser candidata:** al menos un tag compartido, o el mismo género distinto de "Variada", o el mismo país. Ni "Variada" ni el idioma bastan por sí solos.

Orden: puntuación `DESC`, popularidad `DESC`, `slug`.

- [ ] **Step 1: Write the failing tests**
  - Con una emisora de rock española con tags `classic rock` y `80s`:
    - otra de rock española con `classic rock` queda por delante de una de rock francesa sin tags compartidos;
    - y esta, a su vez, por delante de una española "Variada" sin tags.
  - Nunca se incluye la emisora actual ni las no visibles.
  - Una emisora "Variada" sin tags ni país, con otras "Variada" sin tags en la base de datos → `[]`.
  - Dos emisoras que solo comparten idioma → `[]`.
  - Un tag común a 5.000 emisoras pesa menos que uno común a 3. Con el mismo resto de criterios, gana la que comparte el tag raro.
  - `limit` se respeta: con 20 candidatas, devuelve 8.
  - `StationDetail` con `similar: []` no muestra «Emisoras similares»; con 2, muestra el título y 2 tarjetas.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/catalog/similar.test.ts tests/components/StationDetail.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** en una sola consulta SQL: candidatas por unión de tags compartidos, mismo género o mismo país, con el `n_tag` calculado sobre las visibles. `StationDetail` recibe `similar: StationCardData[]` como prop nueva.
- [ ] **Step 4: Run to verify they pass.** El mismo comando y `npm test`. Expected: PASS.
- [ ] **Step 5: Measure.** `EXPLAIN ANALYZE` con el catálogo completo, para una emisora con muchos tags (por ejemplo, la de más tags) y para «Cadena SER». Expected: por debajo de 300 ms. Si no se llega, anotar la decisión en el ledger y precalcular en `station_similar` desde la tarea diaria (fuera de este plan, como plan aparte).
- [ ] **Step 6: Commit** `git commit -m "feat(station): similar stations without AI"`

### Task 7: Spec v1, comprobación con datos reales y producción

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-directoradio-v1-design.md`:
  - §2: quitar buscador con IA, voz y descripciones con IA, y añadir el buscador por campos;
  - §6.1: los 13 géneros;
  - §6.5, §6.6 y §6.9: una línea que remite al diseño `2026-11-13-buscador-por-campos-design.md`.
- Modify: `docs/superpowers/handoff.md` (estado y siguiente plan)

- [ ] **Step 1:** Actualizar la spec y el handoff.
- [ ] **Step 2: Real-data check.**
  - `npm run db:migrate` y `npm run job:sync` en local, con el catálogo completo.
  - Comprobar en `npm run dev`:
    - `/buscar?q=cadena ser`: «Cadena SER» en la primera fila;
    - `/buscar?q=los40`: «LOS40» la primera;
    - `/buscar?pais=PT&idioma=pt`;
    - `/buscar?genero=religiosa`: no vacío;
    - la ficha de «Cadena SER» con similares españolas de noticias o generalistas.
  - Contar las emisoras en "Variada" (Expected: ~3.800 menos que las 34.819 de antes) y las que tienen `language_codes` no vacío.
- [ ] **Step 3:** `npm test`, `npm run lint` y `npm run test:e2e` en verde. Commit `git commit -m "docs: plan 3 spec updates and handoff"`.
- [ ] **Step 4: Producción** (después de fusionar el PR; lo autoriza el responsable). En la imagen nueva que despliega GitHub Actions:
  - `fly machine run <imagen> node dist/migrate.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio`;
  - después, `node dist/sync.mjs` igual, para rellenar los códigos de idioma y los géneros;
  - y `fly machine update 8d99350be19498 --image <imagen> -a directoradio-audio` para la tarea diaria.

  Verificar `https://directoradio.com/buscar?q=cadena%20ser`.
