import { build } from 'esbuild'
import path from 'node:path'

const entries = {
  proxy: 'src/proxy/server.ts',
  daily: 'src/jobs/daily.ts',
  sync: 'src/jobs/sync.ts',
  health: 'src/jobs/health.ts',
  migrate: 'src/db/migrate.ts',
}

await build({
  entryPoints: Object.fromEntries(
    Object.entries(entries).map(([name, file]) => [name, path.resolve(file)]),
  ),
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  alias: { '@': path.resolve('src') },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
})
