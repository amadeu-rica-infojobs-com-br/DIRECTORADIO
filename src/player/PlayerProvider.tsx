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

// Un directo que no arranca deja el reproductor mudo pero «conectando»: a los 15 s se corta.
export const CONNECT_TIMEOUT_MS = 15000

export function usePlayer(): PlayerApi {
  const api = useContext(PlayerContext)
  if (!api) throw new Error('usePlayer necesita un <PlayerProvider>')
  return api
}

function isAutoplayBlocked(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'NotAllowedError'
}

export function PlayerProvider({
  children,
  connectTimeoutMs = CONNECT_TIMEOUT_MS,
}: {
  children: ReactNode
  connectTimeoutMs?: number
}) {
  const [current, setCurrent] = useState<PlayableStation | null>(null)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<HlsPlayer | null>(null)
  const activeRef = useRef<{ station: PlayableStation; token: number } | null>(null)
  const tokenRef = useRef(0)
  const countedRef = useRef<Set<string>>(new Set())
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearConnectTimer() {
    if (connectTimerRef.current === null) return
    clearTimeout(connectTimerRef.current)
    connectTimerRef.current = null
  }

  // Toda transición pasa por aquí para que el vigilante solo corra mientras se conecta.
  function updateStatus(next: PlayerStatus) {
    clearConnectTimer()
    if (next === 'connecting') {
      const token = tokenRef.current
      connectTimerRef.current = setTimeout(() => {
        connectTimerRef.current = null
        if (tokenRef.current !== token) return
        detach()
        setStatus('error')
      }, connectTimeoutMs)
    }
    setStatus(next)
  }

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
    clearConnectTimer()
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
      updateStatus('playing')
      recordPlay(station)
    })
    // Sin esto el mini reproductor anuncia «En directo» mientras el búfer está vacío.
    for (const event of ['waiting', 'stalled']) {
      audio.addEventListener(event, () => {
        if (!activeStation()) return
        updateStatus('connecting')
      })
    }
    audio.addEventListener('error', () => {
      if (!activeStation()) return
      detach()
      updateStatus('error')
    })
    audio.addEventListener('ended', () => {
      if (!activeStation()) return
      detach()
      updateStatus('paused')
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
      // Sin gesto del usuario el navegador rechaza play(): soltamos la conexión y dejamos la emisora lista para reintentar.
      detach()
      updateStatus(isAutoplayBlocked(error) ? 'paused' : 'error')
    }
  }

  async function startHls(audio: HTMLAudioElement, src: string, token: number) {
    try {
      const { default: Hls } = await import('hls.js')
      if (tokenRef.current !== token) return
      if (!Hls.isSupported()) {
        updateStatus('error')
        return
      }
      const hls = new Hls()
      hlsRef.current = hls
      // hls.js gestiona la red: sin este listener un 404/CORS deja el estado en «connecting» para siempre.
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || tokenRef.current !== token) return
        detach()
        updateStatus('error')
      })
      hls.loadSource(src)
      hls.attachMedia(audio)
    } catch {
      if (tokenRef.current !== token) return
      detach()
      updateStatus('error')
      return
    }
    await startPlayback(audio, token)
  }

  function start(station: PlayableStation, source: PlayableSource) {
    detach()
    const token = tokenRef.current
    const audio = ensureAudio()
    activeRef.current = { station, token }
    setCurrent(station)
    updateStatus('connecting')
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
      updateStatus('error')
      return
    }
    start(station, source)
  }

  function pause() {
    if (!activeRef.current) return
    detach()
    updateStatus('paused')
  }

  function resume() {
    if (current) play(current)
  }

  function stop() {
    detach()
    setCurrent(null)
    updateStatus('idle')
  }

  useEffect(() => {
    return () => {
      tokenRef.current += 1
      activeRef.current = null
      clearConnectTimer()
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
