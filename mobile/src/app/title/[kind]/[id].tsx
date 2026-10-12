// A movie or a show: the picture and its logo, the facts, Play (the next episode for a show you're
// following), My List, the trailer and Share; then the story, the seasons and their episodes, the cast
// and more like it. On TV the same, as a full-screen hero with the focus on Play.
// Phones: the picture drifts slower than the page (parallax), and once it has scrolled away a glass
// header with the title fades in; the hero's parts rise in as the page opens.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, FlatList, Share, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Check, Clapperboard, Play, Plus, Share2, ShieldAlert } from 'lucide-react-native'
import { ApiError, SITE, useSeason, useTitle, type Episode, type Kind, type Title } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useIsArabic, useT } from '@/i18n'
import { Row, SectionHeader } from '@/components/media/Row'
import { Bone, ShimmerGroup } from '@/components/motion/Shimmer'
import { Rise } from '@/components/motion/Rise'
import { useMyListToggle } from '@/components/media/useMyListToggle'
import { Button, IconButton } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Focusable } from '@/components/ui/Focusable'
import { Rating } from '@/components/ui/Rating'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Display, Text } from '@/components/ui/Text'
import { colors, image, isTV, radius, space, tmdbImage } from '@/theme/tokens'

export default function TitleScreen() {
  const params = useLocalSearchParams<{ kind: string, id: string }>()
  const kind: Kind = params.kind === 'tv' ? 'tv' : 'movie'
  const id = Number(params.id)
  const query = useTitle(kind, id)
  const t = useT()
  const router = useRouter()

  if (query.isPending) return <TitleBones />
  if (query.isError) {
    const error = query.error
    if (error instanceof ApiError && error.status === 403) {
      return <View style={styles.page}><EmptyState icon={<ShieldAlert color={colors.text2} size={30} />} title={t('title.kidsBlocked')} action={<Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />} /></View>
    }
    if (error instanceof ApiError && error.status === 404) {
      return <View style={styles.page}><EmptyState icon={<Clapperboard color={colors.text2} size={30} />} title={t('title.notFound')} action={<Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />} /></View>
    }
    return <View style={styles.page}><ErrorState error={error} onRetry={() => query.refetch()} /></View>
  }
  return <TitleView title={query.data} />
}

function runtimeLabel(t: ReturnType<typeof useT>, minutes: number) {
  const h = Math.floor(minutes / 60)
  return h ? t('title.hoursMinutes', { h, m: minutes % 60 }) : t('title.minutes', { n: minutes })
}

