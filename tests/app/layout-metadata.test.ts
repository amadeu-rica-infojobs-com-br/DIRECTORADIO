// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { metadata } from '@/app/layout'

describe('root metadata', () => {
  it('resolves share-image and canonical URLs against the production domain', () => {
    expect(metadata.metadataBase?.toString()).toBe('https://directoradio.com/')
  })
})
