// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { exitCodeFor, runPhases } from '@/jobs/run-phases'

describe('runPhases', () => {
  it('continues after a failure', async () => {
    const lines: Array<Record<string, unknown>> = []
    const ran: string[] = []

    const outcome = await runPhases(
      [
        { name: 'one', run: async () => (ran.push('one'), { n: 1 }) },
        {
          name: 'two',
          run: async () => {
            ran.push('two')
            throw new Error('boom')
          },
        },
        { name: 'three', run: async () => (ran.push('three'), 3) },
      ],
      (line) => lines.push(line as Record<string, unknown>),
    )

    expect(ran).toEqual(['one', 'two', 'three'])
    expect(outcome.ok).toBe(false)
    expect(outcome.results).toEqual({ one: { n: 1 }, three: 3 })
    expect(lines).toContainEqual({ event: 'phase_failed', name: 'two', error: 'boom' })
    expect(lines).toContainEqual({ event: 'phase_done', name: 'one', result: { n: 1 } })
    expect(lines).toContainEqual({ event: 'phase_done', name: 'three', result: 3 })
  })

  it('is ok when every phase succeeds', async () => {
    const outcome = await runPhases([{ name: 'a', run: async () => 1 }], () => {})
    expect(outcome).toEqual({ ok: true, results: { a: 1 } })
  })
})

describe('exitCodeFor', () => {
  it('fails when a phase failed', () => {
    expect(exitCodeFor({ ok: false, results: {} })).toBe(1)
  })

  it('fails when the health phase aborted', () => {
    expect(exitCodeFor({ ok: true, results: { health: { aborted: true, checked: 10, failed: 9 } } })).toBe(1)
  })

  it('succeeds when every phase ran and health did not abort', () => {
    expect(exitCodeFor({ ok: true, results: { health: { aborted: false } } })).toBe(0)
    expect(exitCodeFor({ ok: true, results: {} })).toBe(0)
  })
})
