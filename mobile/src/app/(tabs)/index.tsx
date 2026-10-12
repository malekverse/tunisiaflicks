// Home: the billboard, what you were watching and your list (on this device), then the site's rows.
// Pull down to refresh (the A fills with red: components/motion/PullToRefresh). While it loads, the
// shapes of what's coming shimmer; then the rows rise in, one after another.
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useHome, type Card } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useT, type StringKey } from '@/i18n'
import { Billboard } from '@/components/home/Billboard'
import { Row } from '@/components/media/Row'
import { Wordmark } from '@/components/brand/Logo'
import { RefreshScrollView } from '@/components/motion/PullToRefresh'
import { HomeBones } from '@/components/motion/Shimmer'
import { Rise } from '@/components/motion/Rise'
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

  const refresh = useCallback(() => home.refetch(), [home])

  if (home.isPending) return <View style={styles.page}><RoomLight /><HomeBones top={isTV ? 0 : insets.top + 40} /></View>
  if (home.isError && !home.data) return <View style={styles.page}><RoomLight /><ErrorState error={home.error} onRetry={refresh} /></View>

  const data = home.data!
  return (
    <View style={styles.page}>
      <RoomLight />
      <RefreshScrollView
        onRefresh={refresh}
        top={insets.top + 6}
        contentContainerStyle={{ paddingTop: isTV ? 0 : insets.top + 8, paddingBottom: bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isTV ? null : <Rise distance={8}><View style={styles.logo}><Wordmark height={18} /></View></Rise>}
        <Rise distance={26}><Billboard items={data.billboard} /></Rise>
        <View style={[styles.rows, isTV && { marginTop: -40 }]}>
          {continueCards.length > 0 ? <Rise delay={120}><Row title={t('row.continue')} items={continueCards} style="landscape" /></Rise> : null}
          {data.rows.map((row, i) => (
            // Only the first few rows are on screen when the page arrives; the rest just appear.
            <Rise key={row.key} delay={i < 4 ? 180 + i * 90 : 0} distance={i < 4 ? 18 : 0}>
              <Row
                title={row.key === 'top10' ? t(row.source === 'site' ? 'row.top10.site' : 'row.top10.world') : t(`row.${row.key}` as StringKey)}
                items={row.items}
                style={row.style}
                more={row.more ? row.key : undefined}
              />
            </Rise>
          ))}
          {listCards.length > 0 ? <Row title={t('row.mylist')} items={listCards} /> : null}
        </View>
      </RefreshScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  logo: { paddingHorizontal: space.page, paddingBottom: 14 },
  rows: { gap: space.section, marginTop: space.section },
})
