// Titles as a grid of posters (search results, "See all", My List): as many columns as fit, the
// same gutters as the rows. Virtualised, and it can load more as you reach the end.
import { useCallback } from 'react'
import { FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItem } from 'react-native'
import type { Card } from '@/lib/api'
import { isTV, space } from '@/theme/tokens'
import { PosterCard } from './Cards'

type Props = {
  items: Card[]
  header?: React.ReactElement | null
  footer?: React.ReactElement | null
  empty?: React.ReactElement | null
  onEndReached?: () => void
  bottom?: number
  top?: number
  onLongPress?: (card: Card) => void
}

/** How many posters fit across, and how wide each is. */
export function useGridColumns() {
  const { width } = useWindowDimensions()
  const target = isTV ? 200 : width >= 600 ? 140 : 108
  const columns = Math.max(3, Math.floor((width - space.page * 2 + space.gap) / (target + space.gap)))
  const cardWidth = (width - space.page * 2 - space.gap * (columns - 1)) / columns
  return { columns, cardWidth }
}

export function Grid({ items, header, footer, empty, onEndReached, bottom = 24, top = 0, onLongPress }: Props) {
  const { columns, cardWidth } = useGridColumns()
  const render: ListRenderItem<Card> = useCallback(({ item, index }) => (
    <View style={{ width: cardWidth, marginStart: index % columns === 0 ? 0 : space.gap }}>
      <PosterCard card={item} width={cardWidth} hasTVPreferredFocus={isTV && index === 0} onLongPress={onLongPress ? () => onLongPress(item) : undefined} />
    </View>
  ), [cardWidth, columns, onLongPress])

  return (
    <FlatList
      key={columns}
      data={items}
      numColumns={columns}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      renderItem={render}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom }]}
      columnWrapperStyle={styles.line}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={columns * 4}
      windowSize={7}
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.page, flexGrow: 1 },
  line: { marginBottom: isTV ? 26 : 18 },
})
