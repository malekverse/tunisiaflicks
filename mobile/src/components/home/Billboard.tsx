// The billboard: today's most talked-about titles, as on the site.
// - Phones: a swipeable carousel of tall cards (the neighbours peek in), the title's logo over its
//   picture, a few facts, Play and My List; dots below.
// - TV: one full-screen hero that moves on every few seconds, focus starting on Play.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, I18nManager, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Check, Info, Play, Plus } from 'lucide-react-native'
import type { BillboardItem } from '@/lib/api'
import { haptics } from '@/lib/haptics'
import { useT } from '@/i18n'
import { colors, image, isTV, radius, space, tmdbImage } from '@/theme/tokens'
import { Button, IconButton } from '../ui/Button'
import { Rating } from '../ui/Rating'
import { Display, Text } from '../ui/Text'
import { LogoMark } from '../brand/Logo'
import { useMyListToggle } from '../media/useMyListToggle'

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
  const { inList, toggle } = useMyListToggle({ id: item.id, kind: item.kind, title: item.title, poster: item.poster, backdrop: item.backdrop, year: item.year })
  return (
    <IconButton
      label={inList ? t('title.inMyList') : t('title.myList')}
      onPress={toggle}
      icon={inList ? <Check color={colors.white} size={isTV ? 26 : 22} /> : <Plus color={colors.white} size={isTV ? 26 : 22} />}
      size={isTV ? 64 : 50}
    />
  )
}

type SlideProps = { item: BillboardItem, width: number, index: number, count: number, scrollX: Animated.Value }

/** Where the row is scrolled when slide i is in the middle (the row runs from the right in Arabic). */
const centre = (i: number, count: number, width: number) => (I18nManager.isRTL ? count - 1 - i : i) * width

/**
 * One card. While the row moves, the card in the middle is full size and its neighbours sink back a
 * little; the picture slides slower than the card (parallax). Tap: the title; double tap: My List,
 * with a burst of the A.
 */
const PhoneSlide = memo(function PhoneSlide({ item, width, index, count, scrollX }: SlideProps) {
  const router = useRouter()
  const t = useT()
  const play = usePlay(item)
  const { inList, toggle } = useMyListToggle({ id: item.id, kind: item.kind, title: item.title, poster: item.poster, backdrop: item.backdrop, year: item.year })
  const open = useCallback(() => router.push({ pathname: '/title/[kind]/[id]', params: { kind: item.kind, id: String(item.id) } }), [router, item])
  const burst = useRef(new Animated.Value(0)).current
  const press = useRef(new Animated.Value(1)).current
  // The backdrop, not the poster: posters have the title printed on them, and the logo is drawn on top.
  const height = width * 1.2
  const c = centre(index, count, width)
  const range = [c - width, c, c + width]
  const sign = I18nManager.isRTL ? -1 : 1

  const love = useCallback(() => {
    if (!inList) toggle()
    else haptics.tap()
    burst.setValue(0)
    Animated.timing(burst, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [inList, toggle, burst])

  const gesture = useMemo(() => {
    const double = Gesture.Tap().numberOfTaps(2).maxDelay(240).runOnJS(true).onEnd((_event, ok) => { if (ok) love() })
    const single = Gesture.Tap().runOnJS(true)
      .onBegin(() => Animated.timing(press, { toValue: 0.97, duration: 90, useNativeDriver: true }).start())
      .onFinalize(() => Animated.spring(press, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 260 }).start())
      .onEnd((_event, ok) => { if (ok) open() })
    return Gesture.Exclusive(double, single)
  }, [love, open, press])

  return (
    <View style={{ width, paddingHorizontal: 6 }}>
      <Animated.View
        style={[styles.card, {
          height,
          opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp' }),
          transform: [{ scale: Animated.multiply(press, scrollX.interpolate({ inputRange: range, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' })) }],
        }]}
      >
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} accessible accessibilityRole="link" accessibilityLabel={item.title}>
            <Animated.View
              style={[styles.parallax, {
                width: width * 1.3,
                start: -width * 0.15,
                transform: [{ translateX: scrollX.interpolate({ inputRange: range, outputRange: [-width * 0.14 * sign, 0, width * 0.14 * sign], extrapolate: 'clamp' }) }],
              }]}
            >
              <Image source={tmdbImage(item.backdrop ?? item.poster, image.backdropFull)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            </Animated.View>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />
          </View>
        </GestureDetector>
        <Burst progress={burst} />
        <View style={styles.cardBody} pointerEvents="box-none">
          <TitleArt item={item} width={width * 0.72} maxHeight={height * 0.2} />
          <Facts item={item} size={13} />
          <View style={styles.actions}>
            <Button label={t('title.play')} icon={<Play color={colors.white} fill={colors.white} size={18} />} onPress={play} haptic size="large" style={{ flex: 1 }} />
            <ListButton item={item} />
          </View>
        </View>
      </Animated.View>
    </View>
  )
})

/** The double tap's burst: the red A swells out of the picture and fades, inside a ring of light. */
function Burst({ progress }: { progress: Animated.Value }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.burst]}>
      <Animated.View
        style={[styles.ring, {
          opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
        }]}
      />
      <Animated.View
        style={{
          opacity: progress.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 0.25, 0.4, 1], outputRange: [0.2, 1.25, 1, 1.1] }) },
            { translateY: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, -20] }) },
          ],
        }}
      >
        <LogoMark size={92} />
      </Animated.View>
    </View>
  )
}

