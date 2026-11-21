# DirectoRadio

Directorio de emisoras de radio online para escucharlas en directo desde el navegador, gratis y sin descargas. Está en producción en **https://directoradio.com**.

## 1. Idea general

DirectoRadio reúne en un solo sitio más de 40.000 emisoras de radio de todo el mundo. El usuario puede encontrarlas por nombre, país, idioma o género, y escucharlas sin salir de la web. La interfaz está en español y da prioridad a las emisoras españolas.

El catálogo no se mantiene a mano:
- Cada día se importa de [Radio-Browser](https://www.radio-browser.info/), un directorio abierto y colaborativo de emisoras.
- Se comprueba qué emisoras siguen emitiendo y se ocultan las que fallan.
- Las emisoras se ordenan por las reproducciones que reciben en la propia web.

Algunas emisoras solo emiten por `http`, que el navegador bloquea dentro de una web `https`. Para que se puedan escuchar igualmente, el audio pasa por un **proxy propio**, que además protege contra usos indebidos.

Decisión de diseño: por ahora el proyecto **no usa servicios de IA**. El buscador funciona por campos y las emisoras similares se calculan con reglas.

## 2. Funcionalidades principales

- **Portada «Las más escuchadas»:** las emisoras ordenadas por popularidad (primero las españolas), con paginación.
- **Buscador por campos** (`/buscar`):
  - Busca por nombre sin distinguir tildes, mayúsculas ni espacios, y tolera pequeñas erratas.
  - Filtra por país, idioma y género. Los filtros se muestran como etiquetas, que en el móvil se despliegan en una hoja inferior y en escritorio en un desplegable.
  - Funciona también sin JavaScript.
  - Los resultados tienen una URL propia, que se puede compartir.
- **Ficha de cada emisora** (`/emisora/{slug}`): logo, país, idiomas, género, web oficial, número de reproducciones, valoración media y emisoras similares (mismo género, país e idioma).
- **Reproductor:**
  - Reproduce streams directos y HLS.
  - El mini reproductor se mantiene mientras se navega por la web.
  - Avisa cuando una emisora no está emitiendo.
- **Contador de reproducciones:** con límite por IP (guardada solo como hash) para que no se pueda inflar.
- **Valoraciones de 1 a 5 estrellas con email verificado:**
  - El voto cuenta cuando el usuario confirma el enlace que recibe por email.
  - Protección contra robots con Cloudflare Turnstile y límites de intentos por IP y por email.
  - Tras la primera verificación, una cookie firmada permite volver a votar sin otro email.
  - Hay procedimiento de borrado de datos a petición del usuario (RGPD).
- **Analítica con consentimiento:** Google Tag Manager con Consent Mode v2. Las cookies de analítica solo se activan si el usuario las acepta, y puede cambiar su elección desde el pie de página.
- **Textos legales:** aviso legal, política de privacidad y política de cookies. La web no compila con las valoraciones activadas si faltan los datos del titular.
- **Marca:** logo, favicon, icono para iOS e imagen para redes sociales, generados desde un único diseño (`npm run icons`).
- **Tareas automáticas diarias:** sincronización del catálogo, comprobación de streams y limpieza de datos caducados.

## 3. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Web | [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions), React 19, TypeScript |
| Estilos | Tailwind CSS 4 (modo oscuro automático) |
| Base de datos | PostgreSQL 17 con las extensiones `pg_trgm` y `unaccent` (búsqueda por texto) |
| Acceso a datos | Drizzle ORM y drizzle-kit (migraciones), driver `postgres` |
| Audio | hls.js en el navegador; proxy de audio en Node.js con `undici` |
| Tareas y servicios | Node.js 24, empaquetados con esbuild (`dist/*.mjs`) |
| Tests | Vitest y Testing Library (unitarios y de integración, con base de datos real); Playwright (end-to-end) |
| Calidad | ESLint (`eslint-config-next`) y TypeScript estricto |
| CI/CD | GitHub Actions (despliega en Fly); Vercel (despliega la web en cada fusión a `main`) |

## 4. Servicios externos

| Servicio | Para qué | ¿Imprescindible en local? |
|---|---|---|
| **Radio-Browser API** | Origen del catálogo de emisoras (`job:sync`) | Sí, para importar emisoras (es gratuita y no necesita clave) |
| **Docker** | Postgres local y Postgres de tests | Sí |
| **Vercel** | Alojamiento de la web (región Frankfurt) | No |
| **Fly.io** | Proxy de audio (`audio.directoradio.com`) y tarea diaria programada | No (el proxy se arranca en local con `npm run proxy`) |
| **Neon** | PostgreSQL gestionado en producción (Frankfurt) | No |
| **Cloudflare** | DNS del dominio (en modo «DNS only») y Turnstile (antirrobots de las valoraciones) | No (sin clave, Turnstile no se exige fuera de producción) |
| **Brevo** | Envío de los emails de verificación de las valoraciones | No (sin clave, el enlace de verificación se escribe en la consola) |
| **Google Tag Manager** | Analítica, solo con consentimiento | No |
| **GitHub** | Repositorio, pull requests y despliegue continuo del proxy | No |

## 5. Instalación y ejecución en local

### Requisitos

- **Node.js 24** (mínimo 22.19)
- **Docker Desktop** (en Windows necesita WSL2). Ábrelo antes de empezar: no arranca solo.
- Git

### Pasos

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/amadeu-rica-infojobs-com-br/DIRECTORADIO.git
cd DIRECTORADIO
npm ci

# 2. Levantar Postgres (crea las bases directoradio y directoradio_test)
docker compose up -d

# 3. Variables de entorno
cp .env.example .env.local        # en PowerShell: Copy-Item .env.example .env.local

# 4. Crear las tablas
npm run db:migrate

# 5. Importar el catálogo desde Radio-Browser (unos minutos; más de 40.000 emisoras)
npm run job:sync

# 6. Arrancar la web en http://localhost:3000
npm run dev

# 7. (Opcional, en otra terminal) Proxy de audio en http://localhost:4100,
#    necesario para escuchar las emisoras que emiten por http
npm run proxy
```

Opcional: `npm run job:health` comprueba qué streams responden y oculta los que fallan. Con el catálogo completo es lento, y desde redes corporativas con inspección TLS da falsos negativos. En ese caso no lo ejecutes contra tu base de datos local.

### Variables de entorno

Los valores de `.env.example` sirven tal cual en local. Las demás son opcionales en local y necesarias en producción.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Base de datos de la aplicación |
| `DATABASE_URL_TEST` | Base de datos de los tests (debe llamarse `directoradio_test`) |
| `DATABASE_URL_DIRECT` | Conexión directa, sin *pooler*, para migraciones y tareas (Neon) |
| `RADIO_BROWSER_BASE_URL` | Servidor de Radio-Browser |
| `AUDIO_PROXY_PORT`, `WEB_ORIGIN`, `NEXT_PUBLIC_AUDIO_PROXY_URL` | Puerto del proxy, origen permitido y URL que usa el reproductor |
| `PLAYS_IP_SALT` | Sal para guardar las IP como hash |
| `TRUSTED_CLIENT_IP_HEADER` | Cabecera con la IP real del cliente (solo detrás del edge de Fly) |
| `NEXT_PUBLIC_GTM_ID` | Contenedor de Google Tag Manager |
| `RATINGS_ENABLED`, `RATINGS_SECRET`, `SITE_URL` | Activan las valoraciones, firman la cookie de votante y forman el enlace del email |
| `BREVO_API_KEY` | Clave de API de Brevo (empieza por `xkeysib-`; una clave SMTP no sirve) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Claves de Cloudflare Turnstile |

Los secretos de producción viven en `.env.production.local` (ignorado por git) y en los paneles de Vercel y Fly. Nunca se escriben en el repositorio.

### Tests

```bash
npm test                          # Vitest; necesita Docker en marcha (base directoradio_test)
npx playwright install chromium   # solo la primera vez
npm run test:e2e                  # compila, migra, siembra datos y prueba en el puerto 3100
npm run lint
```

Los tests se niegan a ejecutarse contra una base de datos que no sea `directoradio_test`.

En Windows:
- PowerShell bloquea `npx.ps1`. Usa `cmd /c "…"` o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Vitest falla si la unidad va en minúscula (`c:\`). Lánzalo desde `C:\`.

### Otros comandos

| Comando | Qué hace |
|---|---|
| `npm run build` / `npm start` | Compilar y servir la web en modo producción |
| `npm run build:services` | Empaquetar el proxy y las tareas para Fly (`dist/`) |
| `npm run job:daily` | Ejecutar la tarea diaria completa (sincronización, salud y limpieza) |
| `npm run db:generate` | Generar una migración nueva a partir de `src/db/schema.ts` |
| `npm run icons` | Regenerar favicon, iconos e imagen para redes sociales |
| `npm run ratings:forget -- persona@example.com` | Borrar todos los datos de un email (derecho de supresión) |

El despliegue a producción (Neon, Fly, Vercel y DNS) se describe paso a paso en el [apartado 8](#8-despliegue-en-producción).

## 6. Estructura del proyecto

```
├── src/
│   ├── app/                 Rutas de Next.js (App Router)
│   │   ├── page.tsx         Portada
│   │   ├── buscar/          Buscador por campos
│   │   ├── emisora/[slug]/  Ficha de emisora
│   │   ├── valoraciones/    Confirmación del email de una valoración
│   │   ├── api/             Rutas API: reproducciones y valoraciones
│   │   ├── aviso-legal/, privacidad/, politica-de-cookies/
│   │   └── icon.svg, favicon.ico, opengraph-image.png…   Iconos generados
│   ├── catalog/             Catálogo: sincronización con Radio-Browser, salud de streams,
│   │                        búsqueda, emisoras similares y reproducciones
│   ├── components/          Componentes de interfaz (tarjetas, ficha, buscador, valoraciones…)
│   ├── player/              Reproductor global (contexto, mini reproductor, HLS)
│   ├── proxy/               Proxy de audio: validación anti-SSRF y límites de conexiones
│   ├── ratings/             Valoraciones: envío, verificación, tokens, cookie, Brevo, Turnstile
│   ├── consent/             Consentimiento de cookies y carga de Google Tag Manager
│   ├── legal/               Datos del titular y comprobación previa al despliegue
│   ├── jobs/                Tareas: sync, health, daily, forget-email
│   ├── db/                  Esquema Drizzle, cliente y migrador
│   ├── lib/                 Utilidades (países, idiomas, géneros, slugs, IP, red…)
│   ├── i18n/                Textos de la interfaz (es-ES)
│   └── brand/               Colores y geometría del logo
├── drizzle/                 Migraciones SQL
├── tests/                   Tests de Vitest (por módulo)
├── e2e/                     Tests de Playwright y datos de prueba
├── scripts/                 Empaquetado de servicios y generación de iconos
├── docker/, docker-compose.yml   Postgres local
├── Dockerfile, fly.toml     Imagen y configuración de Fly (proxy y tareas)
├── vercel.json              Configuración de Vercel
├── .github/workflows/       Despliegue continuo en Fly
└── docs/superpowers/        Diseños, planes de implementación y traspaso entre sesiones
```

## 7. Arquitectura en producción

```
Navegador ──► directoradio.com (Vercel, fra1) ──► Neon Postgres (Frankfurt)
    │                                                 ▲
    └──► audio.directoradio.com (Fly, fra) ───────────┘
            proxy de audio           tarea diaria (Fly) ──► Radio-Browser
```

- **Web:** cada fusión en `main` se publica sola en Vercel.
- **Proxy de audio:** GitHub Actions lo despliega en Fly en cada push a `main`.
- **Tarea diaria:** es una máquina programada de Fly anclada a una imagen concreta. Hay que actualizarla tras cada despliegue.
- **Más detalle:** el estado del proyecto y los pasos operativos están en [docs/superpowers/HANDOFF.md](docs/superpowers/HANDOFF.md).

## 8. Despliegue en producción

Los servicios de Fly (proxy y tareas) se empaquetan con `npm run build:services` (esbuild → `dist/*.mjs`) y se despliegan con el `Dockerfile` y `fly.toml`. La web la compila Vercel.

Los secretos viven en `.env.production.local` (ignorado por git) y en los paneles de Vercel y Fly. Nunca se escriben en el repositorio ni se pegan en logs o chats.

### Primera puesta en marcha

1. **CLIs:**
   - Instala `flyctl` (`winget install Fly-io.flyctl`) y la CLI de Vercel (`npm i -g vercel`).
   - Inicia sesión con `fly auth login` y `vercel login`.
   - En Windows, `winget` no añade `fly` al PATH de la terminal abierta: abre otra.
2. **Neon:**
   - Crea el proyecto `directoradio` (AWS Europe Central 1 – Frankfurt, Postgres 17).
   - Guarda en `.env.production.local` la cadena *pooled* como `DATABASE_URL` y la directa como `DATABASE_URL_DIRECT`.
   - Genera `PLAYS_IP_SALT` y `RATINGS_SECRET`, cada uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, y añádelos al mismo fichero.
3. **Fly, app y secretos:**
   - Crea la app con `fly apps create directoradio-audio`.
   - Sube `DATABASE_URL` y `DATABASE_URL_DIRECT` sin mostrarlos (`fly secrets import` lee de la entrada estándar):
     ```powershell
     Get-Content .env.production.local | Select-String '^(DATABASE_URL|DATABASE_URL_DIRECT)=' | ForEach-Object { $_.Line } | fly secrets import -a directoradio-audio
     ```
   - Despliega con `fly deploy --ha=false` y comprueba que `https://directoradio-audio.fly.dev/healthz` responde 200.
4. **Despliegue continuo del proxy:**
   - El workflow `.github/workflows/fly-deploy.yml` despliega en Fly en cada push a `main` que toque el código de los servicios. También se lanza a mano desde *Actions*.
   - Necesita el secreto de repositorio `FLY_API_TOKEN`, que se crea sin mostrarlo:
     ```powershell
     cmd /c "flyctl tokens create deploy -a directoradio-audio -x 8760h | gh secret set FLY_API_TOKEN"
     ```
   - Sirve también cuando la red local impide construir o subir imágenes a Fly.
5. **Límite de consulta y primera carga, desde Fly** (algunas redes bloquean el puerto 5432):
   - Fija una vez el límite por rol, sobre la **conexión directa**. La *pooled* de Neon rechaza `statement_timeout` como parámetro de arranque. El límite afecta a la web y al proxy, que entran por el *pooler*; las tareas lo anulan en su conexión directa.
     ```sql
     ALTER ROLE <rol_de_neon> SET statement_timeout = '5s';
     ```
   - Averigua la imagen desplegada con `fly releases --image -a directoradio-audio` (primera fila).
   - Ejecuta esa imagen como máquina temporal para migrar y cargar el catálogo (en la sincronización se espera `inserted > 40000`):
     ```bash
     fly machine run <imagen> node dist/migrate.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio
     fly machine run <imagen> node dist/sync.mjs    --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio
     ```
6. **Primera comprobación de salud:**
   ```bash
   fly machine run <imagen> node dist/health.mjs --rm --restart no --region fra --vm-memory 1024 -a directoradio-audio
   ```
   Si `failed / checked > 0.3`, para y analiza antes de seguir.
7. **Tarea diaria** (sincronización, salud y limpieza de valoraciones caducadas):
   ```bash
   fly machine run <imagen> node dist/daily.mjs --schedule daily --restart no --region fra --vm-memory 1024 -a directoradio-audio
   ```
8. **Vercel:**
   - Importa el repositorio de GitHub (o `vercel link`).
   - Da de alta las variables de producción con `vercel env add <NOMBRE> production`. Así el valor se escribe en la terminal y no queda en ningún fichero.
     - **Base:** `DATABASE_URL` (cadena *pooled*), `DB_POOL_MAX=1`, `NEXT_PUBLIC_AUDIO_PROXY_URL=https://audio.directoradio.com` y `PLAYS_IP_SALT`.
     - **Analítica:** `NEXT_PUBLIC_GTM_ID`.
     - **Valoraciones:** `RATINGS_ENABLED=true`, `RATINGS_SECRET`, `SITE_URL=https://directoradio.com`, `BREVO_API_KEY` (clave de API `xkeysib-…`, no SMTP), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
   - No pongas `DB_STATEMENT_TIMEOUT_MS`: el límite lo da el rol de Neon.
   - Con `RATINGS_ENABLED=true`, la compilación falla si faltan los datos del titular en `src/legal/owner.ts`.
   - Despliega a producción. Las variables `NEXT_PUBLIC_*` se fijan al compilar: si cambias alguna, vuelve a desplegar.
9. **Servicios de las valoraciones:**
   - **Brevo:** verifica el dominio del remitente (`no-responder@directoradio.com`) y crea una clave de API.
   - **Cloudflare Turnstile:** crea un widget para `directoradio.com`, que da la clave pública y la secreta.
10. **Dominios y DNS en Cloudflare**, con todos los registros en modo **«DNS only»** (nube gris). Con la nube naranja, Vercel recibe la IP de Cloudflare, lo que rompe los límites por IP, y Fly no puede emitir su certificado.
    - **Vercel:** añade `directoradio.com` (principal) y `www.directoradio.com` (redirección 308), y crea en Cloudflare los registros que indique Vercel.
    - **Fly:** ejecuta `fly certs add audio.directoradio.com` y crea `CNAME audio → directoradio-audio.fly.dev`.
    - Espera a que se emitan los dos certificados.
11. **Comprobación final:**
    - La portada carga con las emisoras españolas primero.
    - Suena una emisora `https` y otra `http`; esta última, a través de `audio.directoradio.com`.
    - La primera reproducción devuelve `204` en `/api/reproducciones`, y la 31.ª desde la misma IP en una hora devuelve `429`. Esto confirma la sal y la lectura de la IP en Vercel.
    - `curl -H "Referer: https://evil.example/" https://audio.directoradio.com/stream/{id}` devuelve 403.
    - Una valoración de prueba llega por email y, tras confirmarla, aparece en la ficha de la emisora.

### Despliegues posteriores

1. **Si hay migraciones nuevas, aplícalas a Neon antes de fusionar:**
   - Vercel publica cada fusión en `main` al momento. Si el código nuevo llega antes que la migración, las páginas dan error 500.
   - Las migraciones son aditivas, así que el código anterior funciona con ellas.
   - Desde la rama, ejecuta `npm run db:migrate` con `DATABASE_URL_DIRECT`, o lanza una máquina temporal de Fly.
2. **Fusiona la PR:** Vercel publica la web y GitHub Actions publica la imagen nueva en Fly.
3. **Actualiza la tarea diaria a la imagen nueva.** La máquina programada va anclada a una imagen, así que no la toma sola:
   ```bash
   fly releases --image -a directoradio-audio                                  # primera fila: imagen nueva
   fly machine update <id_maquina_diaria> --image <imagen> -a directoradio-audio --yes
   ```
   Para ejecutarla en el momento sin esperar a su hora, usa `fly machine start <id_maquina_diaria> -a directoradio-audio` y sigue su salida con `fly logs --no-tail --machine <id_maquina_diaria> -a directoradio-audio`.

### Seguridad

- El proxy confía en la cabecera `Fly-Client-IP` (`TRUSTED_CLIENT_IP_HEADER`) para limitar conexiones por IP, porque el edge de Fly es su única entrada.
- No expongas la app por otra vía (túneles, otro proxy o IP pública directa): la cabecera se podría falsificar.
- Para borrar los datos de un email (derecho de supresión), ejecuta `ratings:forget` o `dist/forget-email.mjs` en una máquina temporal de Fly.
  - Borra también el contacto en Brevo.
  - El procedimiento completo está en [HANDOFF.md](docs/superpowers/HANDOFF.md).
