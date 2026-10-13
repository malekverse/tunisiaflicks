"use client"
import { useState } from 'react'
import { Play } from 'lucide-react'
import YouTubeDialog from '@/src/components/media/YouTubeDialog'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import type { TunisianMedia } from '@/src/lib/tunisian'
import { dialogVideo } from './tunisian-media'

/** A Tunisian film's Play button: the film plays here, in the video dialog (not on the source site). */
export default function TunisianPlay({ media, title }: { media: TunisianMedia, title: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="lg" className="mt-7" onClick={() => setOpen(true)}>
        <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />
        {t('billboard.play')}
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
