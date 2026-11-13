// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_MAX_AGE_MS, saveConsent } from '@/consent/consent'
import { consentDefaultsScript } from '@/consent/defaults-script'

const DENIED_DEFAULTS = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
}

function runScript() {
  new Function(consentDefaultsScript())()
}

function entries(): unknown[][] {
  return (window.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>))
}

beforeEach(() => {
  localStorage.clear()
  delete window.dataLayer
  delete window.gtag
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('consentDefaultsScript', () => {
  it('denies everything by default and defines gtag', () => {
    runScript()
    expect(entries()).toEqual([['consent', 'default', DENIED_DEFAULTS]])
    expect(typeof window.gtag).toBe('function')
  })

  it('pushes the arguments object, not an array', () => {
    runScript()
    expect(Array.isArray(window.dataLayer![0])).toBe(false)
  })

  it('grants analytics right away when a recent acceptance is stored', () => {
    saveConsent('granted', Date.now())
    runScript()
    expect(entries()).toEqual([
      ['consent', 'default', DENIED_DEFAULTS],
      ['consent', 'update', { analytics_storage: 'granted' }],
    ])
  })

  it('ignores an expired acceptance', () => {
    saveConsent('granted', Date.now() - CONSENT_MAX_AGE_MS - 1)
    runScript()
    expect(entries()).toEqual([['consent', 'default', DENIED_DEFAULTS]])
  })

  it('keeps defaults when the stored choice is denied', () => {
    saveConsent('denied', Date.now())
    runScript()
    expect(entries()).toEqual([['consent', 'default', DENIED_DEFAULTS]])
  })

  it('survives a blocked localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(runScript).not.toThrow()
    expect(entries()).toEqual([['consent', 'default', DENIED_DEFAULTS]])
  })

  it('keeps an existing dataLayer', () => {
    window.dataLayer = [{ event: 'earlier' }]
    runScript()
    expect(window.dataLayer[0]).toEqual({ event: 'earlier' })
    expect(entries()[1]).toEqual(['consent', 'default', DENIED_DEFAULTS])
  })
})
