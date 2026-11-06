export type ProxyLogEntry = { status: number; stationId: string | null; reason: string }

export function logProxyError(entry: ProxyLogEntry): void {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), event: 'proxy_error', ...entry })}\n`,
  )
}
