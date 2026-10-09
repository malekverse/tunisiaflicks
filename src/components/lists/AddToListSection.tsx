// "Add to a list" inside the ShareSheet: one action row that opens, in place, into the list
// picker (never a second sheet on top). `onDone` closes whatever holds it. Nothing for guests and
// Kids profiles.
"use client"
import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ListPlus } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useT } from '@/src/components/I18nProvider'
import { ShareActionRow } from '@/src/components/share/ShareActionRow'
import { useProfiles } from '@/src/hooks/use-profiles'
import { spring, tween } from '@/src/lib/motion'
import type { ShareMedia } from '@/src/lib/social/types'
import AddToListPicker from './AddToListPicker'

export default function AddToListSection(props: { media: ShareMedia; onDone: () => void }): JSX.Element | null {
  const { media, onDone } = props
  const t = useT()
  const { status } = useSession()
  const { active } = useProfiles()
  const [open, setOpen] = useState(false)
  if (status !== 'authenticated' || active?.kids) return null
  return (
    <div>
      {!open && (
        <ShareActionRow icon={<ListPlus />} label={t('sharedLists.add.row')} hint={t('sharedLists.add.rowHint')} onSelect={() => setOpen(true)} />
      )}
      <AnimatePresence initial={false}>
        {open && (
          <m.section
            aria-label={t('sharedLists.add.title')}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: spring.ui }}
            exit={{ opacity: 0, height: 0, transition: tween.fast }}
            className="overflow-hidden"
          >
            <p className="flex items-center gap-2.5 px-3 pb-1.5 pt-1 text-[13px] font-medium text-white/70">
              <ListPlus aria-hidden className="h-4 w-4" />{t('sharedLists.add.title')}
            </p>
            <AddToListPicker media={media} onDone={onDone} />
          </m.section>
        )}
      </AnimatePresence>
    </div>
  )
}
