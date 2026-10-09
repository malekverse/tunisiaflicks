"use client"
import { forwardRef, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = Omit<React.ComponentPropsWithoutRef<typeof Link>, 'prefetch' | 'scroll' | 'href'> & { href: string }

/**
 * A link between the map's pages: no scroll jump (the map stays where it is) and no viewport
 * prefetching of 22 panels at once; the panel is fetched when the pointer or the focus says it's
 * next (pointerenter, focus, pointerdown).
 */
const CountryLink = forwardRef<HTMLAnchorElement, Props>(function CountryLink({ href, onPointerEnter, onFocus, onPointerDown, ...rest }, ref) {
  const router = useRouter()
  const done = useRef(false)
  const prefetch = () => {
    if (done.current) return
    done.current = true
    router.prefetch(href)
  }
  return (
    <Link
      ref={ref}
      href={href}
      scroll={false}
      prefetch={false}
      onPointerEnter={(event) => { prefetch(); onPointerEnter?.(event) }}
      onFocus={(event) => { prefetch(); onFocus?.(event) }}
      onPointerDown={(event) => { prefetch(); onPointerDown?.(event) }}
      {...rest}
    />
  )
})

export default CountryLink
