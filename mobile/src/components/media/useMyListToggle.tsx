// Adding to (or taking off) My List, the same everywhere: a tap of the motor and a toast saying so.
import { useCallback } from 'react'
import { Check } from 'lucide-react-native'
import { haptics } from '@/lib/haptics'
import { useInMyList, useStore, type SavedTitle } from '@/lib/store'
import { useT } from '@/i18n'
import { colors } from '@/theme/tokens'
import { toast } from '../motion/Toast'

export function useMyListToggle(title: SavedTitle) {
  const t = useT()
  const inList = useInMyList(title.kind, title.id)
  const toggleMyList = useStore((state) => state.toggleMyList)
  const toggle = useCallback(() => {
    toggleMyList(title)
    if (inList) {
      haptics.tick()
      toast(t('list.removed'))
    } else {
      haptics.success()
      toast(t('list.added'), <Check color={colors.success} size={18} strokeWidth={2.6} />)
    }
  }, [toggleMyList, title, inList, t])
  return { inList, toggle }
}
