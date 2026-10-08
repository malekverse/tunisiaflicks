import { useId } from 'react'

// The drama hubs' watermarks: the window screens of the two houses the series are set in. Drawn in
// the current colour, for HubHeader's watermark slot (about 13% of the hub's accent). Decoration.

/** An Ottoman kafes: the wooden lattice screen of a pointed-arch window, as in a konak or a palace harem. */
export function KafesMark({ className }: { className?: string }) {
  const id = useId()
  const arch = 'M16 98 V46 C16 26 30 12 50 4 C70 12 84 26 84 46 V98 Z'
  const lines: string[] = []
  for (let offset = -100; offset <= 100; offset += 7) {
    lines.push(`M${offset} 0 L${offset + 100} 100`, `M${offset + 100} 0 L${offset} 100`)
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="none" stroke="currentColor">
      <defs>
        <clipPath id={`kafes-${id}`}>
          <path d={arch} />
        </clipPath>
      </defs>
      <g clipPath={`url(#kafes-${id})`} strokeWidth={1.1}>
        <path d={lines.join(' ')} />
      </g>
      <path d={arch} strokeWidth={3} strokeLinejoin="round" />
      <path d="M22 98 V48 C22 31 34 19 50 11 C66 19 78 31 78 48 V98" strokeWidth={1.2} />
    </svg>
  )
}

/** A Korean changsal: the slatted paper window of a hanok, thin vertical bars held by three bands. */
export function ChangsalMark({ className }: { className?: string }) {
  const bars: string[] = []
  for (let x = 16; x <= 84; x += 5.2) bars.push(`M${x.toFixed(1)} 10 V90`)
  const bands: string[] = []
  for (const top of [16, 47, 78]) for (let y = top; y <= top + 6; y += 3) bands.push(`M10 ${y} H90`)
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="none" stroke="currentColor">
      <rect x="6" y="6" width="88" height="88" rx="2" strokeWidth={3.2} />
      <rect x="10" y="10" width="80" height="80" strokeWidth={1.2} />
      <path d={bars.join(' ')} strokeWidth={1.1} />
      <path d={bands.join(' ')} strokeWidth={1.1} />
      <path d="M50 6 V94" strokeWidth={2.2} />
    </svg>
  )
}

export function HubWatermark({ kind, className }: { kind: 'kafes' | 'changsal', className?: string }) {
  return kind === 'kafes' ? <KafesMark className={className} /> : <ChangsalMark className={className} />
}
