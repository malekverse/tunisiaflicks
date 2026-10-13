"use client"
import { useState } from 'react'
import { Clapperboard, Play } from 'lucide-react'
import YouTubeDialog from '@/src/components/media/YouTubeDialog'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import type { TunisianMedia } from '@/src/lib/tunisian'
import { dialogVideo } from './tunisian-media'

/**
 * A Tunisian film's play button: the video plays here, in the dialog (not on the source site).
 * `trailer`: it's the blog's trailer (the full film plays through the normal sources below), so it's
 * a quieter "Trailer" button with a reel icon.
 */
export default function TunisianPlay({ media, title, trailer = false }: { media: TunisianMedia, title: string, trailer?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="lg" variant={trailer ? 'secondary' : 'default'} className={trailer ? undefined : 'mt-7'} onClick={() => setOpen(true)}>
        {trailer
          ? <Clapperboard aria-hidden className="h-5 w-5" />
          : <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />}
        {t(trailer ? 'detail.trailer' : 'billboard.play')}
      </Button>
      <YouTubeDialog
        open={open}
        onOpenChange={setOpen}
        videos={[dialogVideo(media, title)]}
        index={0}
        onIndexChange={() => {}}
        label={t('stream.player')}
      />
    </>
  )
}
