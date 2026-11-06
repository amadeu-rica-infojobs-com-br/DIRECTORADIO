import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'
import { ipKey } from '@/lib/ip-key'

export function clientKey(req: IncomingMessage, trustedHeader?: string): string {
  if (trustedHeader) {
    const raw = req.headers[trustedHeader.toLowerCase()]
    const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0].trim()
    if (first && isIP(first)) return ipKey(first) ?? first
  }
  const remote = req.socket.remoteAddress
  return remote ? (ipKey(remote) ?? remote) : 'unknown'
}
