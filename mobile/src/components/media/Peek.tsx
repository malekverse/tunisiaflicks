// Peek: press and hold any title for a closer look without leaving the page: its picture, the facts,
// the story (fetched as it opens, which also gets the title page ready), and Play, My List, Details.
// A tap outside or Back closes it. Phones only (a TV remote has no long press worth teaching).
import { useEffect, useRef } from 'react'
import { Animated, BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { create } from 'zustand'
import { Check, ChevronRight, Play, Plus } from 'lucide-react-native'
import { useTitle, type Card } from '@/lib/api'
import { haptics } from '@/lib/haptics'
import { useIsArabic, useT } from '@/i18n'
import { colors, image, radius, tmdbImage } from '@/theme/tokens'
import { Button } from '../ui/Button'
import { Focusable } from '../ui/Focusable'
import { Rating } from '../ui/Rating'
import { Display, Text } from '../ui/Text'
import { useMyListToggle } from './useMyListToggle'

const usePeekStore = create<{ card: Card | null }>(() => ({ card: null }))

export function peek(card: Card) {
  haptics.press()
  usePeekStore.setState({ card })
}

const close = () => usePeekStore.setState({ card: null })

export function PeekHost() {
  const card = usePeekStore((state) => state.card)
  const shown = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!card) return
    shown.setValue(0)
    Animated.spring(shown, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 240, mass: 0.7 }).start()
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card])

  const dismiss = () => {
    Animated.timing(shown, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => close())
  }

  if (!card) return null
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: shown }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={{
            opacity: shown,
            transform: [
              { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
              { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
            ],
          }}
        >
          <PeekCard card={card} onDone={dismiss} />
        </Animated.View>
      </View>
    </View>
  )
}

function PeekCard({ card, onDone }: { card: Card, onDone: () => void }) {
  const t = useT()
  const router = useRouter()
  const arabic = useIsArabic()
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(width - 32, 420)
  const title = useTitle(card.kind, card.id)
  const { inList, toggle: toggleList } = useMyListToggle({ id: card.id, kind: card.kind, title: card.title, poster: card.poster, backdrop: card.backdrop, year: card.year })
  const data = title.data
  const picture = tmdbImage(data?.backdrop ?? card.backdrop ?? card.poster, image.backdrop)
  const facts = [data?.year || card.year, data?.genres.slice(0, 2).map((g) => g.name).join(' / ')].filter(Boolean)

  const go = (pathname: '/watch' | '/title/[kind]/[id]') => {
    onDone()
    if (pathname === '/watch') router.push({ pathname, params: { kind: card.kind, id: String(card.id), title: card.title } })
    else router.push({ pathname, params: { kind: card.kind, id: String(card.id) } })
  }

  return (
    <View style={[styles.card, { width: cardWidth }]} accessibilityViewIsModal>
      <View style={{ height: cardWidth * 0.5625 }}>
        {picture ? <Image source={picture} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <LinearGradient colors={['transparent', 'rgba(20,20,20,1)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
        {data?.logo ? (
          <Image
            source={tmdbImage(data.logo.path, image.logo)}
            style={[styles.logo, { width: Math.min(cardWidth * 0.6, 64 * data.logo.ratio), height: Math.min(64, (cardWidth * 0.6) / data.logo.ratio) }]}
            contentFit="contain"
            accessibilityLabel={card.title}
          />
        ) : null}
      </View>
      <View style={styles.body}>
        {data?.logo ? null : <Display size={26} numberOfLines={2}>{card.title}</Display>}
        <View style={styles.facts}>
          {(data?.rating ?? card.rating) ? <Rating value={(data?.rating ?? card.rating)!} small /> : null}
          {facts.map((fact) => <Text key={fact} tone="secondary" size={13} numberOfLines={1} style={{ flexShrink: 1 }}>{fact}</Text>)}
        </View>
        {data?.overview ? <Text tone="secondary" size={14} numberOfLines={4} style={{ lineHeight: 20 }}>{data.overview}</Text> : null}
        <View style={styles.actions}>
          <Button label={t('title.play')} icon={<Play color={colors.white} fill={colors.white} size={18} />} onPress={() => go('/watch')} haptic style={{ flex: 1 }} />
          <Focusable onPress={toggleList} radius={22} style={styles.round} accessibilityRole="button" accessibilityLabel={inList ? t('title.inMyList') : t('title.myList')}>
            {inList ? <Check color={colors.white} size={22} strokeWidth={2.4} /> : <Plus color={colors.white} size={22} />}
          </Focusable>
        </View>
        <Focusable onPress={() => go('/title/[kind]/[id]')} radius={14} style={styles.details} accessibilityRole="link">
          <Text weight="medium" size={14}>{t('peek.details')}</Text>
          <ChevronRight color={colors.text2} size={18} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Focusable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.78)' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    borderRadius: radius.panel,
    overflow: 'hidden',
    backgroundColor: 'rgb(20,20,20)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: colors.red,
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },
    elevation: 24,
  },
  logo: { position: 'absolute', start: 18, bottom: 6 },
  body: { padding: 18, paddingTop: 10, gap: 12 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  details: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
})
