// The player: the site's sources, full screen. Each source plays in a frame inside a page of ours
// (like the site's player), so the app decides what may happen:
// - an ad that tries to open a window, or to send the whole page elsewhere, is blocked (and said so);
// - sources marked `sandbox` play in a sandboxed frame (the site's "fewer ads");
// - the sources are tried best first: the one that played last time, then the site's order with
//   the ones viewers report broken last. "This source doesn't work" tells the site and moves on.
// The bar (back, the title, Sources, Next episode) shows for a few seconds, then gets out of the
// way: a tap on the small button brings it back (on TV: Back, and Back again leaves).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Modal, ScrollView, StyleSheet, View } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { LinearGradient } from 'expo-linear-gradient'
import * as NavigationBar from 'expo-navigation-bar'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Check, Layers, ShieldCheck, SkipForward, TriangleAlert } from 'lucide-react-native'
import { SITE, orderSources, reportSource, sourceUrl, useSeason, useSourceHealth, useTitle, type Kind, type Source } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useIsArabic, useT } from '@/i18n'
import { Loader } from '@/components/brand/Logo'
import { Button, IconButton } from '@/components/ui/Button'
import { Focusable } from '@/components/ui/Focusable'
import { ErrorState } from '@/components/ui/States'
import { Display, Text } from '@/components/ui/Text'
import { colors, isTV, radius } from '@/theme/tokens'

