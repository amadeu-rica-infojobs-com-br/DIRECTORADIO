import { messages } from './es-ES'

export type MessageKey = keyof typeof messages

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = messages[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export function tn(
  base: 'station.plays' | 'station.ratings',
  count: number,
  vars?: Record<string, string | number>,
): string {
  const form = count === 1 ? 'one' : 'other'
  const key = `${base}.${form}` as MessageKey
  return t(key, { ...vars, count: new Intl.NumberFormat('es-ES').format(count) })
}

export { messages }
