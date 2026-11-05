// Política única de formatos: la salud del catálogo, el proxy y el reproductor deben coincidir,
// o la portada acabaría listando emisoras que el reproductor nunca puede sonar.

const PLAYLIST_TYPES = ['audio/x-scpls', 'audio/scpls', 'audio/mpegurl', 'audio/x-mpegurl', 'application/pls+xml']
// audio/* cubre también formatos de lista (.pls/.m3u/.asx), que no son audio continuo.
const PLAYLIST_SUBTYPE = /mpegurl|scpls|x-pls|playlist|x-ms-asx|x-pn-realaudio/
const HLS_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl', 'audio/x-mpegurl']
const PROXYABLE_APPLICATION_TYPES = ['application/ogg', 'application/octet-stream']

function normalize(contentType: string | null): string {
  return (contentType ?? '').split(';')[0].trim().toLowerCase()
}

export function isPlaylistContentType(contentType: string | null): boolean {
  const type = normalize(contentType)
  if (PLAYLIST_TYPES.includes(type)) return true
  return type.startsWith('audio/') && PLAYLIST_SUBTYPE.test(type)
}

export function isHlsContentType(contentType: string | null): boolean {
  return HLS_TYPES.includes(normalize(contentType))
}

export function isProxyableAudioContentType(contentType: string | null): boolean {
  const type = normalize(contentType)
  if (PROXYABLE_APPLICATION_TYPES.includes(type)) return true
  return type.startsWith('audio/') && !isPlaylistContentType(type)
}

export function isHlsUrl(url: URL): boolean {
  return url.pathname.toLowerCase().endsWith('.m3u8')
}

export function isPlaylistUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase()
  return path.endsWith('.pls') || path.endsWith('.m3u')
}

export function isPlayableByPlayer(finalUrl: string, contentType: string | null): boolean {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (isPlaylistUrl(url)) return false

  // HLS solo en https: el proxy reemite audio plano y los segmentos http quedarían sin proxiar.
  if (isHlsUrl(url) || isHlsContentType(contentType)) return url.protocol === 'https:'
  if (isPlaylistContentType(contentType)) return false
  return isProxyableAudioContentType(contentType)
}
