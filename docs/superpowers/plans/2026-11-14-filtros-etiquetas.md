# Filtros como fila de etiquetas · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el formulario de filtros siempre visible por una fila de etiquetas que abren una lista de opciones (hoja desde abajo en móvil, desplegable en escritorio). La caja de la cabecera pasa a ser el único campo de texto.

**Architecture:**
- La preparación de las listas (etiquetas en español, orden, valor actual) es pura y está en `src/components/search/filter-lists.ts`; la usan la fila y el formulario de respaldo.
- La fila es un componente cliente (`FilterChips`) con un `<dialog>` nativo. Cada opción es un `<Link>` a `searchHref(...)`.
- Sin JavaScript, un `<noscript>` muestra el `SearchForm` actual sin campo de texto, dentro de un `<details>`.

**Tech Stack:** Next.js 16.4.5, React 19, Tailwind 4, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [docs/superpowers/specs/2026-11-14-filtros-etiquetas-design.md](../specs/2026-11-14-filtros-etiquetas-design.md)

## Global Constraints

- Sin dependencias nuevas. Sin cambios en `searchStations`, en los parámetros de la dirección, en las opciones en caché ni en `NoResults`.
- Orden de las etiquetas: texto (si hay `q`), País, Idioma y Género.
- **Etiqueta activa:**
  - claro: `bg-[#ccfbf1] border-[#0d9488] text-[#115e59]`;
  - oscuro: `dark:bg-[#134e4a] dark:border-[#5eead4] dark:text-[#ccfbf1]`.
- **✕:** área táctil de al menos 32 px. **Corte móvil/escritorio:** 640 px (`sm`).
- **Filtro de la lista:** solo en País e Idioma, sin tildes ni mayúsculas.
- **Textos** en `src/i18n/es-ES.ts`. Claves nuevas:
  - `search.filters`: «Filtros»;
  - `search.filterList`: «Filtrar {name}» (etiqueta del campo de filtro de la lista);
  - `search.close`: «Cerrar»;
  - `search.change`: «{label}, cambiar»;
  - `search.all`: «Todos».
- Las lecturas de `useSearchParams` en el layout van dentro de `<Suspense>` (leer `node_modules/next/dist/docs/` sobre `useSearchParams` antes de escribir).
- Vitest con `cmd /c "cd /d C:\PROJECTES\DIRECTORADIO\DIRECTORADIO && npx vitest run …"`, con Docker arrancado.

## Review Focus

1. **Lista larga y filtro:** al escribir «españ» en País aparece España; y «portugues», sin tilde, encuentra Portugués. → Task 1 (`matchesQuery`) y Task 2 (test de filtrado).
2. **Valor activo que no está en las opciones en caché:** la etiqueta lo muestra igual y la lista lo marca. → Task 1 (`buildFilterLists` incluye el valor actual).
3. **Sin JavaScript:** se puede filtrar con el panel `<details>`, y la ✕ de las etiquetas funciona porque es un enlace. → Task 3 (test del `<noscript>` y e2e con `javaScriptEnabled: false`).
4. **Teclado:** Esc cierra la lista y el foco vuelve a la etiqueta. → Task 2.
5. **Cambiar el texto en `/buscar` con filtros activos los conserva.** → Task 3 (test de `HeaderSearch` y e2e).

---

### Task 1: Listas de opciones preparadas

**Files:**
- Create: `src/components/search/filter-lists.ts`
- Modify: `src/components/search/SearchForm.tsx`:
  - usa `buildFilterLists`;
  - nueva prop `showText?: boolean`, `true` por defecto; con `false`, no pinta el campo de texto, pero envía el `q` actual como campo oculto si existe.
- Test: `tests/components/search/filter-lists.test.ts`; `tests/components/search/SearchForm.test.tsx` debe seguir en verde.

**Interfaces:**
- Produces:
  - `export type FilterOption = { value: string; label: string }`
  - `export type FilterLists = { country: FilterOption[]; language: FilterOption[]; genre: FilterOption[] }`
  - `export function buildFilterLists(options: FilterOptions, criteria: SearchCriteria): FilterLists`: es la lógica actual de `SearchForm` (añadir el valor actual si falta, nombres en español, quitar los que no tienen nombre y ordenar con `localeCompare(…, 'es')`).
  - `export function matchesQuery(label: string, query: string): boolean`: compara sin tildes ni mayúsculas, con «contiene». Con `query` vacío, `true`.

