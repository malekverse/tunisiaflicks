"use client"
import React, { useEffect, useState } from 'react'
import { FaWhatsapp, FaFacebook, FaTelegram, FaShareAlt } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { LuCopy, LuCheck } from 'react-icons/lu'
import { toast } from '@/src/hooks/use-toast'

type Props = {
  /** Path on this site (e.g. "/lists/abc") or an absolute URL. */
  url: string
  title: string
  /** Message that goes with the link on WhatsApp / Telegram / X. */
  text?: string
}

const button = 'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors'

/** Share row: phone share sheet, WhatsApp, Facebook, Telegram, X and copy-link. */
export default function ShareButtons({ url, title, text }: Props) {
  const [absolute, setAbsolute] = useState(url)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setAbsolute(/^https?:\/\//.test(url) ? url : `${window.location.origin}${url}`)
    setCanNativeShare(typeof navigator.share === 'function')
  }, [url])

  const message = text ?? title
  const encoded = encodeURIComponent(absolute)
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Link copied', description: 'Paste it anywhere to share.', duration: 2500 })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: "Couldn't copy the link" })
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
    <div className="flex flex-wrap gap-2">
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={`${button} bg-red-500 text-white hover:bg-red-400`}>
          <FaShareAlt /> Share
        </button>
      )}
      <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${message} ${absolute}`)}`)} className={`${button} bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25`}>
        <FaWhatsapp /> WhatsApp
      </button>
      <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`)} className={`${button} bg-[#1877F2]/15 text-[#5b9bf5] hover:bg-[#1877F2]/25`}>
        <FaFacebook /> Facebook
      </button>
      <button type="button" onClick={() => open(`https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(message)}`)} className={`${button} bg-[#26A5E4]/15 text-[#26A5E4] hover:bg-[#26A5E4]/25`}>
        <FaTelegram /> Telegram
      </button>
      <button type="button" onClick={() => open(`https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(message)}`)} className={`${button} bg-zinc-800 text-gray-200 hover:bg-zinc-700`}>
        <FaXTwitter /> X
      </button>
      <button type="button" onClick={copy} className={`${button} bg-zinc-800 text-gray-200 hover:bg-zinc-700`}>
        {copied ? <LuCheck /> : <LuCopy />} {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
