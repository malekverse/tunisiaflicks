// Titles as cards: posters (2:3, radius 10), landscape tiles (16:9, radius 14), and the Top 10's
// ranked posters with the big outlined number (the site's Top10Row). One press opens the title.
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Svg, { Text as SvgText } from 'react-native-svg'
import type { Card } from '@/lib/api'
import { colors, fonts, image, isTV, radius, sizes, tmdbImage } from '@/theme/tokens'
import { peek } from './Peek'
import { Focusable } from '../ui/Focusable'
import { Text } from '../ui/Text'
import { Rating } from '../ui/Rating'

function useOpen(card: Pick<Card, 'kind' | 'id'>) {
  const router = useRouter()
  return () => router.push({ pathname: '/title/[kind]/[id]', params: { kind: card.kind, id: String(card.id) } })
}

/** Press and hold: the peek (phones only). */
const holdFor = (card: Card, custom?: () => void) => (isTV ? custom : custom ?? (() => peek(card)))

/** A blank card in the same shape while there's no picture (and as the skeleton). */
export function Blank({ style }: { style?: object }) {
  return <View style={[styles.blank, style]} />
}

type CardProps = { card: Card, width?: number, hasTVPreferredFocus?: boolean, onFocus?: () => void, onLongPress?: () => void }

export const PosterCard = memo(function PosterCard({ card, width = sizes.poster, hasTVPreferredFocus, onFocus, onLongPress }: CardProps) {
  const open = useOpen(card)
  const uri = tmdbImage(card.poster, image.poster)
  return (
    <Focusable
      onPress={open}
      onLongPress={holdFor(card, onLongPress)}
      delayLongPress={320}
      onFocus={onFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      radius={radius.poster}
      focusScale={1.08}
      accessibilityRole="link"
      accessibilityLabel={card.year ? `${card.title}, ${card.year}` : card.title}
      style={{ width }}
    >
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={`${card.kind}${card.id}`} /> : <PosterFallback title={card.title} />}
      </View>
      {isTV ? null : (
        <View style={styles.posterMeta}>
          <Text size={13} numberOfLines={1} style={{ flex: 1 }}>{card.title}</Text>
          {card.rating ? <Rating value={card.rating} small /> : null}
        </View>
      )}
    </Focusable>
  )
})

export const LandscapeCard = memo(function LandscapeCard({ card, width = sizes.landscape, onFocus }: CardProps) {
  const open = useOpen(card)
  const uri = tmdbImage(card.backdrop ?? card.poster, image.backdrop)
  return (
    <Focusable onPress={open} onLongPress={holdFor(card)} delayLongPress={320} onFocus={onFocus} radius={radius.tile} focusScale={1.05} accessibilityRole="link" accessibilityLabel={card.title} style={{ width }}>
      <View style={[styles.tile, { width, height: width * 0.5625 }]}>
        {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={`l${card.kind}${card.id}`} /> : null}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.tileShade} />
        <View style={styles.tileText}>
          <Text weight="semibold" size={isTV ? 20 : 15} numberOfLines={1}>{card.title}</Text>
          <View style={styles.row}>
            {card.year ? <Text tone="secondary" size={isTV ? 16 : 12.5}>{card.year}</Text> : null}
            {card.rating ? <Rating value={card.rating} small /> : null}
          </View>
        </View>
      </View>
    </Focusable>
  )
})

/** A Top 10 card: the rank as a big outlined numeral, the poster overlapping it (the site's look). */
export const Top10Card = memo(function Top10Card({ card, rank, onFocus }: CardProps & { rank: number }) {
  const open = useOpen(card)
  const uri = tmdbImage(card.poster, image.poster)
  const posterWidth = sizes.top10 * 0.72
  const numberHeight = posterWidth * 1.5
  return (
    <Focusable onPress={open} onLongPress={holdFor(card)} delayLongPress={320} onFocus={onFocus} radius={radius.poster} focusScale={1.06} accessibilityRole="link" accessibilityLabel={`${rank}. ${card.title}`} style={[styles.top10, { width: sizes.top10 + (rank >= 10 ? 26 : 0) }]}>
      <Svg width={rank >= 10 ? 120 : 76} height={numberHeight} style={styles.rank}>
        <SvgText
          x={rank >= 10 ? 60 : 38}
          y={numberHeight * 0.97}
          textAnchor="middle"
          fontSize={numberHeight * 0.92}
          fontFamily={fonts.display}
          fill={colors.black}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={2.5}
        >
          {String(rank)}
        </SvgText>
      </Svg>
      <View style={[styles.poster, styles.top10Poster, { width: posterWidth, height: posterWidth * 1.5 }]}>
        {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={`t${card.kind}${card.id}`} /> : <PosterFallback title={card.title} />}
      </View>
    </Focusable>
  )
})

function PosterFallback({ title }: { title: string }) {
  return (
    <View style={styles.fallback}>
      <Text tone="secondary" size={13} numberOfLines={4} style={{ textAlign: 'center' }}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  blank: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.poster },
  poster: { borderRadius: radius.poster, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  posterMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, paddingHorizontal: 1 },
  tile: { borderRadius: radius.tile, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'flex-end' },
  tileShade: { ...StyleSheet.absoluteFill, top: '40%' },
  tileText: { padding: isTV ? 16 : 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  top10: { flexDirection: 'row', alignItems: 'flex-end' },
  rank: { marginEnd: -22 },
  top10Poster: { marginStart: 0 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 },
})
