export type Phase = { name: string; run: () => Promise<unknown> }

export async function runPhases(
  phases: Phase[],
  log: (line: object) => void,
): Promise<{ ok: boolean; results: Record<string, unknown> }> {
  const results: Record<string, unknown> = {}
  let ok = true

  for (const { name, run } of phases) {
    try {
      const result = await run()
      results[name] = result
      log({ event: 'phase_done', name, result })
    } catch (err) {
      ok = false
      log({ event: 'phase_failed', name, error: String((err as Error)?.message ?? err) })
    }
  }

  return { ok, results }
}
