# Plan 2b — Despliegue en producción · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar DirectoRadio en `https://directoradio.com`, con el proxy de audio en `https://audio.directoradio.com`, la base de datos en Neon (Fráncfort) y la sincronización y la comprobación de salud diarias. Antes hay que cerrar las condiciones de seguridad y abuso pendientes del plan 2.

**Architecture:**
- **Web:** Next.js en Vercel. Las funciones corren en `fra1`. La web usa la cadena de conexión *pooled* de Neon, con `prepare: false` y una conexión por instancia.
- **Proxy de audio y tareas:** una única app de Fly.io (`directoradio-audio`, región `fra`) con una imagen Docker. Los procesos son el proxy de audio (siempre encendido) y una máquina programada diaria que ejecuta sincronización, limpieza de reproducciones y comprobación de salud.
- **Código ejecutable en Fly:** el TypeScript del proxy y de las tareas se empaqueta con esbuild en `dist/*.mjs`, así que la imagen no necesita `tsx` ni dependencias de desarrollo.
- **DNS:** en Cloudflare, en modo «solo DNS» (nube gris) para la web y el proxy.

**Tech Stack:** la del plan 2, más `esbuild` (empaquetado), Docker (`node:24-slim`), `flyctl`, la CLI de Vercel y Neon.

**Spec:** [docs/superpowers/specs/2026-11-04-directoradio-v1-design.md](../specs/2026-11-04-directoradio-v1-design.md). Este plan cubre la sección 7 (alojamiento, región UE y tareas programadas) y las condiciones para publicar que quedaron del plan 2.

**Fuera de este plan:**
- Desactivar las emisoras perdedoras de un duplicado que siguen activas, y adoptar las filas `deactivatedBySync` cuando Radio-Browser cambia el uuid de una emisora (pendientes del plan 1).
- Planes 3, 4 y 5.

## Global Constraints

- **Dominios:**
  - Web: `https://directoradio.com`. `www.directoradio.com` redirige con un 308 al dominio sin `www`.
  - Proxy: `https://audio.directoradio.com`.
  - DNS en Cloudflare, siempre en modo «DNS only». Nunca en modo «Proxied».
- **Regiones:** Neon `aws-eu-central-1` (Fráncfort), Vercel `fra1` y Fly.io `fra`.
- **Node:** `"engines": { "node": ">=22.19" }` en `package.json`. La imagen Docker usa `node:24-slim`.
- **Secretos:** nunca en el repositorio ni en el chat.
  - El responsable los escribe en `.env.production.local`, que git ignora.
  - Se suben a Vercel y a Fly con comandos que leen ese archivo sin mostrar los valores.
- **Variables de entorno de producción:**

  | Variable | Web (Vercel) | Fly | Valor |
  |---|---|---|---|
  | `DATABASE_URL` | sí | sí | Cadena *pooled* de Neon (host `-pooler`). En Vercel lleva `DB_POOL_MAX=1`. |
  | `DATABASE_URL_DIRECT` | — | sí | Cadena directa de Neon, para las migraciones y las tareas. |
  | *(límite de consulta)* | — | — | Timeout por rol en Neon (5 s) para web y proxy; las tareas usan la conexión directa sin límite. |
  | `NEXT_PUBLIC_AUDIO_PROXY_URL` | `https://audio.directoradio.com` | — | Se fija en tiempo de *build*. |
  | `WEB_ORIGIN` | — | `https://directoradio.com` | — |
  | `TRUSTED_CLIENT_IP_HEADER` | — | `fly-client-ip` | — |
  | `PLAYS_IP_SALT` | sí | — | Secreto aleatorio de 32 bytes en hexadecimal. |
  | `RADIO_BROWSER_BASE_URL` | — | `https://de1.api.radio-browser.info` | — |

- **Abuso del contador de reproducciones:** como máximo **30 reproducciones contadas por IP y hora**, y **200 por IP y día**. Si se supera, `429`.
  - La IP se guarda como `sha256(PLAYS_IP_SALT + ip)` en hexadecimal, nunca en claro.
  - En Vercel la IP es la primera de `x-forwarded-for`, o `x-real-ip` si no está la anterior.
