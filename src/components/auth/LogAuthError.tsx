"use client"
import { useEffect } from 'react'

/** Leaves the next-auth error code in the browser console, for whoever is debugging a sign-in. */
export default function LogAuthError({ code }: { code?: string }) {
  useEffect(() => {
    if (code) console.error('Authentication error:', code)
  }, [code])
  return null
}
