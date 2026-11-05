import { isIP } from 'node:net'
import { lookup as dnsLookup } from 'node:dns/promises'

export type Lookup = (host: string) => Promise<string[]>

export const defaultLookup: Lookup = async (host) => {
  const results = await dnsLookup(host, { all: true })
  return results.map((r) => r.address)
}

function isPublicIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  const c = Number(ip.split('.')[2])
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false // 192.0.0.0/24, 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return false // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return false // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return false // 203.0.113.0/24
  if (a >= 224) return false // multicast 224/4 and reserved 240/4
  return true
}

// Expands any valid IPv6 text form into 8 16-bit groups.
function ipv6Groups(ip: string): number[] {
  let addr = ip.split('%')[0]
  const dotted = addr.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const [a, b, c, d] = dotted[2].split('.').map(Number)
    addr = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = addr.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail === undefined ? [] : tail ? tail.split(':') : []
  const fill = tail === undefined ? 0 : 8 - headParts.length - tailParts.length
  return [...headParts, ...Array<string>(fill).fill('0'), ...tailParts].map((g) => parseInt(g, 16))
}

function embeddedV4(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

function isPublicIPv6(ip: string): boolean {
  const g = ipv6Groups(ip)
  const firstFiveZero = g.slice(0, 5).every((x) => x === 0)
  // ::/96 covers unspecified, loopback and deprecated IPv4-compatible forms.
  if (firstFiveZero && g[5] === 0) return false
  // ::ffff:0:0/96 IPv4-mapped
  if (firstFiveZero && g[5] === 0xffff) return isPublicIPv4(embeddedV4(g[6], g[7]))
  // 64:ff9b::/96 NAT64
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isPublicIPv4(embeddedV4(g[6], g[7]))
  }
  if ((g[0] & 0xffc0) === 0xfe80) return false // link-local fe80::/10
  // ::ffff:0:0:0/96 SIIT
  if (g.slice(0, 4).every((x) => x === 0) && g[4] === 0xffff && g[5] === 0) {
    return isPublicIPv4(embeddedV4(g[6], g[7]))
  }
  if (g[0] === 0x2002) return isPublicIPv4(embeddedV4(g[1], g[2])) // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return false // Teredo 2001::/32
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false // documentation
  if ((g[0] & 0xfe00) === 0xfc00) return false // ULA fc00::/7
  if ((g[0] & 0xff00) === 0xff00) return false // multicast ff00::/8
  return true
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPublicIPv4(ip)
  if (version === 6) return isPublicIPv6(ip)
  return false
}

export async function isPublicHttpUrl(
  url: string,
  lookup: Lookup = defaultLookup,
): Promise<boolean> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

    const host = parsed.hostname.replace(/^\[|\]$/g, '')
    if (!host) return false
    if (isIP(host)) return isPublicIp(host)

    const addresses = await lookup(host)
    if (addresses.length === 0) return false
    return addresses.every(isPublicIp)
  } catch {
    return false
  }
}
