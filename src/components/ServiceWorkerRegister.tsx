"use client"
import { useEffect } from 'react'

/** Registers /sw.js (installable app + offline page). Production only, so dev never caches. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    }
    // Don't compete with the first page load for bandwidth.
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
