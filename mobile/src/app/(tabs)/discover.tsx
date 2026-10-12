// Discover: Movies or Shows, the genres as chips (each opens its full list), then the big lists as
// rows: popular, top rated, Tunisian, and what's new.
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGenres, useList, type Kind } from '@/lib/api'
import { useT, type StringKey } from '@/i18n'
import { Row, SectionHeader } from '@/components/media/Row'
import { Chip } from '@/components/ui/Chip'
import { Display } from '@/components/ui/Text'
import { RoomLight } from '@/components/ui/RoomLight'
import { RefreshScrollView } from '@/components/motion/PullToRefresh'
import { Rise } from '@/components/motion/Rise'
import { useTabBarSpace } from '@/components/shell/TabBar'
import { colors, isTV, space, type } from '@/theme/tokens'

const LISTS: Record<Kind, string[]> = {
  movie: ['popular-movies', 'top-rated-movies', 'tunisian-movies', 'now-playing', 'upcoming'],
  tv: ['popular-tv', 'top-rated-tv', 'tunisian-tv', 'on-the-air', 'trending-tv'],
}

export default function DiscoverScreen() {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottom = useTabBarSpace()
  const [kind, setKind] = useState<Kind>('movie')
  const genres = useGenres()
  const queryClient = useQueryClient()
  const refresh = () => Promise.all([genres.refetch(), queryClient.refetchQueries({ queryKey: ['list'] })])

  return (
    <View style={styles.page}>
      <RoomLight />
      <RefreshScrollView onRefresh={refresh} top={insets.top + 6} contentContainerStyle={{ paddingTop: isTV ? 140 : insets.top + 12, paddingBottom: bottom + 24 }} showsVerticalScrollIndicator={false}>
        {isTV ? null : <Display size={type.pageTitle} style={styles.title} accessibilityRole="header">{t('nav.discover')}</Display>}
        <View style={styles.kinds}>
          <Chip label={t('discover.movies')} selected={kind === 'movie'} onPress={() => setKind('movie')} role="tab" hasTVPreferredFocus />
          <Chip label={t('discover.shows')} selected={kind === 'tv'} onPress={() => setKind('tv')} role="tab" />
        </View>

        {genres.data ? (
          <View style={styles.block}>
            <SectionHeader title={t('discover.genres')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genres}>
              {/* Two lines of chips, scrolling sideways together. */}
              <View style={{ gap: 8 }}>
                {[0, 1].map((line) => (
                  <View key={line} style={styles.genreLine}>
                    {genres.data[kind].filter((_, i) => i % 2 === line).map((genre) => (
                      <Chip
                        key={genre.id}
                        label={genre.name}
                        onPress={() => router.push({ pathname: '/list/[key]', params: { key: `genre-${kind}-${genre.id}`, title: genre.name } })}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Switching Movies and Shows, the rows rise in again. */}
        <Rise key={kind} style={styles.rows}>
          {LISTS[kind].map((key) => <ListRow key={key} listKey={key} title={t(`row.${key}` as StringKey)} />)}
        </Rise>
      </RefreshScrollView>
    </View>
  )
}

/** A list's first page as a row, with "See all". */
function ListRow({ listKey, title }: { listKey: string, title: string }) {
  const list = useList(listKey)
  const items = list.data?.pages[0]?.items ?? []
  return <Row title={title} items={items} more={listKey} style={listKey === 'upcoming' || listKey === 'now-playing' ? 'landscape' : 'poster'} />
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  title: { paddingHorizontal: space.page, marginBottom: 14 },
  kinds: { flexDirection: 'row', gap: 8, paddingHorizontal: space.page },
  block: { gap: 12, marginTop: space.section },
  genres: { paddingHorizontal: space.page },
  genreLine: { flexDirection: 'row', gap: 8 },
  rows: { gap: space.section, marginTop: space.section },
})
