import { messages } from './es-ES'

export type MessageKey = keyof typeof messages

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = messages[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

export { messages }
