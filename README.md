# DirectoRadio

Directorio de emisoras de radio online (Next.js 16, Tailwind 4, Drizzle + Postgres).

## Requisitos

- Node 24
- Docker

## Puesta en marcha

```bash
docker compose up -d          # Postgres (directoradio y directoradio_test)
cp .env.example .env.local    # en PowerShell: Copy-Item .env.example .env.local
npm install
npm run db:migrate
npm run job:sync              # importa el catálogo desde Radio-Browser
npm run job:health            # comprueba los streams; es lento con el catálogo completo
npm run dev
```

Desde redes corporativas con proxy/inspección TLS muchos streams no responden; no ejecutes `job:health` contra tu BD local para ocultar emisoras: sus resultados solo son fiables desde el servidor de producción.

## Proxy de audio

Los streams se reproducen a través de un servicio aparte (`GET /stream/{id}`), que valida el origen contra SSRF y limita las conexiones (3 por IP, 200 en total).

```bash
npm run proxy                 # escucha en AUDIO_PROXY_PORT (4100); comprobación en /healthz
```

Variables: `AUDIO_PROXY_PORT`, `WEB_ORIGIN` (origen CORS permitido) y `NEXT_PUBLIC_AUDIO_PROXY_URL` (URL que usa el reproductor web).

## Tests

```bash
npm test                      # Vitest (requiere la base de datos de test)
npx playwright install chromium
npm run test:e2e              # compila, migra y levanta el servidor en el puerto 3100
```

Tras un proxy corporativo con inspección TLS, instala el navegador con `NODE_OPTIONS=--use-system-ca`.

Los tests usan exclusivamente `DATABASE_URL_TEST` y se niegan a ejecutarse si la base de datos no es `directoradio_test`.

## Producción

Arquitectura: web en Vercel (`fra1`), proxy de audio y tareas en Fly (`mad`), Postgres en Neon (Frankfurt) y DNS en Cloudflare. Los servicios de Fly se empaquetan con `npm run build:services` (esbuild → `dist/*.mjs`) y se despliegan con el `Dockerfile` y `fly.toml`.

Los secretos viven en `.env.production.local` (ignorado por git) y nunca se escriben en el repositorio ni en la configuración.

1. **CLIs:** instala `flyctl` (`winget install Fly-io.flyctl`) y la CLI de Vercel (`npm i -g vercel`); inicia sesión con `fly auth login` y `vercel login`.
2. **Neon:** crea el proyecto `directoradio` (AWS Europe Central 1 – Frankfurt, Postgres 17). Guarda en `.env.production.local` la cadena *pooled* como `DATABASE_URL` y la directa como `DATABASE_URL_DIRECT`. Genera `PLAYS_IP_SALT` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y añádelo al mismo fichero.
3. **Fly (app y secretos):** `fly apps create directoradio-audio`. Sube `DATABASE_URL` y `DATABASE_URL_DIRECT` sin mostrarlos; `fly secrets import` lee de la entrada estándar, p. ej. en bash `grep -E '^(DATABASE_URL|DATABASE_URL_DIRECT)=' .env.production.local | fly secrets import`. Despliega con `fly deploy` y comprueba que `https://directoradio-audio.fly.dev/healthz` responde 200.
4. **Migraciones y primera carga, desde Fly** (la red corporativa puede bloquear el puerto 5432):
   ```bash
   fly machine run . --command "node dist/migrate.mjs" --rm
   fly machine run . --command "node dist/sync.mjs" --rm      # se espera inserted > 40000
   ```
5. **Primera comprobación de salud:** `fly machine run . --command "node dist/health.mjs" --rm`. Si `failed / checked > 0.3`, para y analiza antes de seguir.
6. **Tarea diaria:** `fly machine run . --schedule daily --command "node dist/daily.mjs"` (región `mad`).
7. **Vercel:** importa el repositorio de GitHub (o `vercel link`) y carga las variables de producción desde el fichero: `DATABASE_URL`, `DB_POOL_MAX=1`, `DB_STATEMENT_TIMEOUT_MS=5000`, `NEXT_PUBLIC_AUDIO_PROXY_URL=https://audio.directoradio.com` y `PLAYS_IP_SALT`. Despliega a producción.
8. **Dominios y DNS (Cloudflare):** todos los registros en modo **«DNS only»** (sin proxy naranja).
   - Vercel: añade `directoradio.com` (principal) y `www.directoradio.com` (redirección 308) y crea en Cloudflare los registros que indique Vercel.
   - Fly: `fly certs add audio.directoradio.com` y `CNAME audio → directoradio-audio.fly.dev`.
   - Espera a que ambos certificados estén emitidos.
9. **Comprobación final:** la portada carga con emisoras españolas primero; suena una emisora `https` y otra `http` (vía `audio.directoradio.com`); la primera reproducción devuelve `204` en `/api/reproducciones`; `curl -H "Referer: https://evil.example/" https://audio.directoradio.com/stream/{id}` devuelve 403; `fly logs` muestra líneas `proxy_error` legibles.

Seguridad: el proxy confía en la cabecera `Fly-Client-IP` (`TRUSTED_CLIENT_IP_HEADER`) para limitar conexiones por IP porque el edge de Fly es el único ingress. No expongas la app por otra vía de entrada (túneles, otro proxy o IP pública directa), o la cabecera podría falsificarse.

## Documentación

Diseño y planes de implementación en [docs/superpowers/](docs/superpowers/).
