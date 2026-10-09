"use client"
// The focus engine of TV mode: the remote's arrows move real DOM focus to the nearest focusable in
// that direction (a beam search, see ./focus-engine.ts), OK chooses, Back closes the top layer or
// goes back. Mounted once by TvShell.
//
// - Focusables: a[href], button, input, select, textarea, [tabindex='0'], [data-tv-focusable];
//   visible and enabled. An open modal layer (role=dialog, aria-modal) keeps focus inside it.
// - In a row ([role=list]), left/right stay in the row first; coming back to a row lands on the
//   card focused there last.
// - Rows scroll with scrollBy (physical deltas: right in RTL too); the page scrolls with
//   scrollIntoView({block:'start'}) and `scroll-margin-top: 34vh` from tv.css: no offset maths.
// - A held arrow repeats at most every 110ms, and then scrolls instantly.
// - Back: a registered handler (the player), then an open layer (Escape), then on Home the top of
//   the page, then history.back(). The Android app asks window.tfTvBack() first and goes back
//   natively when it answers false.
// - A pointer (an "air mouse" remote) focuses what it points at, without scrolling.
// - The focused element and the scroll of each URL come back on Back.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { REPEAT_MS, isDirection, normalizeKey, pickBest, rowDelta, type Direction, type TvKey } from './focus-engine'

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex="0"], [data-tv-focusable]'
const LAYER = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [data-tv-layer]'
const NOT_TEXT = /^(checkbox|radio|button|submit|reset|range|color|file|image)$/

/** A field the remote types into (its Left and Right move the caret, Enter submits). */
const isTextField = (el: Element | null): boolean =>
  !!el && (el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable || (el.tagName === 'INPUT' && !NOT_TEXT.test((el as HTMLInputElement).type)))

// ---------------------------------------------------------------------------------------------
// Back handlers (the player's menu): the last one registered answers first.

type BackHandler = () => boolean
const backHandlers: BackHandler[] = []

/** Registers a Back handler (true = handled). Returns the function that removes it. */
export function pushTvBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler)
  return () => {
    const index = backHandlers.lastIndexOf(handler)
    if (index >= 0) backHandlers.splice(index, 1)
  }
}

// ---------------------------------------------------------------------------------------------
// Finding focusables.

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function isVisible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false
  if (el.tabIndex < 0 && !el.hasAttribute('data-tv-focusable')) return false
  if (el.closest('[inert], [aria-hidden="true"], [data-tv-skip]')) return false
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return false
  return getComputedStyle(el).visibility !== 'hidden'
}

/** The open layer focus must stay in (the last one in the document is on top), or null. */
function topLayer(): HTMLElement | null {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(LAYER)).filter((layer) => layer.getBoundingClientRect().width > 0)
  return layers[layers.length - 1] ?? null
}

function focusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
}

const navOf = (el: Element | null) => el?.closest<HTMLElement>('[data-tv-nav]') ?? null
const listOf = (el: Element | null) => el?.closest<HTMLElement>('[role="list"]') ?? null
const main = () => document.getElementById('main') ?? document.body

/** The row an element scrolls in (an ancestor that scrolls sideways), or null. */
function rowOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 2) {
      const overflow = getComputedStyle(node).overflowX
      if (overflow === 'auto' || overflow === 'scroll') return node
    }
  }
  return null
}

/** The first thing to focus on a page: an autofocus target, else the first focusable in it. */
export function firstFocusable(root: ParentNode = main()): HTMLElement | null {
  const preferred = Array.from(root.querySelectorAll<HTMLElement>('[data-tv-autofocus], [autofocus]')).find(isVisible)
  return preferred ?? focusables(root)[0] ?? null
}

// ---------------------------------------------------------------------------------------------
// Moving.

const lastInRow = new WeakMap<HTMLElement, HTMLElement>()
let lastMove = 0

function scrollRow(el: HTMLElement, rect: DOMRect, behavior: ScrollBehavior) {
  const row = rowOf(el)
  if (!row) return
  const delta = rowDelta(row.getBoundingClientRect(), rect, Math.max(24, window.innerWidth * 0.05))
  if (delta) row.scrollBy({ left: delta, behavior })
}

function scrollToShow(el: HTMLElement, direction: Direction | null, instant: boolean) {
  const behavior: ScrollBehavior = instant || reducedMotion() ? 'auto' : 'smooth'
  const rect = el.getBoundingClientRect()
  // The bar is fixed: only its own row of places may need to scroll.
  if (navOf(el)) return scrollRow(el, rect, behavior)
  const navBottom = document.querySelector('[data-tv-nav]')?.getBoundingClientRect().bottom ?? 0
  const offscreenY = rect.top < navBottom + 8 || rect.bottom > window.innerHeight * 0.92
  const verticalMove = direction === 'up' || direction === 'down'

  // The first thing on the page: show the page from its top.
  if (verticalMove && direction === 'up' && el === firstFocusable()) {
    window.scrollTo({ top: 0, behavior })
  } else if (offscreenY) {
    // scroll-margin-top (tv.css) puts it a third of the way down; nearest keeps rows in place.
    el.scrollIntoView({ block: 'start', inline: 'nearest', behavior })
    return
  }
  scrollRow(el, rect, behavior)
}

