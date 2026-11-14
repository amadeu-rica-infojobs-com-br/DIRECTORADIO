# Logotipo y favicon · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logotipo C2 («Ecualizador en directo» + «DirectoRadio») en la cabecera, favicon SVG e ICO, icono de móvil e imagen para compartir.

**Architecture:**
- Los SVG fuente viven en `src/brand/`: un módulo TypeScript con las cadenas SVG y los colores.
- El componente `Logo` los dibuja en línea.
- Un script puntual, `scripts/generate-icons.mjs`, renderiza los PNG con el Chromium de Playwright, que ya es una dependencia de desarrollo, y empaqueta el `.ico` con PNG embebidos.
- Los archivos generados se guardan en `src/app/`, con las convenciones de metadatos de Next.js.

**Tech Stack:** Next.js 16.4.5, React 19, Tailwind 4, Vitest, Playwright (`@playwright/test` para el script).

**Spec:** [docs/superpowers/specs/2026-11-14-logo-favicon-design.md](../specs/2026-11-14-logo-favicon-design.md)

## Global Constraints

- **Colores**, del diseño:

  | Uso | Claro | Oscuro |
  |---|---|---|
  | Fondo del símbolo | `#0f172a` | `#134e4a` |
  | Barras | `#2dd4bf` | `#5eead4` |
  | Barra «en directo» | `#a3e635` | `#bef264` |
  | «Radio» en el nombre | `#0d9488` | `#5eead4` |

- **Nombre:** «DirectoRadio», con mayúsculas. Tipografía del sistema, peso 700, interletraje -0,02 em.
- **Favicon:** siempre los colores claros, con el SVG del favicon del diseño (3 barras más la de «en directo»).
- **Sin dependencias nuevas** en `dependencies` ni en `devDependencies`.
- **Lema:** «Radio en directo de todo el mundo». Texto alternativo de la imagen para compartir: «DirectoRadio · Radio en directo de todo el mundo».
- Vitest se lanza con `cmd /c "cd /d C:\PROJECTES\DIRECTORADIO\DIRECTORADIO && npx vitest run …"`, con Docker arrancado.

## Review Focus

1. **Modo oscuro:** el logo cambia de colores con `prefers-color-scheme: dark`. → Task 1 (clases `dark:` en cada elemento coloreado).
2. **Lectores de pantalla:** el enlace de la cabecera se anuncia «DirectoRadio», no se leen dos veces ni los rectángulos del SVG. → Task 1 (`aria-label` en el enlace y `aria-hidden` en el SVG).
3. **Móvil estrecho (360 px):** el logo no empuja la caja de búsqueda fuera de la pantalla. → Task 1 (`shrink-0` y alto de 32 px); se comprueba en Task 3.
4. **Favicon del `.ico`:** Google y los navegadores antiguos piden `/favicon.ico` y debe ser el nuevo, con 16, 32 y 48 px. → Task 2 (test que lee la cabecera del ICO).
5. **El script de iconos se vuelve a ejecutar y da el mismo resultado:** no depende de fuentes del sistema para los iconos. → Task 2 (los iconos no llevan texto; solo la imagen para compartir lo lleva).

---

### Task 1: Componente `Logo` en la cabecera

**Files:**
- Create: `src/brand/brand.ts`
- Create: `src/components/Logo.tsx`
- Modify: `src/app/layout.tsx` (sustituye el `<Link>` con `t('site.name')`)
- Test: `tests/components/Logo.test.tsx`; e2e `e2e/catalog.spec.ts`

**Interfaces:**
- Produces:
  - En `src/brand/brand.ts`:
    - `export const BRAND = { light: { bg: '#0f172a', bars: '#2dd4bf', live: '#a3e635', accent: '#0d9488' }, dark: { bg: '#134e4a', bars: '#5eead4', live: '#bef264', accent: '#5eead4' } } as const`
    - `export const TAGLINE = 'Radio en directo de todo el mundo'`
    - `export function faviconSvg(): string`: el SVG del favicon del diseño, tal cual, con `xmlns`.
    - `export function symbolSvg(theme: 'light' | 'dark'): string`: el símbolo grande del diseño (48×48) con los colores del tema.
  - `export function Logo({ className }: { className?: string }): JSX.Element` en `src/components/Logo.tsx`.

