# Traspaso entre sesiones

Última actualización: 2026-11-13. Léelo al empezar una sesión nueva y actualízalo al terminar.

## Dónde estamos

- Hechos: planes 1, 2 y 2b (despliegue), reintentos de Radio-Browser (PR #6) y analítica con GTM y consentimiento de cookies (PR #7, [diseño](specs/2026-11-13-analitica-consentimiento-design.md)).
- **Plan 3, rama `plan-3-buscador`:** buscador por campos (`/buscar`), 4 géneros nuevos, idioma ISO y emisoras similares, **sin IA** ([diseño](specs/2026-11-13-buscador-por-campos-design.md), [plan](plans/2026-11-13-plan-3-buscador.md)). El responsable decidió no usar servicios de IA por ahora: el buscador con IA, la voz, los embeddings y las descripciones quedan aplazados.
- **Al desplegar el plan 3** (tarea 7, paso 4 del plan), con la imagen nueva que publica GitHub Actions:
  1. `fly machine run <imagen> node dist/migrate.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio`. Crea las extensiones `pg_trgm` y `unaccent`, los 4 valores del enum y la columna `language_codes`.
  2. Lo mismo con `node dist/sync.mjs`, para rellenar los códigos de idioma y recalcular géneros.
  3. `fly machine update 8d99350be19498 --image <imagen> -a directoradio-audio`, para que la tarea diaria tenga reintentos y los cambios del plan 3.
- **Pendientes del responsable** (analítica, PR #7): elegir en GTM entre Consent Mode básico o avanzado, y completar el apartado "Responsable" de la política de cookies cuando exista el aviso legal.
- Después: plan 4 (valoraciones y textos legales) y plan 5 (páginas de género y país, sitemap, schema.org).
- Forma de trabajar: skills de **superpowers** (brainstorming → writing-plans → executing-plans), con diseños en `docs/superpowers/specs/` y planes en `docs/superpowers/plans/`. Registro de avance en `.superpowers/sdd/<plan>/progress.md` (no está en git).

## Preparar la máquina nueva

1. Clonar el repositorio y ejecutar `npm ci`.
2. Superpowers en la extensión de VS Code: `/plugin` no funciona ahí. Hay que usar la CLI que viene con la extensión:
   ```powershell
   & "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-<versión>-win32-x64\resources\native-binary\claude.exe" plugin install superpowers@anthropic-plugin-directory
   ```
   El catálogo se llama `anthropic-plugin-directory`; `claude-plugins-official` no existe en este entorno. Después, recargar la ventana.
3. CLIs: `winget install Fly-io.flyctl` y `npm i -g vercel`. Después, `fly auth login` y `vercel login`. Winget no añade `fly` al PATH de la sesión abierta: hay que abrir una terminal nueva.
4. `.env.production.local` (contiene `DATABASE_URL`, `DATABASE_URL_DIRECT` y `PLAYS_IP_SALT`) no está en git. Hay que copiarlo a mano por un canal seguro o regenerarlo desde Neon. Nunca se pega en el chat.

## Producción

| Pieza | Dónde | Notas |
|---|---|---|
| Web | Vercel, proyecto `directoradio`, `fra1` | Cada fusión en `main` se publica sola. `www` → 308 → apex. |
| Proxy de audio | Fly, app `directoradio-audio`, región `fra` (`mad` está retirada) | `https://audio.directoradio.com`. Se despliega desde GitHub Actions. |
| Tarea diaria | Máquina Fly `daily-job` (`8d99350be19498`), `--schedule daily` | Va **anclada a una imagen**: tras cada deploy, `fly machine update 8d99350be19498 --image <nueva> -a directoradio-audio`. |
| Base de datos | Neon, Frankfurt, Postgres 17 | `statement_timeout = 5s` en el rol; las tareas lo anulan. |
| DNS | Cloudflare, **todo en «DNS only» (nube gris)** | Con la nube naranja, Vercel recibe la IP de Cloudflare (rompe el límite por IP) y Fly no puede emitir el certificado (525). |

Registros DNS: `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`, `A audio 66.241.124.12`, `AAAA audio 2a09:8280:1::1ec:c6f9:0` y `CNAME _acme-challenge.audio audio.directoradio.com.wkdw0lg.flydns.net`.

## Trucos aprendidos

- `fly machine run <imagen> -- node -e "..."`: sin el `--`, flyctl interpreta `-e` como su opción `--env` y la máquina ejecuta solo `node`. Para scripts con comillas, pasar el código en base64 y usar `eval(Buffer.from('...','base64').toString())`.
- Las pruebas de P9 se pueden repetir con máquinas efímeras (`--rm --restart no --detach`) y leer el resultado con `fly logs --no-tail --machine <id>`.
- Los `proxy_error` 404 `not_found` que aparecen en los logs son escáneres de Internet. No son un fallo.
- La prueba del límite de reproducciones sumó 30 reproducciones ficticias a Cadena 100 (`7cadf477-…`).
- En la red de la oficina (Netskope), los streams proxiados, `fly ssh` y el puerto 5432 no funcionan, y curl necesita `--ssl-no-revoke`. En otra red, nada de esto debería hacer falta.
- En Windows: PowerShell bloquea `npx.ps1` y `vercel.ps1` (política de ejecución). Usa `cmd /c`, `vercel.cmd` o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Vitest falla con "failed to find the current suite" si la unidad va en minúscula (`c:\`): lánzalo con `cmd /c "cd /d C:\PROJECTES\DIRECTORADIO\DIRECTORADIO && npx vitest run …"`.
- Docker Desktop no arranca solo: ábrelo antes de `npm test` o `docker compose up -d`.
- Radio-Browser (`de1`, el único servidor activo) corta conexiones a ratos; `fetchAllStations` reintenta cada página.
