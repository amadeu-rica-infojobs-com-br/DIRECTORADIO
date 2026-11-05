import { describe, expect, it } from 'vitest'
import {
  isHlsContentType,
  isPlayableByPlayer,
  isPlaylistContentType,
  isProxyableAudioContentType,
} from '@/lib/stream-policy'

describe('stream policy content types', () => {
  it('detects playlist types', () => {
    expect(isPlaylistContentType('audio/x-scpls')).toBe(true)
    expect(isPlaylistContentType('audio/scpls')).toBe(true)
    expect(isPlaylistContentType('application/pls+xml')).toBe(true)
    expect(isPlaylistContentType('audio/mpegurl')).toBe(true)
    expect(isPlaylistContentType('audio/x-mpegurl; charset=utf-8')).toBe(true)
    expect(isPlaylistContentType('audio/mpeg')).toBe(false)
  })

  it('detects HLS types', () => {
    expect(isHlsContentType('application/vnd.apple.mpegurl')).toBe(true)
    expect(isHlsContentType('application/x-mpegurl')).toBe(true)
    expect(isHlsContentType('audio/mpegurl')).toBe(true)
    expect(isHlsContentType('audio/x-mpegurl')).toBe(true)
    expect(isHlsContentType('audio/mpeg')).toBe(false)
  })

  it('accepts only proxiable audio', () => {
    expect(isProxyableAudioContentType('audio/mpeg')).toBe(true)
    expect(isProxyableAudioContentType('audio/aacp')).toBe(true)
    expect(isProxyableAudioContentType('application/ogg')).toBe(true)
    expect(isProxyableAudioContentType('application/octet-stream')).toBe(true)
    expect(isProxyableAudioContentType('audio/x-scpls')).toBe(false)
    expect(isProxyableAudioContentType('application/x-mpegurl')).toBe(false)
    expect(isProxyableAudioContentType('text/html')).toBe(false)
    expect(isProxyableAudioContentType(null)).toBe(false)
  })
})

describe('isPlayableByPlayer', () => {
  it('plays HLS only over https', () => {
    expect(isPlayableByPlayer('https://cdn.example/live.m3u8', null)).toBe(true)
    expect(isPlayableByPlayer('https://cdn.example/live', 'application/x-mpegurl')).toBe(true)
    expect(isPlayableByPlayer('http://cdn.example/live.m3u8', 'application/x-mpegurl')).toBe(false)
    expect(isPlayableByPlayer('http://cdn.example/live', 'application/vnd.apple.mpegurl')).toBe(false)
  })

  it('plays audio over http (proxy) and https (direct)', () => {
    expect(isPlayableByPlayer('http://cdn.example/s', 'audio/mpeg')).toBe(true)
    expect(isPlayableByPlayer('https://cdn.example/s', 'audio/mpeg')).toBe(true)
    expect(isPlayableByPlayer('https://cdn.example/s', 'application/octet-stream')).toBe(true)
  })

  it('rejects playlists and unknown schemes', () => {
    expect(isPlayableByPlayer('https://cdn.example/list.pls', 'audio/mpeg')).toBe(false)
    expect(isPlayableByPlayer('https://cdn.example/list.m3u', 'audio/mpeg')).toBe(false)
    expect(isPlayableByPlayer('https://cdn.example/s', 'audio/x-scpls')).toBe(false)
    expect(isPlayableByPlayer('https://cdn.example/s', 'text/html')).toBe(false)
    expect(isPlayableByPlayer('rtmp://cdn.example/s', 'audio/mpeg')).toBe(false)
    expect(isPlayableByPlayer('no-es-una-url', 'audio/mpeg')).toBe(false)
  })
})
