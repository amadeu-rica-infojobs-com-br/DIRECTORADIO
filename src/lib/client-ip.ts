export function clientIpFromHeaders(h: Headers): string | null {
  const first = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (first) return first
  return h.get('x-real-ip')?.trim() || null
}
