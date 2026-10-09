// A QR code (uqr), drawn as one SVG path: dark modules on a white tile, which every phone camera
// reads (inverted codes trip some of them). Server-safe: no hooks.
import { encode } from 'uqr'
import { cn } from '@/src/lib/utils'

export default function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { data, size } = encode(value, { ecc: 'M', border: 2 })
  let path = ''
  data.forEach((row, y) => {
    let x = 0
    while (x < size) {
      if (!row[x]) { x++; continue }
      // One rectangle per run of dark modules: a far shorter path than one square each.
      let end = x
      while (end + 1 < size && row[end + 1]) end++
      path += `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`
      x = end + 1
    }
  })
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn('block rounded-[14px] bg-white', className)}
    >
      <path d={path} fill="#000" />
    </svg>
  )
}
