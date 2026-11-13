// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  getGtmId,
  readConsent,
  saveConsent,
  sendConsentUpdate,
} from '@/consent/consent'

beforeEach(() => {
  localStorage.clear()
  delete window.gtag
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getGtmId', () => {
  it('trims a valid container id', () => {
    expect(getGtmId(' GTM-K6V4M9J6 ')).toBe('GTM-K6V4M9J6')
  })

  it.each([undefined, '', '   ', 'K6V4M9J6', 'GTM-<script>', 'gtm-k6v4m9j6'])('rejects %j', (raw) => {
    expect(getGtmId(raw)).toBeNull()
  })
})

describe('readConsent / saveConsent', () => {
  it.each(['granted', 'denied'] as const)('round-trips %s', (choice) => {
    saveConsent(choice, 1000)
    expect(readConsent(1000)).toBe(choice)
  })

  it('returns null without a stored choice', () => {
    expect(readConsent()).toBeNull()
  })

  it('keeps a choice up to 12 months and expires it afterwards', () => {
    saveConsent('granted', 0)
    expect(readConsent(CONSENT_MAX_AGE_MS)).toBe('granted')
    expect(readConsent(CONSENT_MAX_AGE_MS + 1)).toBeNull()
  })

  it.each(['yes', '{', '{"choice":"maybe","at":1}', '{"choice":"granted"}', '{"choice":"granted","at":"1"}', 'null'])(
    'treats %j as no choice',
    (raw) => {
      localStorage.setItem(CONSENT_STORAGE_KEY, raw)
      expect(readConsent(1000)).toBeNull()
    },
  )

  it('survives a blocked localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readConsent()).toBeNull()
    expect(() => saveConsent('granted')).not.toThrow()
  })
})

describe('sendConsentUpdate', () => {
  it('sends a consent update through gtag', () => {
    const gtag = vi.fn()
    window.gtag = gtag
    sendConsentUpdate('granted')
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' })
  })

  it('does nothing without gtag', () => {
    expect(() => sendConsentUpdate('denied')).not.toThrow()
  })
})
