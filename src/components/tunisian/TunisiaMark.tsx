import { useId } from 'react'

/** The crescent and star of the Tunisian flag, in the current colour (decoration). */
export default function TunisiaMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <defs>
        <mask id={`crescent-${id}`}>
          <rect width="100" height="100" fill="white" />
          <circle cx="57" cy="50" r="20" fill="black" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="25" fill="currentColor" mask={`url(#crescent-${id})`} />
      <polygon fill="currentColor" points="49.00,50.00 57.28,47.30 57.29,38.59 62.42,45.63 70.71,42.95 65.60,50.00 70.71,57.05 62.42,54.37 57.29,61.41 57.28,52.70" />
    </svg>
  )
}
