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

## Tests

```bash
npm test                      # Vitest (requiere la base de datos de test)
npx playwright install chromium
npm run test:e2e              # compila, migra y levanta el servidor en el puerto 3100
```

Tras un proxy corporativo con inspección TLS, instala el navegador con `NODE_OPTIONS=--use-system-ca`.

Los tests usan exclusivamente `DATABASE_URL_TEST` y se niegan a ejecutarse si la base de datos no es `directoradio_test`.

## Documentación

Diseño y planes de implementación en [docs/superpowers/](docs/superpowers/).
