"use client"
import React, { useState } from 'react'
import { Download, RefreshCw, Share2 } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import ShareButtons from '@/src/components/ShareButtons'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'

/** "Share my year": publishes a public snapshot, then offers share links + a story-size image. */
export default function WrappedShare({ year, initialToken }: { year: number, initialToken: string | null }) {
  const t = useT()
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  // Bumped on refresh so the story preview shows the new numbers.
  const [version, setVersion] = useState(0)

  const publish = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/wrapped/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'share failed')
      setToken(data.token)
      setVersion((value) => value + 1)
      toast({ title: token ? t('wrapped.refreshed') : t('wrapped.shareReady'), duration: 2500 })
    } catch {
      toast({ variant: 'destructive', title: t('common.error'), description: t('wrapped.shareFailed') })
    } finally {
      setBusy(false)
    }
  }

  const unpublish = async () => {
    if (!window.confirm(t('wrapped.stopConfirm'))) return
    setBusy(true)
    const res = await fetch(`/api/wrapped/share?year=${year}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setToken(null)
      toast({ title: t('wrapped.private'), duration: 2500 })
    } else {
      toast({ variant: 'destructive', title: t('common.error'), description: t('wrapped.stopFailed') })
    }
  }

  const story = token ? `/wrapped/s/${token}/story` : null

  return (
    <section className="grid items-center gap-8 rounded-stage bg-white/[0.04] p-6 ring-1 ring-white/[0.07] sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] lg:p-10">
      <div className="min-w-0">
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[0.95]">{t('wrapped.shareTitle')}</h2>
        {!token ? (
          <>
            <p className="mt-3 max-w-[56ch] text-[15px] text-white/65">{t('wrapped.shareText')}</p>
            <Button onClick={publish} disabled={busy} size="lg" className="mt-6">
              <Share2 aria-hidden className="h-5 w-5" />{busy ? t('wrapped.preparing') : t('wrapped.shareAction')}
            </Button>
          </>
        ) : (
          <div className="mt-5 space-y-5">
            <ShareButtons url={`/wrapped/s/${token}`} title={t('wrapped.shareTitleText', { year })} text={t('wrapped.shareMessage', { year })} />
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="white">
                <a href={story!} download={`tunisiaflicks-${year}.jpg`}><Download aria-hidden className="h-4 w-4" />{t('wrapped.downloadStory')}</a>
              </Button>
              <Button variant="secondary" onClick={publish} disabled={busy}>
                <RefreshCw aria-hidden className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />{t('wrapped.refresh')}
              </Button>
              <Button variant="ghost" onClick={unpublish} disabled={busy} className="text-red-300 hover:bg-red-500/10 hover:text-red-200">
                {t('wrapped.stopSharing')}
              </Button>
            </div>
            <p className="text-[13px] text-white/50">{t('wrapped.storyHint')}</p>
          </div>
        )}
      </div>

      {/* The story image itself, small: what people will see. */}
      {story && (
        <a
          href={story}
          download={`tunisiaflicks-${year}.jpg`}
          aria-label={t('wrapped.downloadStory')}
          className="pressable relative mx-auto block aspect-[9/16] w-[148px] overflow-hidden rounded-[16px] bg-white/[0.06] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/10 md:mx-0 lg:w-[168px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={version ? `${story}?v=${version}` : story} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        </a>
      )}
    </section>
  )
}
