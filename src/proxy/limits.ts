export type AcquireResult = 'ok' | 'per-ip' | 'total'

export class ConnectionLimiter {
  private readonly perIpCounts = new Map<string, number>()
  private total = 0

  constructor(
    private readonly perIp: number,
    private readonly maxTotal: number,
  ) {}

  tryAcquire(ip: string): AcquireResult {
    if (this.total >= this.maxTotal) return 'total'
    const current = this.perIpCounts.get(ip) ?? 0
    if (current >= this.perIp) return 'per-ip'
    this.perIpCounts.set(ip, current + 1)
    this.total++
    return 'ok'
  }

  release(ip: string): void {
    const current = this.perIpCounts.get(ip)
    if (!current) return
    if (current === 1) this.perIpCounts.delete(ip)
    else this.perIpCounts.set(ip, current - 1)
    this.total--
  }

  count(ip?: string): number {
    return ip === undefined ? this.total : (this.perIpCounts.get(ip) ?? 0)
  }
}