- [ ] **Step 1: Write the failing tests**
  - `buildFilterLists({ countries: ['PT', 'ES'], languages: ['es'], genres: ['rock'] }, { country: 'FR' })`:
    - `.country.map(o => o.label)` = `['España', 'Francia', 'Portugal']`;
    - `.language` = `[{ value: 'es', label: 'Español' }]`;
    - `.genre` = `[{ value: 'rock', label: 'Rock' }]`.
  - `matchesQuery('Portugués', 'portugues')` → `true`; `matchesQuery('España', 'ESPAÑ')` → `true`; `matchesQuery('Francia', 'port')` → `false`; `matchesQuery('X', '  ')` → `true`.
  - `SearchForm` con `showText={false}`:
    - sin `criteria.q`, no hay `searchbox`;
    - con `criteria={{ q: 'ser' }}`, hay un `input[type=hidden][name=q]` con el valor `ser`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/search/filter-lists.test.ts tests/components/search/SearchForm.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, moviendo `withCurrent`, `byLabel` y el mapeo de etiquetas de `SearchForm` a `filter-lists.ts`.
- [ ] **Step 4: Run to verify they pass.** El mismo comando. Expected: PASS, incluidos los tests anteriores de `SearchForm`.
- [ ] **Step 5: Commit** `git commit -m "refactor(search): shared filter option lists"`

### Task 2: `FilterChips` con lista en `<dialog>`

**Files:**
- Create: `src/components/search/FilterChips.tsx` (`'use client'`)
- Modify: `src/i18n/es-ES.ts` (claves de Global Constraints)
- Test: `tests/components/search/FilterChips.test.tsx`

**Interfaces:**
- Consumes: `FilterLists`, `FilterOption` y `matchesQuery` (Task 1); `searchHref` y `SearchCriteria` (`src/catalog/search-params.ts`); `criteriaChips` (`src/components/search/chips.ts`, para la etiqueta legible y el `removeHref`).
- Produces: `export function FilterChips({ criteria, lists }: { criteria: SearchCriteria; lists: FilterLists }): JSX.Element`

Comportamiento:
- `<div role="group" aria-label="Filtros">` con desplazamiento horizontal (`overflow-x-auto`, sin salto de línea).
- **Etiqueta inactiva:** `<button aria-haspopup="dialog">` con «País ▾».
- **Etiqueta activa:** botón «España», con nombre accesible «País: España, cambiar», y al lado un `<Link>` ✕ con el `removeHref` de `criteriaChips`, nombre accesible «Quitar «País: España»» y área táctil de 32 px.
- **Texto:** solo un `<Link>` «“ser” ✕» que quita `q`.
- **Al pulsar una etiqueta,** se abre un único `<dialog>` con `showModal()`:
  - título (País, Idioma o Género), botón «Cerrar» y, en País e Idioma, un campo de búsqueda con la etiqueta «Filtrar País»;
  - lista de `<Link>`: «Todos» (`searchHref({ ...criteria, [key]: undefined })`) y una por opción (`searchHref({ ...criteria, [key]: value })`);
  - el valor actual lleva `aria-current="true"`.
- **Clases del `<dialog>`:**
  - móvil: hoja anclada abajo (`fixed inset-x-0 bottom-0 m-0 max-h-[75vh] w-full max-w-none rounded-t-2xl`);
  - desde `sm`: desplegable de `w-72` y `max-h-80` colocado bajo la etiqueta. La posición sale del `getBoundingClientRect()` de la etiqueta y se aplica con `style`.
- **Cierre:**
  - Esc (nativo) o «Cerrar», y el foco vuelve a la etiqueta;
  - un clic en el fondo, cuando el destino del clic es el propio `<dialog>`;
  - al navegar, cuando se pulsa un enlace.

- [ ] **Step 1: Write the failing tests** (jsdom no implementa `showModal`: en `beforeAll`, `HTMLDialogElement.prototype.showModal = function () { this.open = true }` y `close = function () { this.open = false; this.dispatchEvent(new Event('close')) }`):
  - Sin criterios, hay tres botones, «País», «Idioma» y «Género», y ningún enlace ✕.
  - Con `{ q: 'ser', country: 'PT' }`:
    - el primer elemento es un enlace con nombre «Quitar «Texto: ser»» hacia `/buscar?pais=PT`;
    - hay un botón con nombre «País: Portugal, cambiar»;
    - hay un enlace «Quitar «País: Portugal»» hacia `/buscar?q=ser`.
  - Pulsar «País»:
    - abre el diálogo, con nombre «País» y `open === true`;
    - el enlace «Portugal» apunta a `/buscar?pais=PT`;
    - «Todos» apunta a `/buscar`.
  - Con `criteria.country = 'PT'`, el enlace «Portugal» tiene `aria-current="true"`.
  - Filtrar: tras abrir País y escribir «port» en «Filtrar País», solo queda «Portugal», además de «Todos».
  - En Género no hay campo de filtro.
  - Pulsar «Cerrar» cierra el diálogo y el foco vuelve al botón «País».
  - La etiqueta activa lleva las clases `bg-[#ccfbf1]` y `dark:bg-[#134e4a]`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/search/FilterChips.test.tsx`. Expected: FAIL (no se puede resolver el módulo).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** El mismo comando. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(search): filter chips with option sheet"`

