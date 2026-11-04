import type { RbStation } from './types'

export const RADIO_BROWSER_USER_AGENT = 'DirectoRadio/0.1 (+https://directoradio.com)'

const DEFAULT_BASE_URL = 'https://de1.api.radio-browser.info'
const DEFAULT_PAGE_SIZE = 10000

export async function fetchAllStations(
  opts: { baseUrl?: string; pageSize?: number; fetchImpl?: typeof fetch } = {},
): Promise<RbStation[]> {
  const baseUrl = opts.baseUrl ?? process.env.RADIO_BROWSER_BASE_URL ?? DEFAULT_BASE_URL
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const fetchImpl = opts.fetchImpl ?? fetch

  const all: RbStation[] = []
  for (let offset = 0; ; offset += pageSize) {
    const url = `${baseUrl}/json/stations?hidebroken=true&order=clickcount&reverse=true&limit=${pageSize}&offset=${offset}`
    const res = await fetchImpl(url, { headers: { 'User-Agent': RADIO_BROWSER_USER_AGENT } })
    if (!res.ok) {
      throw new Error(`Radio-Browser request failed: ${res.status} ${url}`)
    }
    const page = (await res.json()) as RbStation[]
    all.push(...page)
    if (page.length < pageSize) break
  }
  return all
}
