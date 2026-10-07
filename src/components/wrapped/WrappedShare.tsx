"use client"
import React, { useState } from 'react'
import { FaDownload, FaShareAlt } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import ShareButtons from '@/src/components/ShareButtons'
import { toast } from '@/src/hooks/use-toast'

/** "Share my year": publishes a public snapshot, then offers share links + a story-size image. */
export default function WrappedShare({ year, initialToken }: { year: number, initialToken: string | null }) {
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)

  const publish = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/wrapped/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to share your year')
      setToken(data.token)
      toast({ title: token ? 'Numbers refreshed' : 'Your year is ready to share', duration: 2500 })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } finally {
      setBusy(false)
    }
  }

  const unpublish = async () => {
    if (!window.confirm('Stop sharing? The link will stop working.')) return
    setBusy(true)
    const res = await fetch(`/api/wrapped/share?year=${year}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) {
      setToken(null)
      toast({ title: 'Your recap is private again', duration: 2500 })
    } else {
      toast({ variant: 'destructive', title: 'Error', description: "Couldn't stop sharing" })
    }
  }

  return (
    <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 text-white">
      <h2 className="text-2xl font-black">Show it off</h2>
      {!token ? (
        <>
          <p className="mt-2 text-gray-400">Get a public link and a story-size image of your year. Only your first name is shown.</p>
          <Button onClick={publish} disabled={busy} className="mt-5 bg-red-500 text-white hover:bg-red-400">
            <FaShareAlt className="me-2" /> {busy ? 'Preparing…' : 'Share my year'}
          </Button>
        </>
      ) : (
        <div className="mt-4 space-y-5">
          <ShareButtons url={`/wrapped/s/${token}`} title={`My ${year} on TunisiaFlicks`} text={`My ${year} on TunisiaFlicks 🎬 What was yours?`} />
          <div className="flex flex-wrap gap-3">
            <a
              href={`/wrapped/s/${token}/story`}
              download={`tunisiaflicks-${year}.jpg`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              <FaDownload /> Download story image
            </a>
            <Button variant="outline" onClick={publish} disabled={busy} className="bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white">
              Refresh numbers
            </Button>
            <Button variant="outline" onClick={unpublish} disabled={busy} className="bg-transparent text-red-400 border-red-500/40 hover:bg-red-500/10 hover:text-red-300">
              Stop sharing
            </Button>
          </div>
          <p className="text-xs text-gray-500">The story image is sized for Instagram, Facebook and WhatsApp stories (1080×1920).</p>
        </div>
      )}
    </section>
  )
}