function PhoneBillboard({ items }: { items: BillboardItem[] }) {
  const { width: screen } = useWindowDimensions()
  const width = screen - space.page * 2 + 12
  // Right to left, the row starts scrolled to its far end (the first card is on the right).
  const scrollX = useRef(new Animated.Value(centre(0, items.length, width))).current
  const [index, setIndex] = useState(0)
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index)
  }).current

  return (
    <View style={{ gap: 14 }}>
      <Animated.FlatList
        horizontal
        data={items}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={({ item, index: i }) => <PhoneSlide item={item} width={width} index={i} count={items.length} scrollX={scrollX} />}
        showsHorizontalScrollIndicator={false}
        // Explicit stops rather than snapToInterval, which snaps back in right-to-left on Android.
        snapToOffsets={items.map((_, i) => i * width)}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: space.page - 6 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={() => haptics.tick()}
        scrollEventThrottle={16}
      />
      {/* The dots stretch into a bar as their card arrives. */}
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {items.map((item, i) => {
          const c = centre(i, items.length, width)
          const range = [c - width, c, c + width]
          return (
            <View key={item.id} style={styles.dotSlot}>
              <Animated.View
                style={[styles.dot, {
                  opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
                  transform: [{ scaleX: scrollX.interpolate({ inputRange: range, outputRange: [6 / 22, 1, 6 / 22], extrapolate: 'clamp' }) }],
                }]}
              />
            </View>
          )
        })}
      </View>
      <Text style={styles.srOnly} accessibilityLiveRegion="polite">{`${index + 1} / ${items.length}`}</Text>
    </View>
  )
}

function TvBillboard({ items }: { items: BillboardItem[] }) {
  const { width, height } = useWindowDimensions()
  const t = useT()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  // Bumped whenever the focus moves between its buttons: the next title waits until you've settled.
  const [moved, setMoved] = useState(0)
  const touch = useCallback(() => setMoved((m) => m + 1), [])
  const item = items[index % items.length]
  const play = usePlay(item)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 12000)
    return () => clearInterval(timer)
  }, [moved, items.length])

  const hero = height * 0.86
  return (
    <View style={{ height: hero }}>
      <Image source={tmdbImage(item.backdrop, image.backdropFull)} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
      <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.45)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', colors.black]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.tvBody, { width: width * 0.46 }]}>
        <TitleArt item={item} width={width * 0.32} maxHeight={hero * 0.17} />
        <Facts item={item} size={20} />
        <Text tone="secondary" size={20} numberOfLines={2} style={{ lineHeight: 30 }}>{item.overview}</Text>
        <View style={[styles.actions, { marginTop: 8 }]}>
          <Button
            label={t('title.play')}
            icon={<Play color={colors.white} fill={colors.white} size={24} />}
            onPress={play}
            onFocus={touch}
            size="large"
            hasTVPreferredFocus
          />
          <Button
            label={t('title.moreInfo')}
            variant="secondary"
            size="large"
            icon={(color) => <Info color={color} size={24} />}
            onPress={() => router.push({ pathname: '/title/[kind]/[id]', params: { kind: item.kind, id: String(item.id) } })}
            onFocus={touch}
          />
          <ListButton item={item} />
        </View>
      </View>
      <View style={[styles.tvDotRow, styles.tvDots]}>
        {items.map((entry, i) => <View key={entry.id} style={[styles.tvDot, i === index % items.length && styles.tvDotOn]} />)}
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
  parallax: { position: 'absolute', top: 0, bottom: 0 },
  burst: { alignItems: 'center', justifyContent: 'center', paddingBottom: '30%' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.red },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  tvDotRow: { flexDirection: 'row', gap: 6 },
  dotSlot: { width: 16, height: 6, alignItems: 'center' },
  dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: colors.white },
  tvDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  tvDotOn: { width: 22, backgroundColor: colors.white },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  tvBody: { position: 'absolute', start: space.page, bottom: 70, gap: 16 },
  tvDots: { position: 'absolute', end: space.page, bottom: 40 },
})
