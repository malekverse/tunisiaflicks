// Home: the billboard, what you were watching and your list (on this device), then the site's rows.
// Pull down to refresh.
import { useCallback, useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useHome, type Card } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useT, type StringKey } from '@/i18n'
import { Billboard } from '@/components/home/Billboard'
import { Row } from '@/components/media/Row'
import { Loader, Wordmark } from '@/components/brand/Logo'
import { ErrorState } from '@/components/ui/States'
import { RoomLight } from '@/components/ui/RoomLight'
import { useTabBarSpace } from '@/components/shell/TabBar'
import { colors, isTV, space } from '@/theme/tokens'

export default function HomeScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const bottom = useTabBarSpace()
  const home = useHome()
  const history = useStore((state) => state.history)
  const myList = useStore((state) => state.myList)

  const continueCards = useMemo<Card[]>(() => history.slice(0, 20).map((w) => ({ id: w.id, kind: w.kind, title: w.title, poster: w.poster, backdrop: w.backdrop, year: w.year ?? '', rating: null })), [history])
  const listCards = useMemo<Card[]>(() => myList.slice(0, 20).map((s) => ({ id: s.id, kind: s.kind, title: s.title, poster: s.poster, backdrop: s.backdrop, year: s.year ?? '', rating: null })), [myList])

  const refresh = useCallback(() => { home.refetch() }, [home])

  if (home.isPending) return <View style={styles.page}><RoomLight /><Loader /></View>
  if (home.isError && !home.data) return <View style={styles.page}><RoomLight /><ErrorState error={home.error} onRetry={refresh} /></View>

  const data = home.data!
  return (
    <View style={styles.page}>
      <RoomLight />
      <ScrollView
        contentContainerStyle={{ paddingTop: isTV ? 0 : insets.top + 8, paddingBottom: bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={isTV ? undefined : <RefreshControl refreshing={home.isRefetching} onRefresh={refresh} tintColor={colors.red} colors={[colors.red]} progressBackgroundColor="#111" />}
      >
        {isTV ? null : <View style={styles.logo}><Wordmark height={18} /></View>}
        <Billboard items={data.billboard} />
        <View style={[styles.rows, isTV && { marginTop: -40 }]}>
          {continueCards.length > 0 ? <Row title={t('row.continue')} items={continueCards} style="landscape" /> : null}
          {data.rows.map((row) => (
            <Row
              key={row.key}
              title={row.key === 'top10' ? t(row.source === 'site' ? 'row.top10.site' : 'row.top10.world') : t(`row.${row.key}` as StringKey)}
              items={row.items}
              style={row.style}
              more={row.more ? row.key : undefined}
            />
          ))}
          {listCards.length > 0 ? <Row title={t('row.mylist')} items={listCards} /> : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  logo: { paddingHorizontal: space.page, paddingBottom: 14 },
  rows: { gap: space.section, marginTop: space.section },
})
