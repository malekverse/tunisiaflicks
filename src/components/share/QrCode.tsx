"use client"
// A QR code of a link, black on a white card (scanners want the contrast). The encoder (uqr) is
// only loaded when someone asks for the code.
import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { Skeleton } from '@/src/components/ui/skeleton'
import { spring } from '@/src/lib/motion'

/** The dark modules as one SVG path (one 1x1 square per module, merged along rows). */
function pathOf(data: boolean[][]) {
  let d = ''
  data.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) { x++; continue }
      let run = 1
      while (x + run < row.length && row[x + run]) run++
      d += `M${x} ${y}h${run}v1h-${run}z`
      x += run
    }
  })
  return d
}

export default function QrCode({ url, size = 240 }: { url: string; size?: number }) {
  const t = useT()
  const [code, setCode] = useState<{ size: number; path: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const absolute = /^https?:\/\//.test(url) ? url : `${window.location.origin}${url}`
    import('uqr').then(({ encode }) => {
      if (cancelled) return
      const result = encode(absolute, { ecc: 'M', border: 0 })
      setCode({ size: result.size, path: pathOf(result.data) })
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [url])

  return (
    <m.figure
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.ui}
      className="mx-auto flex w-fit flex-col items-center gap-3"
    >
      <div className="rounded-[22px] bg-white p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]" style={{ width: size + 32, height: size + 32 }}>
        {code ? (
          <svg role="img" aria-label={t('social.share.qrAlt')} viewBox={`0 0 ${code.size} ${code.size}`} width={size} height={size} shapeRendering="crispEdges">
            <path d={code.path} fill="#000" />
          </svg>
        ) : (
          <Skeleton className="h-full w-full rounded-xl bg-black/10" />
        )}
      </div>
      <figcaption className="max-w-[18rem] text-center text-[13px] text-white/60">{t('social.share.qrHint')}</figcaption>
    </m.figure>
  )
}
