"use client"
import { useEffect } from 'react'
import { watchGlobalErrors } from '@/src/lib/report-error'

/** Reports uncaught browser errors to Sentry when it's configured (see lib/report-error.ts). */
export default function ErrorReporter() {
  useEffect(() => watchGlobalErrors(), [])
  return null
}
