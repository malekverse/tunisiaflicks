"use client"
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/src/components/I18nProvider'

export type PushTopic = 'pick' | 'alerts'

/**
 * - `unsupported`: no Push API (e.g. iPhone Safari outside an installed Home Screen app)
 * - `disabled`: the server has no VAPID keys configured
 * - `denied`: the user blocked notifications for the site
 */
export type PushStatus = 'loading' | 'unsupported' | 'disabled' | 'denied' | 'ready'

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/** This device's push subscription and the topics it receives. */
export function usePush() {
  const { locale } = useI18n()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [topics, setTopics] = useState<PushTopic[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported()) return setStatus('unsupported')
    let cancelled = false
    ;(async () => {
      try {
        const existing = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription()
        const query = existing ? `?endpoint=${encodeURIComponent(existing.endpoint)}` : ''
        const config = await (await fetch(`/api/push${query}`)).json()
        if (cancelled) return
        if (!config.enabled) return setStatus('disabled')
        setPublicKey(config.publicKey)
        setTopics(existing && Array.isArray(config.topics) ? config.topics : [])
        setStatus(Notification.permission === 'denied' ? 'denied' : 'ready')
      } catch {
        if (!cancelled) setStatus('disabled')
      }
    })()
    return () => { cancelled = true }
  }, [])

  /** Subscribes (asking for permission if needed) with exactly these topics; [] unsubscribes. */
  const update = useCallback(async (next: PushTopic[]) => {
    if (!publicKey) return false
    setBusy(true)
    try {
      const reg = await registration()
      if (next.length === 0) {
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) })
          await existing.unsubscribe()
        }
        setTopics([])
        return true
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        if (permission === 'denied') setStatus('denied')
        return false
      }
      await navigator.serviceWorker.ready
      const subscription = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), topics: next, locale }),
      })
      if (!response.ok) return false
      setTopics(next)
      return true
    } catch (error) {
      console.error('Push subscription failed:', error)
      return false
    } finally {
      setBusy(false)
    }
  }, [publicKey, locale])

  return { status, topics, busy, update }
}
