"use client"
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Link2, Share } from 'lucide-react'
import { FaWhatsapp, FaFacebook, FaTelegram } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

type Props = {
  /** Path on this site (e.g. "/lists/abc") or an absolute URL. */
  url: string
  title: string
  /** Message that goes with the link on WhatsApp / Telegram / X. */
  text?: string
  /** A glass pill instead of the red button (inside a sheet whose primary action is elsewhere). */
  quiet?: boolean
}

// Glass pills; each network keeps its colour on the icon only. Phones get round icon buttons (the
// names stay for screen readers and as tooltips), so the whole row fits on one line.
const pill = 'pressable inline-flex h-11 select-none items-center justify-center gap-2 rounded-full bg-white/[0.07] text-[14px] font-medium text-white/90 outline-none ring-1 ring-inset ring-white/[0.06] transition-[background-color,color] duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 max-sm:w-11 sm:h-10 sm:px-4'
const label = 'max-sm:sr-only'

/** Share row: phone share sheet, WhatsApp, Facebook, Telegram, X and copy-link. */
export default function ShareButtons({ url, title, text, quiet = false }: Props) {
  const t = useT()
  const [absolute, setAbsolute] = useState(url)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setAbsolute(/^https?:\/\//.test(url) ? url : `${window.location.origin}${url}`)
    setCanNativeShare(typeof navigator.share === 'function')
  }, [url])

  useEffect(() => () => clearTimeout(timer.current), [])

  const message = text ?? title
  const encoded = encodeURIComponent(absolute)
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute)
      haptic(8)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
      toast({ title: t('common.linkCopied'), description: t('share.pasteAnywhere'), duration: 2500 })
    } catch {
      toast({ variant: 'destructive', title: t('common.error'), description: t('share.copyFailed') })
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url: absolute })
    } catch (error: any) {
      if (error?.name !== 'AbortError') copy()
    }
  }

  return (
    <div className="flex flex-wrap gap-1 sm:gap-2">
      {canNativeShare && (
        quiet ? (
          <button type="button" onClick={nativeShare} title={t('hero.share')} className={pill}>
            <Share aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.1} /><span className={label}>{t('hero.share')}</span>
          </button>
        ) : (
          <Button type="button" onClick={nativeShare} className="h-11 gap-1.5 px-4 text-[14px] sm:h-10 sm:gap-2 sm:px-5">
            <Share aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.1} />
            {t('hero.share')}
          </Button>
        )
      )}
      <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${message} ${absolute}`)}`)} title="WhatsApp" className={pill}>
        <FaWhatsapp aria-hidden className="h-[18px] w-[18px] text-[#25D366]" /><span className={label}>WhatsApp</span>
      </button>
      <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`)} title="Facebook" className={pill}>
        <FaFacebook aria-hidden className="h-[17px] w-[17px] text-[#4b8ef5]" /><span className={label}>Facebook</span>
      </button>
      <button type="button" onClick={() => open(`https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(message)}`)} title="Telegram" className={pill}>
        <FaTelegram aria-hidden className="h-[17px] w-[17px] text-[#2AABEE]" /><span className={label}>Telegram</span>
      </button>
      <button type="button" onClick={() => open(`https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(message)}`)} title="X" className={pill}>
        <FaXTwitter aria-hidden className="h-4 w-4" /><span className={label}>X</span>
      </button>
      <button type="button" onClick={copy} aria-live="polite" title={t('share.copyLink')} className={cn(pill, copied && 'bg-white/[0.12] text-white')}>
        <span className="relative grid h-[18px] w-[18px] place-items-center">
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              key={copied ? 'done' : 'copy'}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
              transition={spring.pop}
              className="grid place-items-center"
            >
              {copied
                ? <Check aria-hidden className="h-[18px] w-[18px] text-red-400" strokeWidth={2.6} />
                : <Link2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.1} />}
            </m.span>
          </AnimatePresence>
        </span>
        <span className={label}>{copied ? t('share.copied') : t('share.copyLink')}</span>
      </button>
    </div>
  )
}