- **Retención:** las reproducciones de más de **35 días** se borran en la tarea diaria.
- **Proxy en producción:**
  - **IP del oyente:** se toma de la cabecera configurada en `TRUSTED_CLIENT_IP_HEADER`. Si la variable no existe, se usa la IP de la conexión TCP.
  - **IPv6:** las direcciones IPv6 se agrupan por su prefijo `/64` para los límites de conexión.
  - **Hotlinking:**
    - Si la petición trae `Referer` y su origen no es `WEB_ORIGIN`, la respuesta es `403`.
    - Sin `Referer`, se permite: algunos navegadores lo omiten.
  - **Base de datos:** la consulta de la emisora tiene un límite de 3 s (`503`). `429` y `503` llevan `Retry-After: 30`.
  - **Registro:** cada respuesta que no sea 200 escribe una línea JSON en stdout con `{ts, event:'proxy_error', status, stationId, reason}`. Nunca se registran la URL del stream ni la IP en claro.
- **Tarea diaria:** `node dist/daily.mjs` hace, en orden, sincronización, borrado de reproducciones antiguas y comprobación de salud. Si una fase falla, se registra y la siguiente se ejecuta igualmente. El código de salida es 1 si alguna fase falló **o si la comprobación de salud se abortó**.
- **Comprobación de salud (salvaguarda):**
  - La primera ejecución en producción se hace a mano y se revisa: si falla más del 30 %, no se programa la tarea diaria hasta investigar.
  - En cada ejecución, si falla más del 50 % de las emisoras comprobadas, no se suman fallos consecutivos y se registra `health_aborted_high_failure_rate`. Así se protege el catálogo ante un fallo de red del propio servidor.

## Review Focus

1. **Un script que envía miles de `sessionId` falsos desde una IP:** a partir de la 31.ª en una hora recibe `429` y el ranking no cambia. Lo cubre el test `rate-limits counted plays per ip` (Task 2).
2. **Oyentes reales detrás del balanceador de Fly:** cada uno se cuenta por su IP de `Fly-Client-IP`, no por la del balanceador. Así el 4.º oyente del mundo no recibe un `429`. Test `uses trusted client ip header` (Task 3).
3. **Una caída de red del servidor durante la comprobación de salud** (todo da timeout): no oculta el catálogo. Test `aborts when failure rate is too high` (Task 4).
4. **Una web ajena que incrusta `<audio src="https://audio.directoradio.com/stream/…">`:** recibe `403` cuando el navegador envía `Referer`. Test `rejects foreign referer` (Task 3).
5. **Postgres con *pgbouncer* en modo transacción (Neon pooled):** las consultas no fallan por sentencias preparadas. Test `disables prepared statements for pooled urls` (Task 1).

---

### Task 1: Cliente de base de datos para producción y versión de Node

**Files:**
- Modify: `src/db/client.ts`, `src/db/migrate.ts`, `package.json` (`engines`), `.env.example`
- Test: `tests/db/client.test.ts`

**Interfaces:**
- Produces:
  - `dbOptions(url: string, env?: NodeJS.ProcessEnv, overrides?: { statementTimeoutMs?: number }): postgres.Options<{}>` (exportada) devuelve:
    - `prepare: false` e `idle_timeout: 20` si el host de la URL contiene `-pooler` o si `DB_POOLED=true`.
    - `max: Number(DB_POOL_MAX)`, o el valor por defecto de postgres-js si no está definida.
    - `connection: { statement_timeout }` **solo si la URL no es *pooled*** (PgBouncer rechaza parámetros de arranque desconocidos), tomando `overrides.statementTimeoutMs` si está definido y, si no, `DB_STATEMENT_TIMEOUT_MS`.
    - `ssl: 'verify-full'` si la URL no apunta a `localhost` o `127.0.0.1`.
  - `getDb(url?, overrides?)` usa `dbOptions`; la caché distingue por URL **y** por `overrides`.
  - `migrate.ts` usa `DATABASE_URL_DIRECT ?? DATABASE_URL` con `statementTimeoutMs: 0`. Las tareas (`daily`, `sync`, `health`) hacen lo mismo.

