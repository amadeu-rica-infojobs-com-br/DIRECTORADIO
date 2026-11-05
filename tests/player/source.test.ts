import { describe, expect, it } from 'vitest'
import { resolveSource } from '@/player/source'

const ID = 'c0ffee00-0000-4000-8000-000000000001'
const PROXY = 'http://localhost:4100'

describe('resolveSource', () => {
  it('returns null for invalid URLs', () => {
    expect(resolveSource('not a url', PROXY, ID)).toBeNull()
  })

  it('returns null for non-http protocols', () => {
    expect(resolveSource('javascript:x', PROXY, ID)).toBeNull()
  })

  it('maps https playlists to hls', () => {
    expect(resolveSource('https://cdn.example/live.m3u8', undefined, ID)).toEqual({
      kind: 'hls',
      src: 'https://cdn.example/live.m3u8',
    })
  })

  it('maps other https streams to direct', () => {
    expect(resolveSource('https://cdn.example/stream', undefined, ID)).toEqual({
      kind: 'direct',
      src: 'https://cdn.example/stream',
    })
  })

  it('keeps https with a query string as direct', () => {
    expect(resolveSource('https://cdn.example/stream?a=1', undefined, ID)).toEqual({
      kind: 'direct',
      src: 'https://cdn.example/stream?a=1',
    })
  })

  it('returns null for http playlists even with a proxy', () => {
    expect(resolveSource('http://cdn.example/live.m3u8', PROXY, ID)).toBeNull()
  })

  it('maps http streams to the proxy when it is configured', () => {
    expect(resolveSource('http://cdn.example/stream', PROXY, ID)).toEqual({
      kind: 'proxy',
      src: `${PROXY}/stream/${ID}`,
    })
  })

  it('ignores a trailing slash in the proxy base', () => {
    expect(resolveSource('http://cdn.example/stream', `${PROXY}/`, ID)?.src).toBe(
      `${PROXY}/stream/${ID}`,
    )
  })

  it('returns null for http streams without a proxy', () => {
    expect(resolveSource('http://cdn.example/stream', undefined, ID)).toBeNull()
    expect(resolveSource('http://cdn.example/stream', '', ID)).toBeNull()
  })
})
