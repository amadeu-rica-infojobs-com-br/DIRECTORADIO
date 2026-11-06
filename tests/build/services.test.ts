// @vitest-environment node
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import { describe, expect, it } from 'vitest'

const OUTPUTS = ['proxy', 'daily', 'sync', 'health', 'migrate'].map((n) => `dist/${n}.mjs`)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

async function waitForHealth(port: number, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      return await fetch(`http://127.0.0.1:${port}/healthz`)
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`proxy did not answer /healthz: ${String(lastError)}`)
}

describe('build:services', () => {
  it('bundles the five entry points and the proxy answers /healthz', async () => {
    execFileSync(process.execPath, ['scripts/build-services.mjs'], { stdio: 'pipe' })

    for (const file of OUTPUTS) {
      expect(existsSync(file), file).toBe(true)
      expect(readFileSync(file, 'utf8')).not.toContain('from "@/')
    }

    const port = await freePort()
    const child = spawn(process.execPath, ['dist/proxy.mjs'], {
      env: { ...process.env, AUDIO_PROXY_PORT: String(port) },
      stdio: 'ignore',
    })
    try {
      const res = await waitForHealth(port, 10_000)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')
    } finally {
      child.kill()
    }
  }, 60_000)
})