export function focusElement(el: HTMLElement, direction: Direction | null = null, instant = false) {
  el.focus({ preventScroll: true })
  scrollToShow(el, direction, instant)
}

function move(direction: Direction, instant: boolean): boolean {
  const layer = topLayer()
  const current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  const scope: ParentNode = layer ?? document

  // Nothing focused yet (or focus fell outside the open layer): start somewhere sensible.
  if (!current || (layer && !layer.contains(current))) {
    const start = layer ? firstFocusable(layer) : firstFocusable()
    if (start) focusElement(start, null, instant)
    return !!start
  }

  const from = current.getBoundingClientRect()
  const all = focusables(scope).filter((el) => el !== current && !el.contains(current))
  const inNav = navOf(current)

  let pool = all
  if (inNav && !layer) {
    // Along the bar: stay in it. Down from it: what's on screen in the page.
    pool = direction === 'left' || direction === 'right'
      ? all.filter((el) => inNav.contains(el))
      : direction === 'down'
        ? all.filter((el) => !navOf(el) && el.getBoundingClientRect().top < window.innerHeight)
        : []
    if (direction === 'down' && pool.length === 0) {
      const first = firstFocusable()
      if (first) focusElement(first, 'down', instant)
      return !!first
    }
  } else if (!layer) {
    pool = all.filter((el) => !navOf(el))
  }

  // Sideways in a row: its own cards first.
  const list = listOf(current)
  let target: HTMLElement | null = null
  if (list && (direction === 'left' || direction === 'right')) {
    const siblings = pool.filter((el) => list.contains(el))
    const index = pickBest(from, siblings.map((el) => el.getBoundingClientRect()), direction)
    if (index >= 0) target = siblings[index]
  }
  if (!target) {
    const index = pickBest(from, pool.map((el) => el.getBoundingClientRect()), direction)
    if (index >= 0) target = pool[index]
  }

  // Into another row, up or down: back to the card focused there last, if it's still on screen.
  if (target && (direction === 'up' || direction === 'down')) {
    const targetList = listOf(target)
    const remembered = targetList && targetList !== list ? lastInRow.get(targetList) : undefined
    if (remembered && remembered.isConnected && isVisible(remembered)) {
      const rect = remembered.getBoundingClientRect()
      if (rect.left >= 0 && rect.right <= window.innerWidth) target = remembered
    }
  }

  // Up past the top of the page: the bar, on the page's own item.
  if (!target && direction === 'up' && !layer && !inNav) {
    const nav = document.querySelector<HTMLElement>('[data-tv-nav]')
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]') ?? (nav ? focusables(nav)[0] : null)
    if (item) {
      focusElement(item, 'up', instant)
      return true
    }
  }
  if (!target) return false
  focusElement(target, direction, instant)
  return true
}

// ---------------------------------------------------------------------------------------------
// Back.

function closeTopLayer(): boolean {
  const layer = topLayer()
  if (!layer) return false
  // Radix and vaul close on Escape, listening on the document.
  const target = document.activeElement && layer.contains(document.activeElement) ? document.activeElement : layer
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }))
  return true
}

/** Back without going back: a handler, a layer, or Home's top. False when only history is left. */
export function tvBackInPage(): boolean {
  for (let index = backHandlers.length - 1; index >= 0; index--) {
    if (backHandlers[index]()) return true
  }
  if (closeTopLayer()) return true
  if (window.location.pathname === '/' && window.scrollY > 40) {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
    const first = firstFocusable()
    first?.focus({ preventScroll: true })
    return true
  }
  return false
}

// ---------------------------------------------------------------------------------------------
// Focus memory per URL (for Back).

const MEMORY_KEY = 'tf-tv-focus'
type Memory = Record<string, { href?: string; id?: string; index: number }>

function readMemory(): Memory {
  try {
    return JSON.parse(sessionStorage.getItem(MEMORY_KEY) ?? '{}') as Memory
  } catch {
    return {}
  }
}

