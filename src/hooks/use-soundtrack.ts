"use client"
// The soundtrack block's data and its preview player.
//
// useSoundtrack: what the server already knew (found, none, or unknown) and, once the block is
// within 800px of the screen, the album's tracks (and, on a cache miss, the album itself) from
// /api/soundtrack. A 409 means the profile changed in another tab: the page refreshes.
//
// usePreviewPlayer: one <audio> for the whole block (starting a track stops the other), its
// progress for the ring, and silence when the block goes away.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export type SoundtrackAlbum = { albumId: number, title: string, artist: string, composerId: number | null, cover: string | null, link: string | null, trackCount: number, year: number | null }
export type SoundtrackTrack = { id: number, title: string, artist: string, duration: number, explicit: boolean, preview: boolean }
export type SoundtrackInitial = { state: 'found', album: SoundtrackAlbum } | { state: 'none' } | { state: 'unknown' }

export type SoundtrackState = {
  /** found: an album (tracks may still be loading); none: no album; unknown: not asked yet. */
  status: 'found' | 'none' | 'unknown'
  album: SoundtrackAlbum | null
  tracks: SoundtrackTrack[] | null
  failed: boolean
}

export function useSoundtrack({ type, id, kids, initial }: { type: 'movie' | 'tv', id: string, kids: boolean, initial: SoundtrackInitial }) {
  const router = useRouter()
  const [state, setState] = useState<SoundtrackState>(() => ({
    status: initial.state,
    album: initial.state === 'found' ? initial.album : null,
    tracks: null,
    failed: false,
  }))
  const [near, setNear] = useState(false)
  const observed = useRef<IntersectionObserver | null>(null)

  // A sentinel: the block's place on the page, watched from 800px away.
  const sentinel = useCallback((node: HTMLElement | null) => {
    observed.current?.disconnect()
    observed.current = null
    if (!node || near) return
    if (typeof IntersectionObserver === 'undefined') return setNear(true)
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true)
        observer.disconnect()
      }
    }, { rootMargin: '800px 0px 800px 0px' })
    observer.observe(node)
    observed.current = observer
  }, [near])

  useEffect(() => () => observed.current?.disconnect(), [])

  useEffect(() => {
    if (!near || initial.state === 'none') return
    let live = true
    const query = new URLSearchParams({ type, id, kids: kids ? '1' : '0' })
    fetch(`/api/soundtrack?${query}`)
      .then(async (response) => {
        if (!live) return
        if (response.status === 409) return router.refresh()
        if (!response.ok) throw new Error(String(response.status))
        const body = await response.json()
        if (!live) return
        if (body?.status === 'found' && body.album) setState({ status: 'found', album: body.album, tracks: Array.isArray(body.tracks) ? body.tracks : [], failed: false })
        else setState({ status: 'none', album: null, tracks: null, failed: false })
      })
      .catch(() => {
        if (live) setState((current) => ({ ...current, failed: true }))
      })
    return () => { live = false }
  }, [near, type, id, kids, initial.state, router])

  return { ...state, sentinel }
}

export type PlayerState = { current: number | null, playing: boolean, failed: number | null }

export function usePreviewPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const frame = useRef(0)
  const [state, setState] = useState<PlayerState>({ current: null, playing: false, failed: null })
  /** 0 to 1, for the ring of the track that is playing (updated every frame while it plays). */
  const [progress, setProgress] = useState(0)

  const stopFrames = () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }

  const tick = useCallback(() => {
    const element = audio.current
    if (!element) return
    setProgress(element.duration > 0 ? element.currentTime / element.duration : 0)
    frame.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => {
    stopFrames()
    const element = audio.current
    if (element) {
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
    audio.current = null
  }, [])

  const toggle = useCallback((trackId: number) => {
    let element = audio.current
    if (!element) {
      element = new Audio()
      element.preload = 'none'
      element.addEventListener('ended', () => {
        stopFrames()
        setProgress(0)
        setState((current) => ({ ...current, playing: false, current: null }))
      })
      element.addEventListener('pause', () => {
        stopFrames()
        setState((current) => ({ ...current, playing: false }))
      })
      element.addEventListener('playing', () => {
        stopFrames()
        frame.current = requestAnimationFrame(tick)
        setState((current) => ({ ...current, playing: true, failed: null }))
      })
      audio.current = element
    }
    const same = element.dataset.track === String(trackId)
    if (same && !element.paused) {
      element.pause()
      return
    }
    if (!same) {
      element.pause()
      element.dataset.track = String(trackId)
      element.src = `/api/soundtrack/preview/${trackId}`
      setProgress(0)
    }
    setState({ current: trackId, playing: false, failed: null })
    element.play().catch((error) => {
      if (error?.name === 'AbortError') return
      setState({ current: null, playing: false, failed: trackId })
    })
  }, [tick])

  return { ...state, progress, toggle }
}