- [ ] **Step 1: Tests**:
  - `disables prepared statements for pooled urls`: `dbOptions('postgres://u:p@ep-x-pooler…/db')` → `prepare === false`, `ssl === 'verify-full'` e `idle_timeout === 20`.
  - `keeps defaults locally`: con `localhost`, `prepare` no es `false` y `ssl` es `undefined`.
  - `reads pool size and statement timeout`: con env `{DB_POOL_MAX:'1', DB_STATEMENT_TIMEOUT_MS:'5000'}` sobre URL no *pooled* → `max === 1` y `connection.statement_timeout === 5000`.
  - `never sends statement_timeout as a startup parameter through a pooler`: URL *pooled* (o `DB_POOLED=true`) con `DB_STATEMENT_TIMEOUT_MS` → sin `connection.statement_timeout`.
  - `applies an explicit statement timeout override on direct urls`: URL directa con `{statementTimeoutMs: 0}` → `connection.statement_timeout === 0`.
  - `caches per url and per overrides`: `getDb(url)` y `getDb(url, {statementTimeoutMs: 0})` devuelven instancias distintas y estables.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar y añadir `"engines": { "node": ">=22.19" }`. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(db): production connection options for Neon pooled connections`.

---

### Task 2: Límite de reproducciones por IP y retención

**Files:**
- Modify: `src/db/schema.ts` (columna `plays.ipHash`), `src/catalog/plays.ts`, `src/app/api/reproducciones/handle-play.ts`, `src/app/api/reproducciones/route.ts`, `tests/helpers/db.ts` si hace falta
- Create: `drizzle/0003_*.sql` (generado), `src/lib/client-ip.ts`
- Test: `tests/catalog/plays.test.ts`, `tests/app/reproducciones-route.test.ts`, `tests/lib/client-ip.test.ts`

**Interfaces:**
- Produces:
  - Columna `plays.ipHash text` (puede ser nula) e índice `(ip_hash, created_at)`.
  - `PLAYS_PER_IP_HOUR = 30` y `PLAYS_PER_IP_DAY = 200`.
  - `hashIp(ip: string, salt: string): string`: sha256 de `salt + ip` en hexadecimal.
  - `clientIpFromHeaders(h: Headers): string | null`: primera IP de `x-forwarded-for` sin espacios, o si no `x-real-ip`, o si no `null`.
  - `recordPlay(db, stationId, sessionId, ipHash?: string | null): Promise<'counted' | 'duplicate' | 'not-found' | 'rate-limited'>`.
    - Si llega `ipHash`, dentro de la transacción y después de bloquear la emisora, cuenta las filas con ese `ip_hash` de la última hora y de las últimas 24 h.
    - Si alcanza un límite, devuelve `rate-limited` sin insertar.
  - `pruneOldPlays(db: Db, days = 35): Promise<number>`: borra y devuelve cuántas filas ha borrado.
  - `handlePlay(db, request, opts?: { salt?: string })`: obtiene la IP con `clientIpFromHeaders`. Si hay IP y `salt`, pasa el hash. `rate-limited` → `429` con `Retry-After: 3600`.
  - `route.ts` pasa `{ salt: process.env.PLAYS_IP_SALT }`. Si falta `PLAYS_IP_SALT` en producción (`NODE_ENV === 'production'`), registra un aviso una sola vez y no limita.

- [ ] **Step 1: Tests**:
  - `rate-limits counted plays per ip`: 30 reproducciones con el mismo `ipHash` y distintas sesiones → `counted`. La 31.ª → `rate-limited`. `play_count` queda en 30.
  - `daily cap`: 200 filas ya insertadas con ese `ipHash` repartidas en las últimas 23 h (`created_at` explícito) → `rate-limited`.
  - `other ips unaffected`: con otro `ipHash` → `counted`.
  - `prunes plays older than 35 days`: filas de hace 36 y de hace 10 días → borra 1.
  - `clientIpFromHeaders`: `'203.0.113.5, 10.0.0.1'` → `'203.0.113.5'`. Con solo `x-real-ip` se usa esa. Sin cabeceras → `null`.
  - Ruta: la 31.ª petición con el mismo `x-forwarded-for` → `429` y la cabecera `retry-after: 3600`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar y ejecutar `npm run db:generate`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(plays): per-ip rate limit with hashed ips and 35-day retention`.

---

### Task 3: Endurecer el proxy para producción

**Files:**
- Modify: `src/proxy/handler.ts`, `src/proxy/server.ts`
- Create: `src/proxy/client-key.ts`, `src/proxy/log.ts`
- Test: `tests/proxy/handler.test.ts`, `tests/proxy/client-key.test.ts`

