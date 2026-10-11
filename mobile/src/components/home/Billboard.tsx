// The billboard: today's most talked-about titles, as on the site.
// - Phones: a swipeable carousel of tall cards (the neighbours peek in), the title's logo over its
//   picture, a few facts, Play and My List; dots below.
// - TV: one full-screen hero that moves on every few seconds, focus starting on Play.
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Check, Info, Play, Plus } from 'lucide-react-native'
import type { BillboardItem } from '@/lib/api'
import { useInMyList, useStore } from '@/lib/store'
import { useT } from '@/i18n'
import { colors, image, isTV, radius, space, tmdbImage } from '@/theme/tokens'
import { Button, IconButton } from '../ui/Button'
import { Focusable } from '../ui/Focusable'
import { Rating } from '../ui/Rating'
import { Display, Text } from '../ui/Text'

function usePlay(item: BillboardItem) {
  const router = useRouter()
  return useCallback(() => {
    router.push({ pathname: '/watch', params: { kind: item.kind, id: String(item.id), title: item.title } })
  }, [router, item])
}

function Facts({ item, size }: { item: BillboardItem, size: number }) {
  const t = useT()
  const facts: string[] = []
  if (item.year) facts.push(item.year)
  if (item.kind === 'tv' && item.seasons) facts.push(item.seasons === 1 ? t('title.oneSeason') : t('title.seasonsCount', { n: item.seasons }))
  if (item.kind === 'movie' && item.runtime) {
    const h = Math.floor(item.runtime / 60)
    facts.push(h ? t('title.hoursMinutes', { h, m: item.runtime % 60 }) : t('title.minutes', { n: item.runtime }))
  }
  return (
    <View style={styles.facts}>
      {item.rating ? <Rating value={item.rating} /> : null}
      {facts.map((fact) => <Text key={fact} tone="secondary" weight="medium" size={size}>{fact}</Text>)}
      {item.genres.length ? <Text tone="secondary" size={size} numberOfLines={1} style={{ flexShrink: 1 }}>{item.genres.slice(0, 2).join(' / ')}</Text> : null}
    </View>
  )
}

function TitleArt({ item, width, maxHeight }: { item: BillboardItem, width: number, maxHeight: number }) {
  if (item.logo) {
    const height = Math.min(maxHeight, width / item.logo.ratio)
    return <Image source={tmdbImage(item.logo.path, image.logo)} style={{ width: height * item.logo.ratio, height }} contentFit="contain" accessibilityLabel={item.title} />
  }
  return <Display size={isTV ? 56 : 34} numberOfLines={2}>{item.title}</Display>
}

function ListButton({ item }: { item: BillboardItem }) {
  const t = useT()
  const inList = useInMyList(item.kind, item.id)
  const toggle = useStore((state) => state.toggleMyList)
  return (
    <IconButton
      haptic
      label={inList ? t('title.inMyList') : t('title.myList')}
      onPress={() => toggle({ id: item.id, kind: item.kind, title: item.title, poster: item.poster, backdrop: item.backdrop, year: item.year })}
      icon={inList ? <Check color={colors.white} size={isTV ? 26 : 22} /> : <Plus color={colors.white} size={isTV ? 26 : 22} />}
      size={isTV ? 64 : 50}
    />
  )
}

const PhoneSlide = memo(function PhoneSlide({ item, width }: { item: BillboardItem, width: number }) {
  const router = useRouter()
  const t = useT()
  const play = usePlay(item)
  const open = () => router.push({ pathname: '/title/[kind]/[id]', params: { kind: item.kind, id: String(item.id) } })
  // The backdrop, not the poster: posters have the title printed on them, and the logo is drawn on top.
  const height = width * 1.2
  return (
    <View style={{ width, paddingHorizontal: 6 }}>
      <Focusable onPress={open} radius={radius.stage} accessibilityRole="link" accessibilityLabel={item.title} style={[styles.card, { height }]}>
        <Image source={tmdbImage(item.backdrop ?? item.poster, image.backdropFull)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.cardBody}>
          <TitleArt item={item} width={width * 0.72} maxHeight={height * 0.2} />
          <Facts item={item} size={13} />
          <View style={styles.actions}>
            <Button label={t('title.play')} icon={<Play color={colors.white} fill={colors.white} size={18} />} onPress={play} haptic size="large" style={{ flex: 1 }} />
            <ListButton item={item} />
          </View>
        </View>
      </Focusable>
    </View>
  )
})

function PhoneBillboard({ items }: { items: BillboardItem[] }) {
  const { width: screen } = useWindowDimensions()
  const width = screen - space.page * 2 + 12
  const [index, setIndex] = useState(0)
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index)
  }).current

  return (
    <View style={{ gap: 14 }}>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={({ item }) => <PhoneSlide item={item} width={width} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: space.page - 6 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
      <View style={styles.dots} accessibilityElementsHidden>
        {items.map((item, i) => <View key={item.id} style={[styles.dot, i === index && styles.dotOn]} />)}
      </View>
    </View>
  )
}

function TvBillboard({ items }: { items: BillboardItem[] }) {
  const { width, height } = useWindowDimensions()
  const t = useT()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const item = items[index % items.length]
  const play = usePlay(item)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 9000)
    return () => clearInterval(timer)
  }, [paused, items.length])

  const hero = height * 0.78
  return (
    <View style={{ height: hero }}>
      <Image source={tmdbImage(item.backdrop, image.backdropFull)} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
      <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.45)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', colors.black]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.tvBody, { width: width * 0.46 }]}>
        <TitleArt item={item} width={width * 0.36} maxHeight={hero * 0.24} />
        <Facts item={item} size={20} />
        <Text tone="secondary" size={20} numberOfLines={3} style={{ lineHeight: 30 }}>{item.overview}</Text>
        <View style={[styles.actions, { marginTop: 8 }]}>
          <Button
            label={t('title.play')}
            icon={<Play color={colors.white} fill={colors.white} size={24} />}
            onPress={play}
            size="large"
            hasTVPreferredFocus
          />
          <Button
            label={t('title.moreInfo')}
            variant="secondary"
            size="large"
            icon={<Info color={colors.white} size={24} />}
            onPress={() => router.push({ pathname: '/title/[kind]/[id]', params: { kind: item.kind, id: String(item.id) } })}
          />
          <View onTouchStart={() => setPaused(true)}>
            <ListButton item={item} />
          </View>
        </View>
      </View>
      <View style={[styles.dots, styles.tvDots]}>
        {items.map((entry, i) => <View key={entry.id} style={[styles.dot, i === index % items.length && styles.dotOn]} />)}
      </View>
    </View>
  )
}

export function Billboard({ items }: { items: BillboardItem[] }) {
  if (items.length === 0) return null
  return isTV ? <TvBillboard items={items} /> : <PhoneBillboard items={items} />
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.stage, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  cardBody: { position: 'absolute', start: 0, end: 0, bottom: 0, padding: 18, gap: 12, alignItems: 'center' },
  facts: { flexDirection: 'row', alignItems: 'center', gap: isTV ? 16 : 10, flexWrap: 'nowrap' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: isTV ? 16 : 10, alignSelf: 'stretch' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 22, backgroundColor: colors.white },
  tvBody: { position: 'absolute', start: space.page, bottom: 70, gap: 16 },
  tvDots: { position: 'absolute', end: space.page, bottom: 40 },
})
