// My List: what you've kept (newest first), then what you watched recently. Both live on this device.
// Press and hold a title to take it off the list.
import { useMemo } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bookmark } from 'lucide-react-native'
import type { Card } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useT } from '@/i18n'
import { Grid } from '@/components/media/Grid'
import { Row } from '@/components/media/Row'
import { EmptyState } from '@/components/ui/States'
import { Display } from '@/components/ui/Text'
import { RoomLight } from '@/components/ui/RoomLight'
import { useTabBarSpace } from '@/components/shell/TabBar'
import { colors, isTV, space, type } from '@/theme/tokens'

const toCard = (s: { id: number, kind: Card['kind'], title: string, poster: string | null, backdrop: string | null, year?: string }): Card => (
  { id: s.id, kind: s.kind, title: s.title, poster: s.poster, backdrop: s.backdrop, year: s.year ?? '', rating: null }
)

export default function LibraryScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const bottom = useTabBarSpace()
  const myList = useStore((state) => state.myList)
  const history = useStore((state) => state.history)
  const remove = useStore((state) => state.removeFromList)
  const cards = useMemo(() => myList.map(toCard), [myList])
  const watched = useMemo(() => history.slice(0, 20).map(toCard), [history])

  const confirmRemove = (card: Card) => Alert.alert(card.title, undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('library.remove'), style: 'destructive', onPress: () => remove(card.kind, card.id) },
  ])

  const header = (
    <View style={{ marginHorizontal: -space.page }}>
      {watched.length ? <View style={{ marginBottom: space.section }}><Row title={t('library.watched')} items={watched} style="landscape" /></View> : null}
      {isTV && !watched.length ? null : (
        <Display size={watched.length ? type.sectionTitle : type.pageTitle} style={styles.title} accessibilityRole="header">{t('nav.library')}</Display>
      )}
    </View>
  )

  return (
    <View style={styles.page}>
      <RoomLight />
      <Grid
        items={cards}
        header={isTV || watched.length ? header : <Display size={type.pageTitle} style={styles.titleFlush} accessibilityRole="header">{t('nav.library')}</Display>}
        empty={<EmptyState icon={<Bookmark color={colors.text2} size={30} />} title={t('library.empty')} text={t('library.emptyText')} />}
        onLongPress={confirmRemove}
        top={isTV ? 140 : insets.top + 12}
        bottom={bottom + 24}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  title: { paddingHorizontal: space.page, marginBottom: 14 },
  titleFlush: { marginBottom: 14 },
})