- [ ] **Step 1: Write the failing tests**
  - `Logo.test.tsx`:
    - lo renderiza dentro de un `<a href="/">` y `getByRole('link', { name: 'DirectoRadio' })` existe;
    - el `<svg>` tiene `aria-hidden="true"`;
    - el texto visible es «DirectoRadio», con «Radio» en un `<span>` con las clases `text-[#0d9488]` y `dark:text-[#5eead4]`;
    - el `rect` de fondo tiene las clases `fill-[#0f172a]` y `dark:fill-[#134e4a]`.
  - `brand.test.ts` (en `tests/brand/`):
    - `faviconSvg()` empieza por `<svg xmlns="http://www.w3.org/2000/svg"` y contiene `#0f172a`, `#2dd4bf` y `#a3e635`;
    - `symbolSvg('dark')` contiene `#134e4a` y no contiene `#0f172a`.
  - E2E: en el test `header search finds a station by name`, antes de escribir, `page.getByRole('banner').getByRole('link', { name: 'DirectoRadio' })` está visible y lleva a `/`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/components/Logo.test.tsx tests/brand/brand.test.ts`. Expected: FAIL (no se pueden resolver los módulos).
- [ ] **Step 3: Implement.**
  - `Logo` = `<Link href="/" aria-label="DirectoRadio" className="flex shrink-0 items-center gap-2">` con:
    - el `<svg viewBox="0 0 48 48" class="h-8 w-8" aria-hidden>`, coloreado con clases `fill-[…] dark:fill-[…]`;
    - el nombre `<span class="text-xl font-bold tracking-[-0.02em]">Directo<span class="text-[#0d9488] dark:text-[#5eead4]">Radio</span></span>`.
  - En el layout, sustituir el `<Link>` actual por `<Logo />`.
- [ ] **Step 4: Run to verify they pass.** El mismo comando, `npm test` y `npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(brand): equalizer logo in the header"`

### Task 2: Favicon, icono de móvil e imagen para compartir

**Files:**
- Create: `scripts/generate-icons.mjs`. Lo ejecuta una persona cuando cambia el logo; no forma parte del build.
- Create (generados por el script y guardados en git):
  - `src/app/icon.svg`
  - `src/app/favicon.ico` (sustituye al actual)
  - `src/app/apple-icon.png`
  - `src/app/opengraph-image.png`
  - `src/app/opengraph-image.alt.txt`
- Modify: `package.json`, solo el script `"icons": "tsx scripts/generate-icons.mjs"`, sin dependencias nuevas.
- Test: `tests/brand/icons.test.ts`

**Interfaces:**
- Consumes: `faviconSvg`, `symbolSvg`, `BRAND` y `TAGLINE` (Task 1).

Qué genera el script:
- `icon.svg` = `faviconSvg()`.
- PNG de 16, 32 y 48 px del favicon, renderizados con `chromium.launch()`, `page.setContent` del SVG a ese tamaño y `screenshot({ omitBackground: true })`. Se empaquetan en `favicon.ico` con PNG embebidos: cabecera ICONDIR de 6 bytes, una entrada ICONDIRENTRY de 16 bytes por imagen y los datos PNG.
- `apple-icon.png`: 180×180, fondo `#0f172a` a sangre y el símbolo claro centrado a 132 px. iOS redondea las esquinas.
- `opengraph-image.png`: 1200×630, con fondo `#0f172a`:
  - el símbolo claro de 160 px a la izquierda del nombre;
  - «DirectoRadio» de 96 px, con «Directo» en `#f8fafc` y «Radio» en `#2dd4bf`;
  - debajo, el lema en `#94a3b8` a 40 px.

  Tipografía: `system-ui`, peso 700 en el nombre.
- `opengraph-image.alt.txt` = «DirectoRadio · Radio en directo de todo el mundo».

- [ ] **Step 1: Write the failing test** `icons.test.ts` (entorno node), que lee los archivos de `src/app/`:
  - `icon.svg` es igual a `faviconSvg()`;
  - `favicon.ico`:
    - bytes 0-3 = `00 00 01 00`;
    - número de imágenes (bytes 4-5, little-endian) = 3;
    - los anchos de las entradas (byte 6 + 16·i) son `[16, 32, 48]`;
    - cada imagen empieza por la firma PNG `89 50 4E 47`.
  - `apple-icon.png` mide 180×180: ancho y alto en los bytes 16-23 de la cabecera IHDR, big-endian.
  - `opengraph-image.png` mide 1200×630.
  - `opengraph-image.alt.txt`, recortado, es «DirectoRadio · Radio en directo de todo el mundo».
- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/brand/icons.test.ts`. Expected: FAIL. El `.ico` de Next.js tiene 3 imágenes, pero no son PNG de 16, 32 y 48, y faltan los demás archivos.
- [ ] **Step 3: Implement and run** `npm run icons`. Revisar a simple vista `apple-icon.png` y `opengraph-image.png`.
- [ ] **Step 4: Run to verify it passes.** El mismo comando, `npm test`, `npm run build` (sin errores de metadatos) y, con `npm run start`, comprobar que `curl -s http://localhost:3000/` contiene `rel="icon"` hacia `/icon.svg` y `/favicon.ico`, `apple-touch-icon` y `og:image`. Expected: PASS y las cuatro etiquetas presentes.
- [ ] **Step 5: Commit** `git commit -m "feat(brand): favicon, app icon and share image"`

### Task 3: Comprobación visual

- [ ] **Step 1:** Con un build de producción y Playwright, capturas de la cabecera a 1280 px y a 360 px, en claro y oscuro (`colorScheme`). Comprobar que:
  - el logo y la caja de búsqueda caben en una línea a 360 px;
  - los colores cambian en oscuro;
  - el favicon se ve en la pestaña.
- [ ] **Step 2:** `npm test`, `npm run lint` y `npm run test:e2e` en verde.
