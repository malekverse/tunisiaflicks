"use client"
import { useCallback, useEffect, useRef } from 'react'
import { usePeek, type PeekItem } from '@/src/store/peek'
import { haptic } from '@/src/lib/motion'

const OPEN_DELAY_MS = 520
// Having just left another preview, the next one opens right away (like tooltips in a toolbar).
const WARM_WINDOW_MS = 450
const LONG_PRESS_MS = 480
const MOVE_TOLERANCE = 10

let closeTimer: ReturnType<typeof setTimeout> | undefined

/** Close the hover preview soon, unless the pointer arrives on it (or back on its card). */
export function scheduleClose(delay = 140) {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => usePeek.getState().close(), delay)
}
export function cancelClose() {
  clearTimeout(closeTimer)
}

/**
 * Handlers for a card: hover with a mouse for half a second to get the preview card; on a touch
 * screen, press and hold for the quick-view sheet (the tap that follows the long press is swallowed,
 * so it doesn't also open the page).
 */
export function usePeekTrigger(item: PeekItem | null) {
  const openTimer = useRef<ReturnType<typeof setTimeout>>()
  const press = useRef<{ x: number, y: number, timer?: ReturnType<typeof setTimeout>, fired: boolean } | null>(null)
  const itemRef = useRef(item)
  itemRef.current = item

  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(press.current?.timer)
  }, [])

  const onPointerEnter = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || !itemRef.current || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const target = event.currentTarget
    const state = usePeek.getState()
    const current = state.item
    if (current && current.id === itemRef.current.id && current.kind === itemRef.current.kind) return cancelClose()
    const warm = !!current || Date.now() - state.closedAt < WARM_WINDOW_MS
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(() => {
      if (!target.isConnected || !itemRef.current) return
      cancelClose()
      usePeek.getState().open(itemRef.current, 'hover', target.getBoundingClientRect())
    }, warm ? 60 : OPEN_DELAY_MS)
  }, [])

  const onPointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return
    clearTimeout(openTimer.current)
    if (usePeek.getState().mode === 'hover') scheduleClose()
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !itemRef.current) return
    const timer = setTimeout(() => {
      if (!press.current || !itemRef.current) return
      press.current.fired = true
      haptic(12)
      usePeek.getState().open(itemRef.current, 'sheet')
    }, LONG_PRESS_MS)
    press.current = { x: event.clientX, y: event.clientY, timer, fired: false }
  }, [])

  const cancelPress = useCallback(() => {
    clearTimeout(press.current?.timer)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const current = press.current
    if (!current || current.fired) return
    if (Math.abs(event.clientX - current.x) > MOVE_TOLERANCE || Math.abs(event.clientY - current.y) > MOVE_TOLERANCE) cancelPress()
  }, [cancelPress])

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (press.current?.fired) {
      event.preventDefault()
      event.stopPropagation()
    }
    press.current = null
  }, [])

  // No system long-press menu on touch: the sheet replaces it.
  const onContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (press.current) event.preventDefault()
  }, [])

  return {
    onPointerEnter, onPointerLeave, onPointerDown, onPointerMove, onClickCapture, onContextMenu,
    onPointerUp: cancelPress, onPointerCancel: cancelPress,
  }
}
