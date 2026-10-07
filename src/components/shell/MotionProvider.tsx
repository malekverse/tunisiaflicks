"use client"
import { LazyMotion, MotionConfig } from 'framer-motion'

const loadFeatures = () => import('@/src/lib/motion-features').then((module) => module.default)

/**
 * framer-motion for the whole app, loaded lazily (components use `m.*`), and switched to
 * opacity-only animations for people who ask their system for less motion.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
