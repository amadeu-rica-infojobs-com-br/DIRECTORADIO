import { config } from 'dotenv'
import http from 'node:http'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { stations } from '@/db/schema'
import { isPublicHttpUrl } from '@/lib/net/public-url'
import { pinnedFetch } from '@/lib/net/pinned-dispatcher'
import { createProxyHandler } from '@/proxy/handler'
import { clientKey } from '@/proxy/client-key'
import { logProxyError } from '@/proxy/log'
import { ConnectionLimiter } from '@/proxy/limits'

config({ path: '.env.local', quiet: true })

const port = Number(process.env.AUDIO_PROXY_PORT ?? 4100)
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000'

const handler = createProxyHandler({
  async findStreamUrl(id) {
    const rows = await getDb()
      .select({ streamUrl: stations.streamUrl })
      .from(stations)
      .where(and(eq(stations.id, id), eq(stations.status, 'activa')))
      .limit(1)
    return rows[0]?.streamUrl ?? null
  },
  fetchImpl: pinnedFetch,
  isAllowedUrl: (u) => isPublicHttpUrl(u),
  limiter: new ConnectionLimiter(3, 200),
  webOrigin,
  headersTimeoutMs: 10000,
  lookupTimeoutMs: 3000,
  clientKey: (req) => clientKey(req, process.env.TRUSTED_CLIENT_IP_HEADER),
  log: logProxyError,
})

const server = http.createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error(err)
    if (!res.headersSent) {
      res.writeHead(500, {
        'Access-Control-Allow-Origin': webOrigin,
        'Cache-Control': 'no-store',
        'Content-Length': '0',
      })
    }
    res.end()
  })
})

server.listen(port, () => console.log(`Audio proxy listening on :${port}`))

function shutdown() {
  server.close(() => process.exit(0))
  server.closeAllConnections()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