const BAR_MS = 5000
const SLOW_MS = 15000
/** How long a source has to keep playing before it counts as working. */
const PLAYED_MS = 90_000
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation'

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Our page around the source's player: a full-screen frame that says when it has loaded. */
function playerPage(url: string, sandbox: boolean) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe src="${escape(url)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"${sandbox ? ` sandbox="${SANDBOX}"` : ''}></iframe>
<script>document.querySelector('iframe').addEventListener('load',function(){window.ReactNativeWebView.postMessage('loaded')});</script></body></html>`
}

export default function WatchScreen() {
  const params = useLocalSearchParams<{ kind: string, id: string, title?: string, season?: string, episode?: string }>()
  const kind: Kind = params.kind === 'tv' ? 'tv' : 'movie'
  const id = Number(params.id)
  const title = useTitle(kind, id)
  const health = useSourceHealth()
  const router = useRouter()
  // A show opened without an episode (the billboard's Play) carries on where it was left.
  const last = useStore.getState().history.find((w) => w.kind === kind && w.id === id)
  const season = Number(params.season ?? last?.season ?? 1)
  const episode = Number(params.episode ?? (params.season ? 1 : last?.episode ?? 1))

  if (title.isPending || health.isPending) return <View style={styles.page}><StatusBar hidden /><Loader /></View>
  if (title.isError) return <View style={styles.page}><ErrorState error={title.error} onRetry={() => title.refetch()} /></View>
  if (!title.data.sources.length) return <View style={styles.page}><ErrorState error={null} onRetry={() => router.back()} /></View>
  return (
    <Player
      key={`${season}-${episode}`}
      kind={kind}
      id={id}
      name={params.title ?? title.data.title}
      season={kind === 'tv' ? season : undefined}
      episode={kind === 'tv' ? episode : undefined}
      sources={title.data.sources}
      seasons={title.data.seasons}
      saved={{ poster: title.data.poster, backdrop: title.data.backdrop, year: title.data.year }}
    />
  )
}

type PlayerProps = {
  kind: Kind
  id: number
  name: string
  season?: number
  episode?: number
  sources: Source[]
  seasons: { number: number, episodes: number }[]
  saved: { poster: string | null, backdrop: string | null, year: string }
}

function Player({ kind, id, name, season, episode, sources, seasons, saved }: PlayerProps) {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const arabic = useIsArabic()
  const health = useSourceHealth().data
  const recordWatch = useStore((state) => state.recordWatch)
  const preferred = useStore.getState().history.find((w) => w.kind === kind && w.id === id)?.source
  const ordered = useMemo(() => orderSources(sources, health, preferred), [sources, health, preferred])
  const [index, setIndex] = useState(0)
  const source = ordered[index] ?? ordered[0]
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const [bar, setBar] = useState(true)
  const [picker, setPicker] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const reported = useRef(new Set<string>())

  // The next episode: the next one this season, or the first of the next season.
  const seasonData = useSeason(id, kind === 'tv' ? season ?? 1 : null).data
  const next = useMemo(() => {
    if (kind !== 'tv' || !season || !episode) return null
    const count = seasonData?.episodes.length ?? seasons.find((s) => s.number === season)?.episodes ?? 0
    if (episode < count) return { season, episode: episode + 1 }
    const following = seasons.find((s) => s.number > season)
    return following ? { season: following.number, episode: 1 } : null
  }, [kind, season, episode, seasonData, seasons])

  // Full screen: no status bar, no navigation bar (a swipe brings it back for a moment).
  useEffect(() => {
    if (isTV) return
    NavigationBar.setVisibilityAsync('hidden').catch(() => {})
    return () => { NavigationBar.setVisibilityAsync('visible').catch(() => {}) }
  }, [])

  // Remember what's playing (Continue watching, and this source first next time).
  useEffect(() => {
    recordWatch({ id, kind, title: name, ...saved, season, episode, source: source.name })
  }, [id, kind, name, saved, season, episode, source.name, recordWatch])

  // A new source: wait for it, say so if it's slow, and count it as working once it has kept going.
  useEffect(() => {
    setLoaded(false)
    setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS)
    const playedTimer = setTimeout(() => {
      if (reported.current.has(source.name)) return
      reported.current.add(source.name)
      reportSource(source.name, true)
    }, PLAYED_MS)
    return () => { clearTimeout(slowTimer); clearTimeout(playedTimer) }
  }, [source.name])

  // The bar hides itself after a few seconds (not while the sources are open, or the source is slow).
  useEffect(() => {
    if (!bar || picker || slow) return
    const timer = setTimeout(() => setBar(false), BAR_MS)
    return () => clearTimeout(timer)
  }, [bar, picker, slow, index])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  // Back: closes the sources, then (on TV) shows the bar first, then leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (picker) { setPicker(false); return true }
      if (isTV && !bar) { setBar(true); return true }
      return false
    })
    return () => sub.remove()
  }, [picker, bar])

  const choose = useCallback((i: number) => {
    setIndex(i)
    setPicker(false)
    setBar(true)
  }, [])

  const reportBroken = () => {
    if (!reported.current.has(source.name)) {
      reported.current.add(source.name)
      reportSource(source.name, false)
    }
    setNotice(t('player.reported'))
    choose((index + 1) % ordered.length)
  }

  const goNext = () => {
    if (!next) return
    router.setParams({ season: String(next.season), episode: String(next.episode) })
  }

  // Only our page may be the page: anything else (an ad's redirect, an app link) is stopped.
  const allow = (request: WebViewNavigation) => {
    const url = request.url
    if (url.startsWith(SITE) || url === 'about:blank' || url.startsWith('data:')) return true
    setNotice(t('player.blocked'))
    return false
  }

  const html = useMemo(() => playerPage(sourceUrl(source, kind, id, season, episode), !!source.sandbox), [source, kind, id, season, episode])
  const subtitle = kind === 'tv' && season && episode ? t('player.episode', { season, episode }) : null
  const back = <ArrowLeft color={colors.white} size={isTV ? 28 : 22} style={arabic ? { transform: [{ scaleX: -1 }] } : undefined} />

  return (
    <View style={styles.page}>
      <StatusBar hidden />
      <WebView
        key={`${source.name}-${season}-${episode}`}
        source={{ html, baseUrl: SITE }}
        style={styles.web}
        containerStyle={styles.web}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={allow}
        onOpenWindow={() => setNotice(t('player.blocked'))}
        setSupportMultipleWindows
        javaScriptCanOpenWindowsAutomatically={false}
        onMessage={(event) => { if (event.nativeEvent.data === 'loaded') setLoaded(true) }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled
        thirdPartyCookiesEnabled
        mixedContentMode="never"
        allowFileAccess={false}
        setBuiltInZoomControls={false}
        overScrollMode="never"
        webviewDebuggingEnabled={__DEV__}
        androidLayerType="hardware"
        hasTVPreferredFocus={!bar}
      />

      {!loaded ? (
        <View style={styles.loading} pointerEvents="none">
          <Loader />
          <Text tone="secondary" size={isTV ? 20 : 14} style={{ marginTop: -50 }}>{t('player.loading')}</Text>
        </View>
      ) : null}

      {bar ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <LinearGradient colors={['rgba(0,0,0,0.85)', 'transparent']} style={[styles.bar, { paddingTop: isTV ? 32 : Math.max(insets.top, 12), paddingHorizontal: isTV ? 48 : Math.max(insets.left, insets.right, 16) }]}>
            <IconButton label={t('common.close')} onPress={() => router.back()} icon={back} style={styles.glass} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display size={isTV ? 30 : 20} numberOfLines={1}>{name}</Display>
              <Text tone="secondary" size={isTV ? 17 : 12.5} numberOfLines={1}>
                {[subtitle, source.name, source.sandbox ? t('player.fewerAds') : null].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
            {next ? <Button label={t('player.next')} variant="secondary" icon={<SkipForward color={colors.white} size={isTV ? 22 : 18} />} onPress={goNext} /> : null}
            <Button label={t('player.sources')} variant="secondary" icon={<Layers color={colors.white} size={isTV ? 22 : 18} />} onPress={() => setPicker(true)} hasTVPreferredFocus />
          </LinearGradient>
          {slow ? (
            <View style={styles.slow}>
              <TriangleAlert color={colors.star} size={isTV ? 24 : 18} />
              <Text size={isTV ? 19 : 14} style={{ flexShrink: 1 }}>{t('player.notWorking')}</Text>
            </View>
          ) : null}
        </View>
      ) : isTV ? null : (
        <Focusable onPress={() => setBar(true)} radius={22} accessibilityRole="button" accessibilityLabel={t('player.sources')} containerStyle={[styles.handleSpot, { top: Math.max(insets.top, 10), start: Math.max(insets.left, 12) }]} style={styles.handle}>
          <Layers color={colors.white} size={18} />
        </Focusable>
      )}

      {notice ? (
        <View style={[styles.notice, { bottom: Math.max(insets.bottom, 18) + 8 }]} pointerEvents="none">
          <ShieldCheck color={colors.success} size={isTV ? 22 : 18} />
          <Text size={isTV ? 18 : 13.5}>{notice}</Text>
        </View>
      ) : null}

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)} supportedOrientations={['landscape', 'portrait']} statusBarTranslucent navigationBarTranslucent>
        <Focusable plain onPress={() => setPicker(false)} focusable={false} style={styles.scrim} accessibilityLabel={t('common.close')}>
          <View />
        </Focusable>
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <Display size={isTV ? 30 : 22}>{t('player.chooseSource')}</Display>
            <ScrollView style={{ maxHeight: isTV ? 520 : 260 }} contentContainerStyle={{ gap: 6 }}>
              {ordered.map((item, i) => {
                const on = i === index
                const down = health?.[item.name]?.status === 'down'
                return (
                  <Focusable key={item.name} onPress={() => choose(i)} plain focusScale={1.02} hasTVPreferredFocus={on} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    {({ focused }) => (
                      <View style={[styles.source, on && styles.sourceOn, focused && styles.sourceFocused]}>
                        <View style={[styles.dot, { backgroundColor: down ? colors.red : health?.[item.name]?.status === 'good' ? colors.success : colors.text3 }]} />
                        <View style={{ flex: 1 }}>
                          <Text weight="semibold" size={isTV ? 21 : 15.5} style={focused ? { color: colors.black } : undefined}>{item.name}</Text>
                          {down || item.sandbox ? (
                            <Text size={isTV ? 16 : 12.5} tone="tertiary" style={focused ? { color: 'rgba(0,0,0,0.6)' } : undefined}>
                              {[down ? t('player.down') : null, item.sandbox ? t('player.fewerAds') : null].filter(Boolean).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                        {on ? <Check color={focused ? colors.black : colors.red} size={isTV ? 24 : 20} strokeWidth={2.6} /> : null}
                      </View>
                    )}
                  </Focusable>
                )
              })}
            </ScrollView>
            <Button label={t('player.report')} variant="secondary" icon={<TriangleAlert color={colors.white} size={isTV ? 22 : 18} />} onPress={reportBroken} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black },
  web: { flex: 1, backgroundColor: colors.black },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black },
  bar: { flexDirection: 'row', alignItems: 'center', gap: isTV ? 18 : 12, paddingBottom: isTV ? 60 : 36 },
  glass: { backgroundColor: 'rgba(255,255,255,0.14)' },
  handleSpot: { position: 'absolute' },
  handle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', opacity: 0.7 },
  slow: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: isTV ? 60 : 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,18,18,0.92)',
    maxWidth: '86%',
  },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    maxWidth: '86%',
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: {
    width: isTV ? 620 : 420,
    maxWidth: '100%',
    gap: 16,
    padding: isTV ? 32 : 20,
    borderRadius: radius.stage,
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: isTV ? 16 : 12, borderRadius: radius.tile },
  sourceOn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  sourceFocused: { backgroundColor: colors.white },
  dot: { width: 9, height: 9, borderRadius: 5 },
})