function TitleView({ title }: { title: Title }) {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const arabic = useIsArabic()
  const { width, height } = useWindowDimensions()
  const { inList, toggle } = useMyListToggle({ id: title.id, kind: title.kind, title: title.title, poster: title.poster, backdrop: title.backdrop, year: title.year })
  const scrollY = useRef(new Animated.Value(0)).current
  const watched = useStore((state) => state.history.find((w) => w.kind === title.kind && w.id === title.id))
  const [season, setSeason] = useState<number | null>(title.kind === 'tv' ? (watched?.season ?? title.seasons[0]?.number ?? null) : null)
  const [expanded, setExpanded] = useState(false)

  const play = (s?: number, e?: number) => router.push({
    pathname: '/watch',
    params: { kind: title.kind, id: String(title.id), title: title.title, ...(s ? { season: String(s), episode: String(e ?? 1) } : {}) },
  })
  const playMain = () => (title.kind === 'tv' ? play(watched?.season ?? title.seasons[0]?.number ?? 1, watched?.episode ?? 1) : play())
  const share = () => Share.share({ message: `${title.title} ${SITE}/${title.kind}/${title.id}` }).catch(() => {})
  const facts = useMemo(() => {
    const list: string[] = []
    if (title.year) list.push(title.year)
    if (title.kind === 'movie' && title.runtime) list.push(runtimeLabel(t, title.runtime))
    if (title.kind === 'tv' && title.seasons.length) list.push(title.seasons.length === 1 ? t('title.oneSeason') : t('title.seasonsCount', { n: title.seasons.length }))
    return list
  }, [title, t])

  const playLabel = title.kind === 'tv' && watched?.season ? t('title.playEpisode', { season: watched.season, episode: watched.episode ?? 1 }) : t('title.play')
  const backdrop = tmdbImage(title.backdrop, isTV ? image.backdropFull : image.backdrop)
  const heroHeight = isTV ? height : Math.min(width * 0.62, 320)

  const header = (
    <View style={isTV ? [styles.tvHero, { height: heroHeight }] : undefined}>
      <Animated.View
        style={isTV ? StyleSheet.absoluteFill : {
          height: heroHeight,
          transform: [{ translateY: scrollY.interpolate({ inputRange: [0, heroHeight], outputRange: [0, heroHeight * 0.45], extrapolateLeft: 'clamp' }) }],
          opacity: scrollY.interpolate({ inputRange: [0, heroHeight], outputRange: [1, 0.3], extrapolate: 'clamp' }),
        }}
      >
        {backdrop ? <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent', colors.black]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        {isTV ? <LinearGradient colors={['rgba(0,0,0,0.92)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      </Animated.View>
      <View style={isTV ? [styles.tvBody, { width: width * 0.48 }] : styles.body}>
        <Rise distance={14}>
        {title.logo ? (
          <Image
            source={tmdbImage(title.logo.path, image.logo)}
            style={{ width: Math.min(isTV ? width * 0.3 : width * 0.66, (isTV ? 120 : 96) * title.logo.ratio), height: Math.min(isTV ? 120 : 96, (isTV ? width * 0.3 : width * 0.66) / title.logo.ratio), alignSelf: isTV ? 'flex-start' : 'center' }}
            contentFit="contain"
            accessibilityLabel={title.title}
          />
        ) : (
          <Display size={isTV ? 60 : 34} style={{ textAlign: isTV ? 'auto' : 'center' }} accessibilityRole="header">{title.title}</Display>
        )}
        </Rise>
        <Rise delay={90} distance={12} style={{ gap: 12 }}>
        <View style={[styles.facts, !isTV && { justifyContent: 'center' }]}>
          {title.rating ? <Rating value={title.rating} /> : null}
          {facts.map((fact) => <Text key={fact} tone="secondary" weight="medium" size={isTV ? 20 : 14}>{fact}</Text>)}
        </View>
        {title.genres.length ? <Text tone="tertiary" size={isTV ? 18 : 13} style={{ textAlign: isTV ? 'auto' : 'center' }}>{title.genres.map((g) => g.name).join(' / ')}</Text> : null}
        </Rise>
        <Rise delay={170} distance={12} style={{ gap: 12 }}>
        <Button label={playLabel} icon={<Play color={colors.white} fill={colors.white} size={isTV ? 24 : 20} />} onPress={playMain} haptic size="large" hasTVPreferredFocus style={isTV ? { alignSelf: 'flex-start', marginTop: 10 } : { marginTop: 6 }} />
        <View style={[styles.actions, isTV && { justifyContent: 'flex-start' }]}>
          <Action label={inList ? t('title.inMyList') : t('title.myList')} onPress={toggle} icon={<Pop on={inList}>{inList ? <Check color={colors.white} size={isTV ? 28 : 24} strokeWidth={2.4} /> : <Plus color={colors.white} size={isTV ? 28 : 24} />}</Pop>} />
          {title.trailer ? <Action label={t('title.trailer')} onPress={() => router.push({ pathname: '/trailer', params: { key: title.trailer! } })} icon={<Clapperboard color={colors.white} size={isTV ? 28 : 24} />} /> : null}
          {isTV ? null : <Action label={t('common.share')} onPress={share} icon={<Share2 color={colors.white} size={24} />} />}
        </View>
        {title.overview ? (
          <Focusable onPress={() => setExpanded((e) => !e)} plain disabled={isTV} accessibilityRole="button" accessibilityLabel={title.overview}>
            <Text tone="secondary" size={isTV ? 20 : 15} numberOfLines={expanded ? undefined : 3} style={{ lineHeight: isTV ? 30 : 22, textAlign: isTV ? 'auto' : 'left' }}>{title.overview}</Text>
          </Focusable>
        ) : null}
        </Rise>
      </View>
    </View>
  )

  return (
    <View style={styles.page}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {header}
        <View style={styles.sections}>
          {title.kind === 'tv' && title.seasons.length > 0 ? (
            <Seasons title={title} season={season} onSeason={setSeason} onPlay={play} current={watched} />
          ) : null}
          {title.cast.length > 0 ? <Cast cast={title.cast} /> : null}
          {title.similar.length > 0 ? <Row title={t('title.moreLikeThis')} items={title.similar} /> : null}
        </View>
      </Animated.ScrollView>
      {isTV ? null : (
        // The header: the back button always; the glass and the title once the picture has gone.
        <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.barGlass, { opacity: scrollY.interpolate({ inputRange: [heroHeight - 170, heroHeight - 90], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
          <IconButton label={t('common.close')} onPress={() => router.back()} icon={<ArrowLeft color={colors.white} size={22} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />} style={styles.glassButton} />
          <Animated.View
            pointerEvents="none"
            style={{
              flex: 1,
              // The title arrives as the logo slides under the header.
              opacity: scrollY.interpolate({ inputRange: [heroHeight - 100, heroHeight - 40], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ translateY: scrollY.interpolate({ inputRange: [heroHeight - 100, heroHeight - 40], outputRange: [8, 0], extrapolate: 'clamp' }) }],
            }}
          >
            <Display size={20} numberOfLines={1}>{title.title}</Display>
          </Animated.View>
        </View>
      )}
    </View>
  )
}

/** An icon that pops when it changes (My List's plus becoming a check). */
function Pop({ on, children }: { on: boolean, children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    scale.setValue(0.4)
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 280, mass: 0.6 }).start()
  }, [on, scale])
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
}

/** The page while it loads: the picture, the title and the buttons as shimmering shapes. */
function TitleBones() {
  const { width } = useWindowDimensions()
  const heroHeight = isTV ? 420 : Math.min(width * 0.62, 320)
  return (
    <View style={styles.page}>
      <ShimmerGroup>
        <Bone style={{ height: heroHeight, borderRadius: 0 }} />
        <View style={{ padding: space.page, gap: 14, alignItems: isTV ? 'flex-start' : 'center' }}>
          <Bone style={{ width: width * 0.55, height: 44, borderRadius: 10 }} />
          <Bone style={{ width: width * 0.4, height: 14, borderRadius: 6 }} />
          <Bone style={{ alignSelf: 'stretch', height: 52, borderRadius: 26, marginTop: 8 }} />
          <Bone style={{ alignSelf: 'stretch', height: 14, borderRadius: 6, marginTop: 14 }} />
          <Bone style={{ alignSelf: 'stretch', height: 14, borderRadius: 6 }} />
          <Bone style={{ width: width * 0.6, height: 14, borderRadius: 6 }} />
        </View>
      </ShimmerGroup>
    </View>
  )
}

function Action({ label, icon, onPress }: { label: string, icon: React.ReactNode, onPress: () => void }) {
  return (
    <Focusable onPress={onPress} haptic radius={18} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      {icon}
      <Text tone="secondary" weight="medium" size={isTV ? 16 : 12} numberOfLines={1}>{label}</Text>
    </Focusable>
  )
}

function Seasons({ title, season, onSeason, onPlay, current }: { title: Title, season: number | null, onSeason: (n: number) => void, onPlay: (s: number, e: number) => void, current?: { season?: number, episode?: number } }) {
  const t = useT()
  const { data, isPending } = useSeason(title.id, season)
  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title={t('title.episodes')} />
      {title.seasons.length > 1 ? (
        <FlatList
          horizontal
          data={title.seasons}
          keyExtractor={(s) => String(s.number)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.page, gap: 8 }}
          renderItem={({ item }) => <Chip label={t('title.season', { n: item.number })} selected={item.number === season} onPress={() => onSeason(item.number)} role="tab" />}
        />
      ) : null}
      {isPending ? (
        <ShimmerGroup>
          <View style={{ paddingHorizontal: space.page, gap: 14, flexDirection: isTV ? 'row' : 'column' }}>
            {[0, 1, 2].map((i) => <Bone key={i} style={isTV ? { width: 340, height: 191, borderRadius: radius.tile } : { height: 77, borderRadius: radius.tile }} />)}
          </View>
        </ShimmerGroup>
      ) : (
        <FlatList
          horizontal={isTV}
          scrollEnabled={isTV}
          data={data?.episodes ?? []}
          keyExtractor={(e) => String(e.number)}
          contentContainerStyle={isTV ? { paddingHorizontal: space.page, gap: space.gap } : { paddingHorizontal: space.page, gap: 14 }}
          renderItem={({ item }) => (
            <EpisodeItem episode={item} onPress={() => onPlay(season ?? 1, item.number)} current={current?.season === season && current?.episode === item.number} />
          )}
        />
      )}
    </View>
  )
}