**Interfaces:**
- Produces:
  - `clientKey(req: IncomingMessage, trustedHeader?: string): string`. Toma la IP de la cabecera de confianza (primer valor, sin espacios) si se ha configurado y viene en la petición. Si no, usa `req.socket.remoteAddress ?? 'unknown'`. Las IPv6 se reducen a sus 4 primeros grupos más `::/64`. Las IPv4 y las IPv4 mapeadas (`::ffff:a.b.c.d`) se devuelven como `a.b.c.d`.
  - `ProxyDeps` añade:
    - `clientKey(req): string`
    - `log(entry: { status: number; stationId: string | null; reason: string }): void`
    - `lookupTimeoutMs: number` (3000)
  - Comportamiento nuevo del handler:
    - Si hay `Referer` y su origen no es `webOrigin` → `403`, razón `foreign_referer`. Se comprueba antes del limitador.
    - Si `findStreamUrl` no responde en `lookupTimeoutMs` o lanza un error → `503`, razón `lookup_timeout` o `lookup_error`.
    - `429` y `503` llevan `Retry-After: 30`.
    - Cada respuesta que no sea 200 ni 204 llama a `log` con una razón: `method`, `not_found`, `per_ip_limit`, `total_limit`, `blocked_url`, `upstream_status`, `unsupported_type`, `headers_timeout`, `too_many_redirects`, `upstream_error`, `foreign_referer`, `lookup_timeout` o `lookup_error`.
  - `log` por defecto (`src/proxy/log.ts`) escribe en stdout `JSON.stringify({ ts: new Date().toISOString(), event: 'proxy_error', ...entry })`.
  - `server.ts`: `clientKey: (req) => clientKey(req, process.env.TRUSTED_CLIENT_IP_HEADER)`. El catch-all `500` también lleva las cabeceras CORS y `no-store`.

- [ ] **Step 1: Tests**:
  - `uses trusted client ip header`: con `trustedHeader = 'fly-client-ip'` y peticiones desde 127.0.0.1 con `fly-client-ip` 198.51.100.1, .2, .3 y .4, todas a la vez y con `perIp = 1`, ninguna recibe 429.
  - `groups ipv6 by /64`: `clientKey` de `2001:db8:1:2::5` y de `2001:db8:1:2:ffff::1` da la misma clave; de `2001:db8:1:3::1` da otra.
  - `maps ipv4-mapped`: `::ffff:203.0.113.9` → `203.0.113.9`.
  - `rejects foreign referer`: `Referer: https://evil.example/page` → 403 y `log` llamado con `foreign_referer`. Con `Referer` de `webOrigin` → 200. Sin `Referer` → 200.
  - `times out station lookup`: `findStreamUrl` que no resuelve y `lookupTimeoutMs = 100` → 503 con `retry-after: 30`.
  - `logs non-200 responses`: un caso 404 → `log` recibe `{status:404, reason:'not_found'}`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm test -- tests/proxy` → PASS. Los tests anteriores del proxy siguen pasando.
- [ ] **Step 5:** Commit `feat(proxy): trusted client ip, referer check, lookup timeout and structured logs`.

---

### Task 4: Tarea diaria y salvaguarda de la comprobación de salud

**Files:**
- Modify: `src/catalog/health.ts`
- Create: `src/jobs/daily.ts`, `src/jobs/run-phases.ts`
- Test: `tests/catalog/health.test.ts`, `tests/jobs/run-phases.test.ts`

**Interfaces:**
- Produces:
  - `HEALTH_ABORT_FAILURE_RATE = 0.5`.
  - `runHealthCheck(db, opts)` en dos fases:
    1. Comprueba todas las emisoras activas y guarda los resultados en memoria.
    2. Si `failed / checked > 0.5`, no actualiza ninguna fila y devuelve `{ ...counts, aborted: true }`. Si no, aplica las actualizaciones como hasta ahora y devuelve `aborted: false`.
  - `runPhases(phases: Array<{ name: string; run: () => Promise<unknown> }>, log: (line: object) => void): Promise<{ ok: boolean; results: Record<string, unknown> }>`. Ejecuta las fases en orden, registra `{event:'phase_done', name, result}` o `{event:'phase_failed', name, error}` y sigue aunque una falle.
  - `src/jobs/daily.ts`:
    - Ejecuta las fases `sync` (`fetchAllStations` + `syncCatalog`), `prune` (`pruneOldPlays`) y `health` (`runHealthCheck`).
    - Si `health` devuelve `aborted`, registra `health_aborted_high_failure_rate`.
    - Sale con código 0 si todas las fases fueron bien y 1 si no. Cierra la conexión a la base de datos.
    - `package.json`: script `job:daily`.

- [ ] **Step 1: Tests**:
  - `aborts when failure rate is too high`: 4 emisoras con 3 fallos → `aborted === true` y ningún `healthConsecutiveFailures` cambia.
  - `applies when failure rate is acceptable`: 4 emisoras con 1 fallo → `aborted === false` y los contadores se actualizan.
  - `runPhases continues after a failure`: la fase 2 lanza un error → la fase 3 se ejecuta, `ok === false` y el registro incluye `phase_failed` con el nombre de la fase.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(jobs): daily job with phase isolation and health abort safeguard`.

