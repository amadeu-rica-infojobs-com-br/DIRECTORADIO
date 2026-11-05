export type PlayableStation = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  streamUrl: string
}

export type PlayableSource = { kind: 'direct' | 'hls' | 'proxy'; src: string }

function normalizeBase(base: string | undefined): string | undefined {
  const trimmed = base?.trim().replace(/\/+$/, '')
  return trimmed ? trimmed : undefined
}

export function audioProxyBase(): string | undefined {
  return normalizeBase(process.env.NEXT_PUBLIC_AUDIO_PROXY_URL)
}

export function resolveSource(
  streamUrl: string,
  proxyBase: string | undefined,
  stationId: string,
): PlayableSource | null {
  let url: URL
  try {
    url = new URL(streamUrl)
  } catch {
    return null
  }

  const isPlaylist = url.pathname.toLowerCase().endsWith('.m3u8')
  if (url.protocol === 'https:') return { kind: isPlaylist ? 'hls' : 'direct', src: streamUrl }
  if (url.protocol !== 'http:') return null
  // El proxy reemite audio plano; una lista HLS traería segmentos http sin proxiar.
  if (isPlaylist) return null

  const base = normalizeBase(proxyBase)
  if (!base) return null
  return { kind: 'proxy', src: `${base}/stream/${encodeURIComponent(stationId)}` }
}
