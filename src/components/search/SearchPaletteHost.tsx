"use client"
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchPalette } from '@/src/store/search-palette'

// cmdk only downloads the first time someone opens search.
const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false })

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** Global search shortcuts: "/" anywhere outside a text field, or Ctrl/⌘ + K. */
export default function SearchPaletteHost() {
    const open = useSearchPalette((state) => state.open)
    const setOpen = useSearchPalette((state) => state.setOpen)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                setOpen(!useSearchPalette.getState().open)
            } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
                event.preventDefault()
                setOpen(true)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [setOpen])

    useEffect(() => { if (open) setLoaded(true) }, [open])

    return loaded ? <CommandPalette /> : null
}
