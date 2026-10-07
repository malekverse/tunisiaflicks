"use client"
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/src/lib/utils'

const ORIGIN = 'https://www.youtube-nocookie.com'

export type PlayerState = 'loading' | 'playing' | 'paused' | 'ended'

/**
 * A YouTube trailer used as moving wallpaper: muted, chrome-less, cropped to cover its box (like
 * `object-fit: cover`, via container query units) and slightly zoomed so YouTube's own overlays
 * stay off-screen. It stays invisible until YouTube reports it is actually playing, so viewers
 * never see a black frame or a play button; if autoplay is blocked, the picture underneath simply
 * stays. It never takes clicks.
 *
 * Talks to the player over postMessage (the iframe API protocol), without loading YouTube's script.
 */
export default function YouTubeBackdrop({
  videoKey, muted = true, play = true, loop = false, zoom = 1.25, revealDelay = 1200, className, onState, onProgress,
}: {
  videoKey: string
  muted?: boolean
  /** false pauses the video (e.g. the billboard scrolled away). */
  play?: boolean
  loop?: boolean
  zoom?: number
  /** Wait this long after playback starts before fading in: YouTube shows the title for a moment. */
  revealDelay?: number
  className?: string
  onState?: (state: PlayerState) => void
  /** 0..1 as the video plays. */
  onProgress?: (fraction: number) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [visible, setVisible] = useState(false)
  const duration = useRef(0)
  const callbacks = useRef({ onState, onProgress })
  callbacks.current = { onState, onProgress }
  const lastState = useRef<PlayerState>('loading')

  const command = (func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), ORIGIN)
  }

  useEffect(() => {
    setVisible(false)
    duration.current = 0
    lastState.current = 'loading'
    let revealTimer: ReturnType<typeof setTimeout> | undefined
    const report = (state: PlayerState) => {
      if (state === lastState.current) return
      lastState.current = state
      if (state === 'playing') {
        clearTimeout(revealTimer)
        revealTimer = setTimeout(() => setVisible(true), revealDelay)
      }
      if (state === 'ended' && !loop) setVisible(false)
      callbacks.current.onState?.(state)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || event.source !== frame.current?.contentWindow) return
      let data: any
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
      const info = data?.info
      let state: number | undefined
      if (data?.event === 'onStateChange' && typeof info === 'number') state = info
      else if (info && typeof info === 'object') {
        if (typeof info.duration === 'number' && info.duration > 0) duration.current = info.duration
        if (typeof info.currentTime === 'number' && duration.current > 0) {
          callbacks.current.onProgress?.(Math.min(1, info.currentTime / duration.current))
        }
        if (typeof info.playerState === 'number') state = info.playerState
      }
      if (state === 1) report('playing')
      else if (state === 2) report('paused')
      else if (state === 0) report('ended')
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(revealTimer)
    }
  }, [videoKey, loop, revealDelay])

  useEffect(() => { command(muted ? 'mute' : 'unMute') }, [muted])
  useEffect(() => { command(play ? 'playVideo' : 'pauseVideo') }, [play])

  // Ask the player to start sending its events here, then apply the current wishes.
  const onLoad = () => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoKey, channel: 'widget' }), ORIGIN)
    if (!muted) command('unMute')
    if (!play) command('pauseVideo')
  }

  const params = new URLSearchParams({
    autoplay: '1', mute: '1', controls: '0', playsinline: '1', modestbranding: '1', rel: '0',
    disablekb: '1', iv_load_policy: '3', fs: '0', enablejsapi: '1', cc_load_policy: '0',
    ...(loop ? { loop: '1', playlist: videoKey } : {}),
  })

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden [container-type:size]', className)}>
      <iframe
        ref={frame}
        key={videoKey}
        src={`${ORIGIN}/embed/${videoKey}?${params}`}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media"
        onLoad={onLoad}
        className={cn('absolute left-1/2 top-1/2 border-0 transition-opacity duration-1000 ease-out', visible ? 'opacity-100' : 'opacity-0')}
        style={{
          width: 'max(100cqw, 177.78cqh)',
          height: 'max(100cqh, 56.25cqw)',
          transform: `translate(-50%, -50%) scale(${zoom})`,
        }}
      />
    </div>
  )
}