---

### Task 5: Empaquetado, imagen Docker y configuración de Fly y Vercel

**Files:**
- Create: `scripts/build-services.mjs`, `Dockerfile`, `.dockerignore`, `fly.toml`, `vercel.json`
- Modify: `package.json` (scripts `build:services`, devDependency `esbuild`), `README.md` (sección «Producción»), `.env.example`
- Test: `tests/build/services.test.ts`

**Interfaces:**
- Produces:
  - `scripts/build-services.mjs` empaqueta con esbuild:
    - Entradas: `src/proxy/server.ts`, `src/jobs/daily.ts`, `src/jobs/sync.ts`, `src/jobs/health.ts` y `src/db/migrate.ts`.
    - Salida en `dist/`: `proxy.mjs`, `daily.mjs`, `sync.mjs`, `health.mjs` y `migrate.mjs`.
    - Opciones: `bundle`, `platform: 'node'`, `format: 'esm'`, `target: 'node22'`, alias `@` → `src`, `packages: 'external'`.
    - Añade un banner con `createRequire` por compatibilidad con CJS.
  - `migrate.mjs` busca la carpeta `drizzle/` relativa a `process.cwd()`. La imagen copia esa carpeta.
  - `Dockerfile` (multi-stage):
    1. `deps`: `npm ci`.
    2. `build`: `npm run build:services`.
    3. `runtime` (`node:24-slim`): `npm ci --omit=dev`, copia `dist/` y `drizzle/`, `USER node`, `EXPOSE 4100` y `CMD ["node","dist/proxy.mjs"]`.
  - `fly.toml`:
    - `app = "directoradio-audio"` y `primary_region = "fra"`.
    - `[env]`: `AUDIO_PROXY_PORT=4100`, `WEB_ORIGIN=https://directoradio.com` y `TRUSTED_CLIENT_IP_HEADER=fly-client-ip`.
    - `[http_service]`: `internal_port=4100`, `force_https=true`, `auto_stop_machines="off"`, `min_machines_running=1`, `concurrency` de tipo `connections` con `soft_limit=180` y `hard_limit=200`.
    - Healthcheck HTTP en `/healthz` cada 15 s.
    - `[[vm]]` con `memory="512mb"`.
  - `vercel.json`: `{ "regions": ["fra1"] }`.
  - El `README.md` documenta el despliegue (Neon, Fly, Vercel y DNS en Cloudflare) siguiendo la sección «Puesta en producción» de este plan.

- [ ] **Step 1: Test** `tests/build/services.test.ts` (entorno node, timeout 60 s):
  - Ejecuta `node scripts/build-services.mjs` y comprueba que existen los cinco ficheros en `dist/`.
  - Comprueba que ninguno contiene `from "@/` (alias resuelto).
  - Comprueba que `node dist/proxy.mjs` arranca con `AUDIO_PROXY_PORT` libre y responde `200 ok` en `/healthz`, y después lo detiene.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. `dist/` en `.gitignore`.
- [ ] **Step 4:** PASS. Si Docker está disponible: `docker build -t directoradio-audio .` → OK. `docker run --rm -p 4100:4100 -e DATABASE_URL=postgres://x@localhost/x directoradio-audio` y `/healthz` → 200. Si no está disponible, anotarlo en el informe.
- [ ] **Step 5:** Commit `build: bundle services with esbuild and add Fly/Vercel configuration`.

---

## Puesta en producción (la ejecuta el controlador con el responsable, tras las tareas 1–5)

Estos pasos tocan sistemas externos y cuentas del responsable. El controlador los ejecuta uno a uno y se detiene cuando hace falta una acción del responsable: iniciar sesión, pegar un secreto o crear algo en una interfaz web. Ningún secreto pasa por el chat.

- [x] **P1 · CLIs:**
  - Instalar `flyctl` (`winget install Fly-io.flyctl` o script oficial) y la CLI de Vercel (`npm i -g vercel`).
  - El responsable inicia sesión: `fly auth login` y `vercel login`.