function remember(el: HTMLElement) {
  if (navOf(el) || !main().contains(el)) return
  const url = window.location.pathname + window.location.search
  const memory = readMemory()
  delete memory[url]
  memory[url] = {
    href: el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? undefined : undefined,
    id: el.id || undefined,
    index: focusables(main()).indexOf(el),
  }
  const keys = Object.keys(memory)
  for (const key of keys.slice(0, Math.max(0, keys.length - 30))) delete memory[key]
  try {
    sessionStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch { /* storage full or blocked */ }
}

function recall(): HTMLElement | null {
  const saved = readMemory()[window.location.pathname + window.location.search]
  if (!saved) return null
  const root = main()
  if (saved.id) {
    const byId = document.getElementById(saved.id)
    if (byId && root.contains(byId) && isVisible(byId)) return byId
  }
  const all = focusables(root)
  if (saved.href) {
    const byHref = all.find((el) => el.getAttribute('href') === saved.href)
    if (byHref) return byHref
  }
  return saved.index >= 0 ? all[saved.index] ?? null : null
}

// ---------------------------------------------------------------------------------------------
// The hook.

export function useFocusEngine(enabled = true) {
  const pathname = usePathname()

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const active = document.activeElement as HTMLElement | null
      const typing = isTextField(active)
      const key: TvKey | null = normalizeKey(event, typing)
      if (!key) return

      if (isDirection(key)) {
        // Text fields keep Left and Right (the caret); a select keeps Up and Down.
        if (typing && (key === 'left' || key === 'right')) return
        if (active?.tagName === 'SELECT' && (key === 'up' || key === 'down')) return
        if (active?.closest('[data-tv-keys="native"]')) return
        const now = Date.now()
        event.preventDefault()
        if (event.repeat && now - lastMove < REPEAT_MS) return
        lastMove = now
        move(key, event.repeat)
        return
      }

      if (key === 'ok') {
        if (!active || active === document.body || typing) return
        if (active.tagName === 'SELECT') return
        // Enter already clicks links and buttons; OK (keyCode 23) and other focusables need a click.
        const native = event.key === 'Enter' && (active.tagName === 'A' || active.tagName === 'BUTTON' || (active.tagName === 'INPUT' && /^(submit|button|image|reset)$/.test((active as HTMLInputElement).type)))
        if (!native) {
          event.preventDefault()
          active.click()
        }
        return
      }

      if (key === 'back') {
        // A plain Escape in an open layer reaches it by itself.
        if (event.key === 'Escape' && topLayer() && backHandlers.length === 0) return
        event.preventDefault()
        if (!tvBackInPage() && window.history.length > 1) window.history.back()
        return
      }

      if (key === 'channelUp' || key === 'channelDown') {
        event.preventDefault()
        window.scrollBy({ top: (key === 'channelUp' ? -1 : 1) * window.innerHeight * 0.8, behavior: reducedMotion() ? 'auto' : 'smooth' })
        return
      }

      // Media keys and Menu: for whoever listens (the player).
      window.dispatchEvent(new CustomEvent('tf-tv-key', { detail: key }))
    }

    // The focus ring (tv.css), and lifting small things (cards, buttons) but not wide ones.
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement
      if (!(el instanceof HTMLElement) || el === document.body) return
      el.classList.add('tv-focus')
      const rect = el.getBoundingClientRect()
      el.classList.toggle('tv-lift', rect.width < 560 && rect.height < 560 && !isTextField(el) && el.tagName !== 'SELECT')
      const list = listOf(el)
      if (list) lastInRow.set(list, el)
      remember(el)
    }
    const onFocusOut = (event: FocusEvent) => {
      const el = event.target as HTMLElement
      if (el instanceof HTMLElement) el.classList.remove('tv-focus', 'tv-lift')
    }

    // An air-mouse remote: focus follows the pointer, without scrolling.
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = event.target
      const el = target instanceof Element ? target.closest<HTMLElement>(FOCUSABLE) : null
      if (el && el !== document.activeElement && isVisible(el)) el.focus({ preventScroll: true })
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerover', onPointerOver)
    // The Android app asks before going back natively.
    const host = window as unknown as { tfTvBack?: () => boolean }
    host.tfTvBack = tvBackInPage
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerover', onPointerOver)
      if (host.tfTvBack === tvBackInPage) delete host.tfTvBack
    }
  }, [enabled])

  // A new page: focus where Back left it, or its first focusable, once it has rendered.
  useEffect(() => {
    if (!enabled) return
    let tries = 0
    let timer = 0
    const settle = () => {
      const active = document.activeElement
      // Something on the page already took focus (an autofocus button, a layer): leave it.
      if (active && active !== document.body && main().contains(active) && active.classList.contains('tv-focus')) return
      if (topLayer()) return
      const target = recall() ?? firstFocusable()
      if (target) {
        target.focus({ preventScroll: true })
        return
      }
      // The page may still be streaming in: keep looking for a few seconds.
      if (tries++ < 40) timer = window.setTimeout(settle, 200)
    }
    timer = window.setTimeout(settle, 60)
    return () => window.clearTimeout(timer)
  }, [enabled, pathname])
}
