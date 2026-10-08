"use client"
import { useRef } from 'react'
import { useInView } from 'framer-motion'
import NumberFlow from '@number-flow/react'

/**
 * A big stat that rolls up from zero the first time its card comes into view (on phones, when the
 * story is swiped to it). Latin digits in every language, like the rest of the numbers on the site.
 */
export default function StatNumber({ value, decimals = 0, prefix, className }: {
  value: number
  decimals?: number
  prefix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  return (
    <span ref={ref} dir="ltr" className={className}>
      <NumberFlow
        value={inView ? value : 0}
        locales="en-US"
        format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        prefix={prefix}
        transformTiming={{ duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
        spinTiming={{ duration: 1100, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </span>
  )
}