function EpisodeItem({ episode, onPress, current }: { episode: Episode, onPress: () => void, current: boolean }) {
  const t = useT()
  const still = tmdbImage(episode.still, image.still)
  const width = isTV ? 340 : 136
  return (
    <Focusable onPress={onPress} radius={radius.tile} focusScale={1.04} accessibilityRole="button" accessibilityLabel={`${episode.number}. ${episode.name}`} style={isTV ? { width } : styles.episodeRow}>
      <View style={[styles.still, { width, height: width * 0.5625 }]}>
        {still ? <Image source={still} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <View style={styles.stillPlay}><Play color={colors.white} fill={colors.white} size={isTV ? 22 : 16} /></View>
        {current ? <View style={styles.currentBar} /> : null}
      </View>
      <View style={isTV ? { marginTop: 10, gap: 4 } : { flex: 1, gap: 3 }}>
        <Text weight="semibold" size={isTV ? 19 : 14} numberOfLines={2}>{`${episode.number}. ${episode.name}`}</Text>
        {episode.runtime ? <Text tone="tertiary" size={isTV ? 16 : 12.5}>{t('title.minutes', { n: episode.runtime })}</Text> : null}
        {episode.overview ? <Text tone="secondary" size={isTV ? 16 : 13} numberOfLines={isTV ? 2 : 3} style={{ lineHeight: isTV ? 22 : 18 }}>{episode.overview}</Text> : null}
      </View>
    </Focusable>
  )
}

function Cast({ cast }: { cast: Title['cast'] }) {
  const t = useT()
  const size = isTV ? 120 : 76
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={t('title.cast')} />
      <FlatList
        horizontal
        data={cast}
        keyExtractor={(p) => String(p.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.page, gap: isTV ? 22 : 14, paddingVertical: isTV ? 10 : 0 }}
        renderItem={({ item }) => (
          <Focusable radius={size / 2} disabled={!isTV} style={{ width: size + 10, alignItems: 'center', gap: 6 }} accessibilityLabel={item.character ? `${item.name}, ${item.character}` : item.name}>
            <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
              {item.profile ? <Image source={tmdbImage(item.profile, image.profile)} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Text tone="secondary" size={size / 3}>{item.name.slice(0, 1)}</Text>}
            </View>
            <Text size={isTV ? 16 : 12.5} weight="medium" numberOfLines={2} style={{ textAlign: 'center' }}>{item.name}</Text>
            {item.character ? <Text tone="tertiary" size={isTV ? 14 : 11.5} numberOfLines={1} style={{ textAlign: 'center' }}>{item.character}</Text> : null}
          </Focusable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  bar: { position: 'absolute', top: 0, start: 0, end: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.page, paddingBottom: 10 },
  barGlass: { backgroundColor: 'rgba(10,10,10,0.94)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  glassButton: { backgroundColor: 'rgba(0,0,0,0.45)' },
  body: { paddingHorizontal: space.page, marginTop: -64, gap: 12 },
  tvHero: { justifyContent: 'flex-end' },
  tvBody: { paddingHorizontal: space.page, paddingBottom: 48, gap: 14 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: isTV ? 18 : 12, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  action: { alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, minWidth: isTV ? 110 : 76 },
  sections: { gap: space.section, marginTop: isTV ? 10 : 26 },
  episodeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  still: { borderRadius: radius.tile, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  stillPlay: { width: isTV ? 46 : 34, height: isTV ? 46 : 34, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  currentBar: { position: 'absolute', start: 0, bottom: 0, height: 3, width: '45%', backgroundColor: colors.red },
  avatar: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
})
