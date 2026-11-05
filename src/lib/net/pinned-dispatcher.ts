import { isIP, type LookupFunction } from 'node:net'
import { Agent, buildConnector, fetch as undiciFetch, type Dispatcher } from 'undici'
import { defaultLookup, isPublicIp, type Lookup } from '@/lib/net/public-url'

export class PinnedAddressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinnedAddressError'
  }
}

export function createPinnedDispatcher(
  opts: {
    lookup?: Lookup
    isAllowed?: (ip: string) => boolean
    connectTimeoutMs?: number
  } = {},
): Dispatcher {
  const { lookup = defaultLookup, isAllowed = isPublicIp, connectTimeoutMs = 10000 } = opts

  // The address validated here is the one the socket connects to, so DNS rebinding cannot swap it.
  const pinnedLookup: LookupFunction = (hostname, options, callback) => {
    lookup(hostname).then(
      (addresses) => {
        const first = addresses[0]
        if (!first || !addresses.every(isAllowed)) {
          callback(new PinnedAddressError(`Blocked address for ${hostname}`), '', 4)
          return
        }
        const family = isIP(first)
        if (options.all) {
          callback(null, [{ address: first, family }])
        } else {
          callback(null, first, family)
        }
      },
      (err: unknown) => callback(err as NodeJS.ErrnoException, '', 4),
    )
  }

  const connector = buildConnector({ timeout: connectTimeoutMs, lookup: pinnedLookup })

  // IP-literal hosts skip DNS lookup, so they are validated here instead.
  const connect: buildConnector.connector = (options, callback) => {
    const host = options.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) && !isAllowed(host)) {
      callback(new PinnedAddressError(`Blocked address ${host}`), null)
      return
    }
    connector(options, callback)
  }

  return new Agent({ connect })
}

const defaultDispatcher = createPinnedDispatcher()

export const pinnedFetch = ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
  undiciFetch(input, { ...init, dispatcher: defaultDispatcher })) as unknown as typeof fetch
