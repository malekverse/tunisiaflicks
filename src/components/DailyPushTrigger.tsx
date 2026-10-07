"use client"
import { useEffect } from 'react'

const KEY = 'tf-daily-push-ping'

/**
 * Once a day per browser, after 18:00 Tunis time, nudges the server to send the "Pick of the day"
 * push (instead of a cron job). Fire-and-forget, after the page has loaded.
 */
export default function DailyPushTrigger() {
  useEffect(() => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date())
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    if (Number(get('hour')) < 18) return
    const today = `${get('year')}-${get('month')}-${get('day')}`
    try {
      if (localStorage.getItem(KEY) === today) return
      localStorage.setItem(KEY, today)
    } catch {
      return // no storage: don't risk pinging on every page
    }
    const timer = setTimeout(() => {
      fetch('/api/push/daily', { method: 'POST', keepalive: true }).catch(() => {})
    }, 4000)
    return () => clearTimeout(timer)
  }, [])
  return null
}
