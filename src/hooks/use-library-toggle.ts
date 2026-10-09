"use client"
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from '@/src/hooks/use-toast'
import { useProfiles } from '@/src/hooks/use-profiles'
import { haptic } from '@/src/lib/motion'
import { useT } from '@/src/components/I18nProvider'
import { openAddToList } from '@/src/components/lists/add-to-list-store'
import { useLibraryStore, type LibraryItem, type LibraryList } from '@/src/store/library'

/**
 * Add to / remove from favorites or "watch later", from anywhere: a haptic tick, an optimistic
 * update, and a toast. Guests get a toast with a "Sign in" button instead. "Saved for later" also
 * offers "Add to a list" (signed-in grown-ups), which opens its sheet.
 */
export function useLibraryToggle() {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useT()
  const { data: profiles, active } = useProfiles()
  const toggle = useLibraryStore((state) => state.toggle)
  const lists = !!profiles && !active?.kids

  return useCallback(async (list: LibraryList, item: LibraryItem) => {
    const favorites = list === 'favorites'
    if (!session) {
      toast({
        title: t('common.loginRequired'),
        description: favorites ? t('toast.loginToFavorite') : t('toast.loginToSave'),
        action: { label: t('nav.signIn'), onClick: () => router.push('/login') },
      })
      return
    }
    haptic()
    try {
      const added = await toggle(list, item)
      const title = item.title
      toast(favorites
        ? added
          ? { title: t('toast.addedFavorites'), description: t('toast.addedFavoritesDesc', { title }) }
          : { title: t('toast.removedFavorites'), description: t('toast.removedFavoritesDesc', { title }) }
        : added
          ? {
            title: t('toast.savedForLater'),
            description: t('toast.savedForLaterDesc', { title }),
            ...(lists ? {
              action: {
                label: t('sharedLists.add.toast'),
                onClick: () => openAddToList({ media_type: item.media_type, id: String(item.id), title: item.title, poster_path: item.poster_path ?? null }),
              },
            } : {}),
          }
          : { title: t('toast.removedSaved'), description: t('toast.removedSavedDesc', { title }) })
    } catch {
      toast({ title: t('common.error'), description: favorites ? t('toast.updateFavoritesFailed') : t('toast.updateSavedFailed'), variant: 'destructive' })
    }
  }, [session, router, t, toggle, lists])
}
