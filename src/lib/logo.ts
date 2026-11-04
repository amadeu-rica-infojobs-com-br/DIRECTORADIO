export function toSafeLogoUrl(url: string | null): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol === 'https:') return parsed.href
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:'
    return parsed.href
  }
  return null
}
