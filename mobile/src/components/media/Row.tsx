// A row of titles: the section title (with "See all" when there's more), then cards side by side,
// edge to edge. Rows are virtualised lists: only the cards on screen are drawn.
import { memo, useCallback } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import type { Card } from '@/lib/api'
import { useIsArabic, useT } from '@/i18n'
import { colors, isTV, sizes, space } from '@/theme/tokens'
import { Focusable } from '../ui/Focusable'
import { Display, Text } from '../ui/Text'
import { LandscapeCard, PosterCard, Top10Card } from './Cards'

type Props = {
  title: string
  items: Card[]
  style?: 'poster' | 'top10' | 'landscape'
  /** The list key "See all" opens (none: no "See all"). */
  more?: string
  note?: string
}

export const Row = memo(function Row({ title, items, style = 'poster', more, note }: Props) {
  const router = useRouter()
  const t = useT()
  const arabic = useIsArabic()
  const width = style === 'landscape' ? sizes.landscape : style === 'top10' ? sizes.top10 : sizes.poster

  const render = useCallback(({ item, index }: { item: Card, index: number }) => {
    if (style === 'top10') return <Top10Card card={item} rank={index + 1} />
    if (style === 'landscape') return <LandscapeCard card={item} />
    return <PosterCard card={item} />
  }, [style])

  if (items.length === 0) return null
  return (
    <View style={styles.row}>
      <SectionHeader
        title={title}
        note={note}
        action={more ? { label: t('common.seeAll'), onPress: () => router.push({ pathname: '/list/[key]', params: { key: more, title } }) } : undefined}
        arabic={arabic}
      />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={render}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        initialNumToRender={isTV ? 7 : 5}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={style === 'top10' ? undefined : (_, index) => ({ length: width + space.gap, offset: (width + space.gap) * index, index })}
      />
    </View>
  )
})

function Separator() {
  return <View style={{ width: space.gap }} />
}

export function SectionHeader({ title, note, action, arabic }: { title: string, note?: string, action?: { label: string, onPress: () => void }, arabic?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Display accessibilityRole="header">{title}</Display>
        {note ? <Text tone="tertiary" size={isTV ? 16 : 12.5} style={{ marginTop: 2 }}>{note}</Text> : null}
      </View>
      {action ? (
        <Focusable onPress={action.onPress} radius={16} style={styles.more} accessibilityRole="link" accessibilityLabel={`${action.label}, ${title}`}>
          <Text tone="secondary" weight="medium" size={isTV ? 18 : 13.5}>{action.label}</Text>
          <ChevronRight size={isTV ? 20 : 16} color={colors.text2} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Focusable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: isTV ? 16 : 12 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.page, gap: 12 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingStart: 8 },
  list: { paddingHorizontal: space.page, paddingVertical: isTV ? 14 : 2 },
})