- [x] **P2 · Neon (lo hace el responsable en la interfaz web):**
  - Crear el proyecto `directoradio`, región **AWS Europe Central 1 (Frankfurt)**, Postgres 17.
  - Copiar la cadena *pooled* y la directa en `.env.production.local` como `DATABASE_URL` y `DATABASE_URL_DIRECT`.
  - Generar `PLAYS_IP_SALT` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y añadirlo al mismo fichero.
- [x] **P3 · Fly (app y secretos):**
  - `fly apps create directoradio-audio`.
  - Subir los secretos desde el fichero, sin mostrar valores (`fly secrets import` lee de la entrada estándar). En PowerShell:
    ```powershell
    Get-Content .env.production.local | Select-String '^(DATABASE_URL|DATABASE_URL_DIRECT)=' | ForEach-Object { $_.Line } | fly secrets import -a directoradio-audio
    ```
    `RADIO_BROWSER_BASE_URL` no es secreto y va en `[env]` de `fly.toml`.
  - `fly deploy --ha=false`.
  - Comprobar que `https://directoradio-audio.fly.dev/healthz` responde 200.
- [x] **P4 · Límite de consulta, migraciones y primera carga, desde Fly** (la red corporativa puede bloquear el puerto 5432 y ralentiza los streams):
  - Fijar **una sola vez** el límite por rol, conectando por la **cadena directa** (la *pooled* de Neon va por PgBouncer y rechaza `statement_timeout` como parámetro de arranque):
    ```sql
    ALTER ROLE <rol_de_neon> SET statement_timeout = '5s';
    ```
    Afecta a la web (Vercel) y al proxy, que entran por el *pooler*. Las tareas lo anulan a 0 en su conexión directa, porque sincronizar y comprobar salud lleva minutos.
  - Obtener la imagen desplegada: `fly releases --image -a directoradio-audio` (primera fila) o `fly image show -a directoradio-audio`.
  - `fly machine run <imagen_desplegada> node dist/migrate.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio`.
  - `fly machine run <imagen_desplegada> node dist/sync.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio`. Se espera `inserted` > 40000.
- [x] **P5 · Primera comprobación de salud manual:**
  - `fly machine run <imagen_desplegada> node dist/health.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio`.
  - Si `failed / checked > 0.3`, parar y analizar con el responsable antes de seguir.
- [x] **P6 · Tarea diaria:**
  - `fly machine run <imagen_desplegada> node dist/daily.mjs --schedule daily --restart no --region fra --vm-memory 1024 -a directoradio-audio`.
  - La máquina programada queda anclada a esa imagen: tras cada `fly deploy` posterior hay que actualizarla con `fly machine update <id_maquina_diaria> --image <nueva_imagen> -a directoradio-audio`.
- [x] **P7 · Vercel:**
  - Importar el repositorio de GitHub (interfaz web o `vercel link`).
  - Cargar las variables de entorno de producción desde el fichero: `DATABASE_URL` (cadena *pooled*), `DB_POOL_MAX=1`, `NEXT_PUBLIC_AUDIO_PROXY_URL=https://audio.directoradio.com` y `PLAYS_IP_SALT`. Sin `DB_STATEMENT_TIMEOUT_MS`: el límite lo pone el rol de Neon.
  - Desplegar en producción.
- [x] **P8 · Dominios y DNS (Cloudflare, «DNS only»):**
  - Vercel: añadir `directoradio.com` (principal) y `www.directoradio.com` (redirección 308), y crear en Cloudflare los registros que indique Vercel.
  - Fly: `fly certs add audio.directoradio.com` y crear en Cloudflare `CNAME audio → directoradio-audio.fly.dev`.
  - Esperar a que ambos certificados estén emitidos.
- [x] **P9 · Comprobación final en producción:**
  - La portada carga con emisoras españolas primero.
  - Suena una emisora `https` y una `http` (pasando por `audio.directoradio.com`).
  - La primera reproducción devuelve `204` en `/api/reproducciones`.
  - La 31.ª reproducción desde la misma IP en una hora devuelve `429`: confirma que `PLAYS_IP_SALT` está puesta y que la IP se lee bien en Vercel.
  - `curl -H "Referer: https://evil.example/" https://audio.directoradio.com/stream/{id}` → 403.
  - `fly logs` muestra líneas `proxy_error` legibles.
