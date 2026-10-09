"use client"
// The download of /desktop, for the device in hand: the Windows installer (then what to do with the
// file), a pointer to the browser install on a Mac or Linux, and nothing to get inside the app.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Download } from 'lucide-react'
import { useI18n, useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { useDevice } from '@/src/components/apps/use-device'
import { isDesktopApp } from '@/src/hooks/use-desktop-app'
import type { DesktopRelease } from '@/src/lib/app-releases'
import { cn } from '@/src/lib/utils'

const megabytes = (bytes: number) => Math.max(0.1, Math.round(bytes / 104857.6) / 10)

export default function DesktopDownload({ release, centered = false }: { release: DesktopRelease | null, centered?: boolean }) {
  const t = useT()
  const { dateLocale } = useI18n()
  const device = useDevice()
  const [inApp, setInApp] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  useEffect(() => setInApp(isDesktopApp()), [])

  if (inApp) {
    return (
      <p className={cn('inline-flex items-center gap-2 text-[16px] font-medium text-emerald-300', centered && 'justify-center')}>
        <CircleCheck aria-hidden className="h-5 w-5" />{t('desktop.hero.inApp')}
      </p>
    )
  }

  const elsewhere = device && device.platform !== 'windows' && device.platform !== 'other'
  return (
    <div className={cn('flex flex-col gap-3.5', centered ? 'items-center text-center' : 'items-start')}>
      {release ? (
        <>
          <Button asChild size="lg" className="h-[52px] px-7 text-[15.5px]">
            <a href="/download/desktop" onClick={() => setDownloaded(true)}>
              <Download aria-hidden className="h-5 w-5" />{t('desktop.download')}
            </a>
          </Button>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-white/50">
            <span>{t('desktop.hero.free')}</span>
            <span>{t('desktop.hero.system')}</span>
            <span>{t('desktop.hero.version', { version: release.version })}</span>
            {release.file.size > 0 && <span>{t('desktop.hero.size', { size: megabytes(release.file.size).toLocaleString(dateLocale) })}</span>}
          </p>
          {downloaded && <p role="status" className="text-[14px] text-white/75">{t('desktop.hero.next')}</p>}
        </>
      ) : (
        <p className="inline-flex rounded-full bg-white/[0.06] px-4 py-2 text-[14px] font-medium text-white/70 ring-1 ring-white/[0.08]">{t('desktop.hero.soon')}</p>
      )}
      {elsewhere && (
        <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-white/60">
          {t('desktop.hero.otherOs')}{' '}
          <Link href="/app#computer" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">{t('desktop.hero.otherOsLink')}</Link>
        </p>
      )}
    </div>
  )
}
