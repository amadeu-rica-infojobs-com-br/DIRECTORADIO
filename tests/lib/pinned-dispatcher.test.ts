// @vitest-environment node
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetch } from 'undici'
import { createPinnedDispatcher, PinnedAddressError } from '@/lib/net/pinned-dispatcher'

let server: Server
let hits: number
let port: number

beforeEach(async () => {
  hits = 0
  server = createServer((_req, res) => {
    hits++
    res.end('ok')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function causeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (e) {
    return (e as Error).cause ?? e
  }
  throw new Error('expected rejection')
}

describe('createPinnedDispatcher', () => {
  it('rejects private address at connect time', async () => {
    const dispatcher = createPinnedDispatcher({ lookup: async () => ['127.0.0.1'] })
    const cause = await causeOf(fetch(`http://rebind.test:${port}/`, { dispatcher }))
    expect(cause).toBeInstanceOf(PinnedAddressError)
    expect(hits).toBe(0)
    await dispatcher.close()
  })

  it('rejects when any resolved address is not allowed', async () => {
    const dispatcher = createPinnedDispatcher({ lookup: async () => ['93.184.216.34', '127.0.0.1'] })
    const cause = await causeOf(fetch(`http://rebind.test:${port}/`, { dispatcher }))
    expect(cause).toBeInstanceOf(PinnedAddressError)
    expect(hits).toBe(0)
    await dispatcher.close()
  })

  it('rejects literal private IPs', async () => {
    const dispatcher = createPinnedDispatcher()
    const cause = await causeOf(fetch(`http://127.0.0.1:${port}/`, { dispatcher }))
    expect(cause).toBeInstanceOf(PinnedAddressError)
    expect(hits).toBe(0)
    await dispatcher.close()
  })

  it('connects when address is allowed', async () => {
    const dispatcher = createPinnedDispatcher({
      lookup: async () => ['127.0.0.1'],
      isAllowed: () => true,
    })
    const res = await fetch(`http://rebind.test:${port}/`, { dispatcher })
    expect(await res.text()).toBe('ok')
    expect(hits).toBe(1)
    await dispatcher.close()
  })
})