### Task 3: Conectar en las páginas, cabecera y respaldo sin JavaScript

**Files:**
- Create: `src/components/search/FilterBar.tsx` (servidor): `{ criteria, options }`, que llama a `buildFilterLists` y pinta:
  - `<FilterChips>`;
  - `<noscript><details><summary>Filtros (n)</summary><SearchForm criteria={criteria} options={options} showText={false} /></details></noscript>`, siendo `n` el número de filtros activos sin contar el texto.
- Modify: `src/app/page.tsx` y `src/app/buscar/page.tsx`: `SearchForm` y `ActiveFilters` se sustituyen por `<FilterBar>`.
- Delete: `src/components/search/ActiveFilters.tsx` y su test. `NoResults` sigue usando `criteriaChips`.
- Modify: `src/components/search/HeaderSearch.tsx`:
  - pasa a cliente y usa `usePathname()` y `useSearchParams()`;
  - en `/buscar`, `defaultValue` del texto = `q` actual y campos ocultos `pais`, `idioma` y `genero` para los que tengan valor;
  - `key` = cadena de los parámetros, para que se remonte al navegar;
  - en `layout.tsx`, envolverlo en `<Suspense fallback={<HeaderSearchFallback />}>`, siendo `HeaderSearchFallback` la caja estática actual.
- Modify: `e2e/catalog.spec.ts`.
- Test: `tests/components/search/FilterBar.test.tsx`, `tests/components/search/HeaderSearch.test.tsx`, e2e.

**Interfaces:**
- Consumes: `FilterChips` (Task 2), `buildFilterLists` (Task 1) y `SearchForm` con `showText` (Task 1).
- Produces: `export function FilterBar({ criteria, options }: { criteria: SearchCriteria; options: FilterOptions }): JSX.Element`

- [ ] **Step 1: Write the failing tests**
  - `FilterBar` con `{ country: 'PT', genre: 'rock' }`:
    - renderiza el grupo «Filtros»;
    - el `container.innerHTML` contiene `<noscript>` y `Filtros (2)`.

    En jsdom el contenido de `noscript` es texto, así que se comprueba por cadena.
  - `HeaderSearch`, simulando `next/navigation` con `vi.mock`:
    - con `pathname = '/buscar'` y los parámetros `q=ser&pais=PT&genero=rock`, el `searchbox` vale «ser» y hay campos ocultos `pais=PT` y `genero=rock`, sin `idioma`;
    - con `pathname = '/'`, no hay campos ocultos y el `searchbox` está vacío.
  - **E2E** (`catalog.spec.ts`):
    - Quitar el «Buscar emisora por nombre» del formulario de la portada en los selectores. Los tests que usan `main` + `combobox` pasan a usar las etiquetas.
    - «no results offers to remove a filter»: tras pulsar «Quitar «Género: Latina»», comprobar que hay un botón con nombre «País: Francia, cambiar».
    - **Nuevo** «chips open the option sheet»: en `/buscar`, pulsar «País», escribir «port» en «Filtrar País», pulsar «Portugal» → URL `/buscar?pais=PT` y la cuadrícula muestra «Rádio PT».
    - **Nuevo** «header search keeps active filters»: en `/buscar?pais=ES`, escribir «cadena» en la caja de la cabecera y pulsar Intro → URL `/buscar?q=cadena&pais=ES`.
    - **Nuevo** «filters fit on mobile»: con el viewport a 360×740 en `/`, la `boundingBox().y` de la primera `station-card-name` es menor que 300.
    - **Nuevo** «works without JavaScript»: con `test.use({ javaScriptEnabled: false })` en `/buscar`, abrir el `summary` «Filtros (0)», elegir País «Portugal» y pulsar «Buscar» → URL con `pais=PT`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/search` y `npm run test:e2e`. Expected: los tests nuevos FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass.** `npm test`, `npm run lint` y `npm run test:e2e`. Expected: todo PASS y lint sin errores.
- [ ] **Step 5: Visual check.** Capturas con Playwright de `/` y `/buscar?pais=ES&genero=noticias` a 360 y 1280 px, en claro y oscuro, con la lista de País abierta en ambos tamaños. Anotar en el registro la `y` de la primera emisora (antes: 527 en `/` y 607 en `/buscar`).
- [ ] **Step 6: Commit** `git commit -m "feat(search): chip filter bar replaces the always-open form"`
