"use client"
// "Add to a list…" on its own: a bottom sheet on phones, a dialog from md up, with the title it's
// about at the top and the list picker under it.
import { useT } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import type { ShareMedia } from '@/src/lib/social/types'
import AddToListPicker from './AddToListPicker'
import { ListSheet } from './ListSheet'

export default function AddToListDrawer({ media, open, onClose }: { media: ShareMedia; open: boolean; onClose: () => void }) {
  const t = useT()
  return (
    <ListSheet open={open} onOpenChange={(next) => { if (!next) onClose() }} title={t('sharedLists.add.title')} titleHidden from="md">
      <div className="space-y-5">
        <div className="flex items-center gap-3.5 pe-10">
          <span className="relative block aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-[8px] bg-white/5 ring-1 ring-white/10">
            <TmdbImage kind="poster" path={media.poster_path} alt="" fill sizes="48px" className="object-cover" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-white/55">{t('sharedLists.add.title')}</p>
            <p className="line-clamp-2 font-display text-[22px] font-bold leading-tight"><bdi>{media.title}</bdi></p>
          </div>
        </div>
        <AddToListPicker media={media} onDone={onClose} className="-mx-3" />
      </div>
    </ListSheet>
  )
}
