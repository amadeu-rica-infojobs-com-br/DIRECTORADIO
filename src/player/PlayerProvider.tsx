'use client'

import type HlsPlayer from 'hls.js'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getSessionId } from '@/player/session'
import { audioProxyBase, resolveSource, type PlayableSource, type PlayableStation } from '@/player/source'

export type PlayerStatus = 'idle' | 'connecting' | 'playing' | 'paused' | 'error'

export type PlayerApi = {
  current: PlayableStation | null
  status: PlayerStatus
  play: (station: PlayableStation) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const api = useContext(PlayerContext)
  if (!api) throw new Error('usePlayer necesita un <PlayerProvider>')
  return api
}

function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError'
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PlayableStation | null>(null)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<HlsPlayer | null>(null)
  const activeRef = useRef<{ station: PlayableStation; token: number } | null>(null)
  const tokenRef = useRef(0)
  const countedRef = useRef<Set<string>>(new Set())

  // Quitar el src no basta: hasta load() la conexión del directo sigue abierta.
  function releaseStream() {
    hlsRef.current?.destroy()
    hlsRef.current = null
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    try {
      audio.load()
    } catch {
      // Sin cargador de medios (jsdom): no hay nada que abortar.
    }
  }

  function detach() {
    tokenRef.current += 1
    activeRef.current = null
    releaseStream()
  }

  function recordPlay(station: PlayableStation) {
    if (countedRef.current.has(station.id)) return
    countedRef.current.add(station.id)
    void fetch('/api/reproducciones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stationId: station.id, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {
      // El contador no debe estropear la escucha.
    })
  }

  function activeStation(): PlayableStation | null {
    const active = activeRef.current
    return active && active.token === tokenRef.current ? active.station : null
  }

  function ensureAudio(): HTMLAudioElement {
    const existing = audioRef.current
    if (existing) return existing
    const audio = document.createElement('audio')
    audio.preload = 'none'
    // Vive fuera del árbol de React para sobrevivir a las navegaciones; el testid lo localiza en los tests.
    audio.dataset.testid = 'dr-audio'
    audio.addEventListener('playing', () => {
      const station = activeStation()
      if (!station) return
      setStatus('playing')
      recordPlay(station)
    })
    audio.addEventListener('error', () => {
      if (!activeStation()) return
      detach()
      setStatus('error')
    })
    audio.addEventListener('ended', () => {
      if (!activeStation()) return
      detach()
      setStatus('paused')
    })
    document.body.appendChild(audio)
    audioRef.current = audio
    return audio
  }

  async function startPlayback(audio: HTMLAudioElement, token: number) {
    try {
      await audio.play()
    } catch (error) {
      if (tokenRef.current !== token) return
      // Sin gesto del usuario el navegador rechaza play(): dejamos la emisora lista para reintentar.
      setStatus(isAutoplayBlocked(error) ? 'paused' : 'error')
    }
  }

  async function startHls(audio: HTMLAudioElement, src: string, token: number) {
    const { default: Hls } = await import('hls.js')
    if (tokenRef.current !== token) return
    if (!Hls.isSupported()) {
      setStatus('error')
      return
    }
    const hls = new Hls()
    hlsRef.current = hls
    hls.loadSource(src)
    hls.attachMedia(audio)
    await startPlayback(audio, token)
  }

  function start(station: PlayableStation, source: PlayableSource) {
    detach()
    const token = tokenRef.current
    const audio = ensureAudio()
    activeRef.current = { station, token }
    setCurrent(station)
    setStatus('connecting')
    if (source.kind === 'hls' && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      void startHls(audio, source.src, token)
      return
    }
    audio.src = source.src
    void startPlayback(audio, token)
  }

  function play(station: PlayableStation) {
    const source = resolveSource(station.streamUrl, audioProxyBase(), station.id)
    if (!source) {
      detach()
      setCurrent(station)
      setStatus('error')
      return
    }
    start(station, source)
  }

  function pause() {
    if (!activeRef.current) return
    detach()
    setStatus('paused')
  }

  function resume() {
    if (current) play(current)
  }

  function stop() {
    detach()
    setCurrent(null)
    setStatus('idle')
  }

  useEffect(() => {
    return () => {
      tokenRef.current += 1
      activeRef.current = null
      hlsRef.current?.destroy()
      hlsRef.current = null
      const audio = audioRef.current
      audioRef.current = null
      if (!audio) return
      audio.pause()
      audio.removeAttribute('src')
      try {
        audio.load()
      } catch {
        // Sin cargador de medios (jsdom): no hay nada que abortar.
      }
      audio.remove()
    }
  }, [])

  const api: PlayerApi = { current, status, play, pause, resume, stop }
  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>
}
