import type { RbStation } from './types'

export const RADIO_BROWSER_USER_AGENT = 'DirectoRadio/0.1 (+https://directoradio.com)'

const DEFAULT_BASE_URL = 'https://de1.api.radio-browser.info'
const DEFAULT_PAGE_SIZE = 10000
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_RETRIES = 6
const DEFAULT_RETRY_DELAY_MS = 2000

export type RetryEvent = {
  offset: number
  /** Attempt that just failed (1-based). */
  attempt: number
  /** Wait before the next attempt. */
  delayMs: number
  error: unknown
}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`Radio-Browser request failed: ${status} ${url}`)
  }
}

// Radio-Browser resets connections intermittently (handshake or mid-body), and returns 429/5xx under load.
// Any other HTTP status is a real problem and retrying will not fix it.
function isRetryable(err: unknown): boolean {
  if (err instanceof HttpStatusError) return err.status === 429 || err.status >= 500
  return true
}

export async function fetchAllStations(
  opts: {
    baseUrl?: string
    pageSize?: number
    timeoutMs?: number
    /** Extra attempts per page after the first one. */
    retries?: number
    /** Base delay; doubles after each failed attempt. */
    retryDelayMs?: number
    onRetry?: (event: RetryEvent) => void
    fetchImpl?: typeof fetch
  } = {},
): Promise<RbStation[]> {
  const baseUrl = opts.baseUrl ?? process.env.RADIO_BROWSER_BASE_URL ?? DEFAULT_BASE_URL
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = opts.retries ?? DEFAULT_RETRIES
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const fetchImpl = opts.fetchImpl ?? fetch

  const fetchPage = async (offset: number): Promise<RbStation[]> => {
    const url = `${baseUrl}/json/stations?hidebroken=true&order=clickcount&reverse=true&limit=${pageSize}&offset=${offset}`
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetchImpl(url, {
          headers: { 'User-Agent': RADIO_BROWSER_USER_AGENT },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) throw new HttpStatusError(res.status, url)
        // Reading the body inside the try: resets often happen mid-download.
        return (await res.json()) as RbStation[]
      } catch (error) {
        if (attempt > retries || !isRetryable(error)) throw error
        const delayMs = retryDelayMs * 2 ** (attempt - 1)
        opts.onRetry?.({ offset, attempt, delayMs, error })
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  const all: RbStation[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset)
    all.push(...page)
    if (page.length < pageSize) break
  }
  return all
}
