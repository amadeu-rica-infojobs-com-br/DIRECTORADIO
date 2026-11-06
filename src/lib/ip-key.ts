import { isIP } from 'node:net'

// Expands any valid IPv6 text form into 8 16-bit groups.
function ipv6Groups(ip: string): number[] {
  let addr = ip
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

/** Grouping key for rate limits: IPv4 as is, IPv6 by its /64 prefix, anything else `null`. */
export function ipKey(ip: string): string | null {
  const kind = isIP(ip)
  if (kind === 4) return ip
  if (kind !== 6) return null
  const g = ipv6Groups(ip)
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`
  }
  const prefix = g
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(':')
  return `${prefix}::/64`
}
